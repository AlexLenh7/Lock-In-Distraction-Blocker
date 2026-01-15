// when alarm goes off respond to it
chrome.alarms.onAlarm.addListener(async (alarm) => {
  // action for when alarm goes off
  try {
    console.log("[Alarm] 30 seconds passed...");
    await checkDay();
    const [currTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!currTab) return;

    const { currentSite, startTime } = await chrome.storage.local.get(["currentSite", "startTime"]);
    // make a check to see if tab has changed AND if blocked
    if (currTab.url === currentSite && startTime) {
      const now = Date.now();
      await commitTime(now, startTime, currentSite);
      await chrome.storage.local.set({ startTime: now });
    }
  } catch (error) {
    console.error("[Alarm Error]:", error);
  }
});

// create the alarm fires every minute
chrome.runtime.onInstalled.addListener(async () => {
  try {
    chrome.alarms.create("alarm", {
      periodInMinutes: 0.5,
    });
    updateContentScript();
    //cleanupOldStorageData();
  } catch (error) {
    console.error("[onInstall Error]:", error);
  }
});

chrome.runtime.onStartup.addListener(async () => {
  try {
    updateContentScript();
    checkDay();
  } catch (error) {
    console.error("[onStartup Error]:", error);
  }
});

// helper function checks for day to store times
async function checkDay() {
  console.log("CheckDay running...");
  try {
    const {
      storeBlockDay = {},
      storeGlobalDay = {},
      globalWebsiteTime = {},
      totalWebsiteTime = {},
      currentDay,
    } = await chrome.storage.local.get([
      "globalWebsiteTime",
      "totalWebsiteTime",
      "currentDay",
      "storeGlobalDay",
      "storeBlockDay",
    ]);

    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dayName = days[currentDay];
    const today = new Date().getDay();

    // compare numbers if we are on a different day before updating
    if (currentDay === undefined) {
      console.log("[Setup] First run detected. Initializing currentDay.");
      await chrome.storage.local.set({ currentDay: today });
      return;
    }

    if (today !== currentDay) {
      storeBlockDay[dayName] = totalWebsiteTime;
      storeGlobalDay[dayName] = globalWebsiteTime;

      let counter = (currentDay + 1) % 7;

      // handle gaps in between days
      while (counter !== today) {
        const gapDayName = days[counter];
        storeBlockDay[gapDayName] = null;
        storeGlobalDay[gapDayName] = null;
        counter = (counter + 1) % 7;
      }
      // store the all times into that day and update date
      // currentDay is stored as a number
      await chrome.storage.local.set({ storeBlockDay, storeGlobalDay, currentDay: today });
      console.log("CurrDay Blocked Times:", storeBlockDay);
      console.log("CurrDay Global Times:", storeGlobalDay);
      // reset times for the new day
      await cleanupOldStorageData();
    }
  } catch (error) {
    console.error("[checkDay Error]:", error);
  }
}

// helper function checks if website is blocked
async function checkBlock(tabUrl) {
  try {
    const { website } = await chrome.storage.sync.get({ website: [] });
    if (tabUrl) {
      try {
        const tabDomain = new URL(tabUrl).hostname.replace(/^www\./, "");
        return website.some((site) => site.text === tabDomain); // returns t/f if website is blocked
      } catch (error) {
        console.log(error);
        return false;
      }
    }
    return false;
  } catch (error) {
    console.error("[checkBlock Error]:", error);
  }
}

async function commitTime(now, start, url) {
  try {
    const delta = (now - start) / 1000;
    if (delta <= 0 || isNaN(delta)) return;

    const currDay = new Date().getDay();
    await chrome.storage.local.set({ currentDay: currDay });

    const domain = new URL(url).hostname.replace(/^www\./, "");

    // 1. Always update Global Time
    const { globalWebsiteTime = {} } = await chrome.storage.local.get("globalWebsiteTime");
    globalWebsiteTime[domain] = (globalWebsiteTime[domain] || 0) + delta;

    // 2. Conditionally update Blocked Time and Countdown
    const isBlocked = await checkBlock(url);
    let updateData = { globalWebsiteTime };

    if (isBlocked) {
      const { totalWebsiteTime = {} } = await chrome.storage.local.get("totalWebsiteTime");
      totalWebsiteTime[domain] = (totalWebsiteTime[domain] || 0) + delta;

      const { maxTime } = await chrome.storage.sync.get({ maxTime: 1800 });
      const newMaxTime = Math.max(0, maxTime - delta);

      console.log(`[Timer] Subtraction: ${delta}. Remaining: ${newMaxTime}`);

      await chrome.storage.sync.set({ maxTime: newMaxTime });
      updateData.totalWebsiteTime = totalWebsiteTime;

      await chrome.storage.local.set({ showAction: newMaxTime <= 0 });
      console.log("block sites:", totalWebsiteTime);
    }

    await chrome.storage.local.set(updateData);
    console.log(`[Timer] Committed ${delta}s to ${domain}. Blocked: ${isBlocked}`);
    console.log("global sites:", globalWebsiteTime);
  } catch (error) {
    console.error("[commitTime Error]:", error);
  }
}

async function syncSession(tabUrl, reason) {
  try {
    console.log(`[Event] Triggered by: ${reason}`);
    await checkDay();
    const now = Date.now();

    // grab user settings
    const { globalSwitch, active, maxTime } = await chrome.storage.sync.get(["globalSwitch", "active", "maxTime"]);
    const { currentSite, startTime } = await chrome.storage.local.get(["currentSite", "startTime"]);

    // If the extension is OFF, stop everything immediately.
    if (globalSwitch === false || globalSwitch === undefined || active === undefined) {
      console.log("[Guard] Extension is Disabled. Allowing all traffic.");
      return;
    }

    // if site and start time already exists remove it and start a new session
    if (currentSite && startTime) {
      await chrome.storage.local.remove(["currentSite", "startTime"]);
      await commitTime(now, startTime, currentSite);
      console.log(`[Timer] Committing time for previous path: ${currentSite}`);
    }

    // tracks all valid sites
    if (tabUrl && !tabUrl.startsWith("chrome://") && !tabUrl.startsWith("chrome-extension://")) {
      await chrome.storage.local.set({
        startTime: now,
        currentSite: tabUrl,
        showAction: !(active && maxTime > 0),
      });
    }
  } catch (error) {
    console.error("[syncSession Error]:", error);
  }
}

// updates the content scripts with blocked sites as matches
async function updateContentScript() {
  try {
    const { website } = await chrome.storage.sync.get({ website: [] });

    const patterns = website.map((site) => {
      const domain = site.text.replace(/^https?:\/\//, "").replace(/^www\./, "");
      return `*://*.${domain}/*`;
    });

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
    console.error("[updateContentScript Error]:", error);
  }
}

// use chrome.tabs.onActivated to listen for tab switches
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url) {
      await syncSession(tab.url, "Tab Switch");
    }
  } catch (error) {
    console.error("[onActivated Error]:", error);
  }
});

// Checks if user doesn't switch tabs but updates current tab
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  try {
    // if internal url content has changed we handle time between change
    if (changeInfo.url) {
      await syncSession(tab.url, "URL path change");
    }
  } catch (error) {
    console.error("[onUpdated Error]:", error);
  }
});

// updates storage when settings change
chrome.storage.onChanged.addListener(async (changes, namespace) => {
  try {
    if (namespace !== "sync") return;
    console.log("[Settings] Change detected:", Object.keys(changes));

    if (changes.maxTime) {
      const { startTime } = await chrome.storage.local.get("startTime");
      if (startTime) {
        return;
      }
    }

    // handles timer and global switches to stop the clock immediately
    const globalOff = changes.globalSwitch && changes.globalSwitch.newValue === false;
    const timerOff = changes.active && changes.active.newValue === false;

    if (globalOff || timerOff) {
      console.log("[Cleanup] User disabled extension/timer. Stopping session.");

      const { startTime, currentSite } = await chrome.storage.local.get(["startTime", "currentSite"]);
      await chrome.storage.local.set({ showAction: false });
      // if start time exists then handle remaining time left
      if (startTime && currentSite) {
        await chrome.storage.local.remove(["currentSite", "startTime"]);
        const now = Date.now();
        commitTime(now, startTime, currentSite);
      }
    }

    // if website list changes in storage
    if (changes.website) {
      updateContentScript();

      const oldList = changes.website.oldValue || [];
      const newList = changes.website.newValue || [];

      // remove blocked site time if block list changes
      const removeSites = oldList.filter((oldSite) => !newList.some((newSite) => newSite.text === oldSite.text));
      console.log("Found old site", removeSites);
      if (removeSites.length > 0) {
        const { totalWebsiteTime = {} } = await chrome.storage.local.get("totalWebsiteTime");

        removeSites.forEach((site) => {
          if (totalWebsiteTime[site.text]) {
            console.log("Removing time for: ", totalWebsiteTime[site.text]);
            delete totalWebsiteTime[site.text];
          }
        });
        await chrome.storage.local.set({ totalWebsiteTime });
      }
    }

    // evaluate the current tab based on new settings regardless
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab.url) {
      // We pass the latest changes directly to syncSession if possible,
      await syncSession(tab.url, "Settings Toggle");
    }
  } catch (error) {
    console.error("[onChange Error]:", error);
  }
});

// updates timer when user closes tab
chrome.tabs.onRemoved.addListener(async (tabId) => {
  try {
    await checkDay();
    const { currentSite, startTime } = await chrome.storage.local.get(["currentSite", "startTime"]);

    if (currentSite && startTime) {
      const now = Date.now();
      // If the tab closed was the one we were tracking, save the time
      commitTime(now, startTime, currentSite);
      await chrome.storage.local.remove(["currentSite", "startTime"]);
    }
  } catch (error) {
    console.error("[onRemove error]:", error);
  }
});

async function cleanupOldStorageData() {
  await chrome.storage.local.remove(["totalWebsiteTime", "globalWebsiteTime", "currentSite", "startTime"]);
  console.log("[Cleanup] No old entries found.");
}
