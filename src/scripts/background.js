// when alarm goes off respond to it
chrome.alarms.onAlarm.addListener(async (alarm) => {
  // action for when alarm goes off
  console.log("[Alarm] 30 seconds passed...");
  const [currTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!currTab) return;
  const { currentSite, startTime } = await chrome.storage.local.get(["currentSite", "startTime"]);
  // make a check to see if tab has changed AND if blocked
  if (currTab.id === currentSite && (await checkBlock(currTab.id))) {
    // if current is different than stored then subtract the time
    await handleTotalTime(Date.now(), startTime);
    await chrome.storage.local.set({ startTime: Date.now() });
  }
});

// create the alarm fires every minute
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("alarm", {
    periodInMinutes: 0.5,
  });
  updateContentScript();
});

chrome.runtime.onStartup.addListener(() => {
  updateContentScript();
});

async function handleTab(tabId, timeClicked, tabUrl) {
  // grab all instances of data from storage when called
  const { maxTime } = await chrome.storage.sync.get(["maxTime"]);

  try {
    if (maxTime > 0) {
      // store the initial time clicked and current website
      chrome.storage.local.set({ startTime: timeClicked, currentSite: tabId, lastUrl: tabUrl, showAction: false });
    }
  } catch (error) {
    console.log(error);
  }
}

// helper function to calculate total time
async function handleTotalTime(currStartTime, storedStartTime) {
  const { maxTime } = await chrome.storage.sync.get({ maxTime: 1800 }); // grab the most updated time
  const timeSeconds = (currStartTime - storedStartTime) / 1000;
  let updateTime = Math.round(maxTime - timeSeconds); // grab the time in seconds spent

  console.log(`[Timer] Subtraction: ${timeSeconds}. Remaining: ${updateTime}`);

  // check if update time is negative and redirect to content script
  if (updateTime <= 0) {
    updateTime = 0;
    console.log("[Action] Time limit reached.");
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      await chrome.storage.local.set({ showAction: true });
    }
  }
  await chrome.storage.sync.set({ maxTime: updateTime });
}

// helper function checks if website is blocked
async function checkBlock(tabId) {
  const currTab = await chrome.tabs.get(tabId);
  const { website } = await chrome.storage.sync.get({ website: [] });
  if (currTab.url) {
    try {
      const tabDomain = new URL(currTab.url); // grabs the url of the tab
      const cleanUrl = tabDomain.hostname.replace(/^www\./, ""); // clean up the url
      return website.some((site) => site.text === cleanUrl); // returns t/f if website is blocked
    } catch (error) {
      console.log(error);
      return false;
    }
  }
  return false;
}

async function syncSession(tabId, tabUrl, reason) {
  console.log(`[Event] Triggered by: ${reason}`);
  const timeClicked = Date.now();

  // grab user settings
  const { globalSwitch, active } = await chrome.storage.sync.get(["globalSwitch", "active"]);

  // grab current site and start time
  const { currentSite, startTime, lastUrl } = await chrome.storage.local.get(["currentSite", "startTime", "lastUrl"]);
  const { maxTime } = await chrome.storage.sync.get({ maxTime: 1800 });

  // If the extension is OFF, stop everything immediately.
  if (globalSwitch === false || globalSwitch === undefined || active === undefined) {
    console.log("[Guard] Extension is Disabled. Allowing all traffic.");
    return;
  }

  console.log(maxTime);
  console.log(active);

  // check if currentsite and startTime exists and timer is enabled
  if (currentSite && startTime) {
    console.log(`[Timer] Committing time for previous path: ${lastUrl}`);
    // make a check to see if tab has changed and update the time
    await handleTotalTime(timeClicked, startTime);
    await chrome.storage.local.remove(["currentSite", "startTime", "lastUrl"]);
  }

  // if site is blocked
  if (await checkBlock(tabId)) {
    // if timer is active with time
    if (active && maxTime > 0) {
      console.log(`[State] Opening new session for blocked tab: ${tabId}`);
      await handleTab(tabId, timeClicked, tabUrl); // handle tab info do not show action
    } else {
      console.log(`timer is disabled redirecting...`);
      // otherwise assume no timer so activate action
      await chrome.storage.local.set({ showAction: true });
    }
  } else {
    console.log(`Site is not blocked clearing show action`);
    await chrome.storage.local.set({ showAction: false });
  }
}

// updates the content scripts with blocked sites as matches
async function updateContentScript() {
  const { website } = await chrome.storage.sync.get({ website: [] });

  const patterns = website.map((site) => {
    const domain = site.text.replace(/^https?:\/\//, "").replace(/^www\./, "");
    return `*://*.${domain}/*`;
  });

  try {
    // check for old scripts if they exists
    const oldScripts = await chrome.scripting.getRegisteredContentScripts();
    if (oldScripts.some((script) => script.id === "blockedSites")) {
      await chrome.scripting.unregisterContentScripts({ ids: ["blockedSites"] });
      console.log("content script unregistered");
    }

    // register updated scripts for each website
    if (patterns.length > 0) {
      await chrome.scripting.registerContentScripts([
        {
          id: "blockedSites",
          js: ["src/content.tsx"],
          matches: patterns,
          runAt: "document_start",
        },
      ]);
      console.log("Content Script Registered for:", patterns);
    }
  } catch (error) {
    console.log(error);
    console.error("Registration Failed:", error);
  }
}

// use chrome.tabs.onActivated to listen for tab switches
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  if (tab.url) {
    await syncSession(activeInfo.tabId, tab.url, "Tab Switch");
  }
});

// Checks if user doesn't switch tabs but updates current tab
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // if internal url content has changed we handle time between change
  if (changeInfo.url) {
    await syncSession(tabId, tab.url, "URL path change");
  }
});

// updates storage when settings change
chrome.storage.onChanged.addListener(async (changes, namespace) => {
  if (namespace !== "sync") return;
  console.log("[Settings] Change detected:", Object.keys(changes));

  // handles timer and global switches to stop the clock immediately
  const globalOff = changes.globalSwitch && changes.globalSwitch.newValue === false;
  const timerOff = changes.active && changes.active.newValue === false;

  if (globalOff || timerOff) {
    console.log("[Cleanup] User disabled extension/timer. Stopping session.");
    const { startTime } = await chrome.storage.local.get("startTime");
    await chrome.storage.local.set({ showAction: false });
    // if start time exists then handle remaining time left
    if (startTime) {
      await handleTotalTime(Date.now(), startTime);
      await chrome.storage.local.remove(["currentSite", "startTime"]);
    }
  }

  // if website list changes in storage
  if (changes.website) {
    updateContentScript();
  }

  // evaluate the current tab based on new settings regardless
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab.id) {
    // We pass the latest changes directly to syncSession if possible,
    await syncSession(tab.id, tab.url, "Settings Toggle");
  }
});

// updates timer when user closes tab
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const { currentSite, startTime } = await chrome.storage.local.get(["currentSite", "startTime"]);

  // If the tab closed was the one we were tracking, save the time
  if (tabId === currentSite && startTime) {
    await handleTotalTime(Date.now(), startTime);
    await chrome.storage.local.remove(["currentSite", "startTime"]);
  }
});
