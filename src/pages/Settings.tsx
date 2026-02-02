import { useEffect, useState } from "react";
import { checkBlock } from "../utils/Helpers";
import { isValidSyntax } from "../utils/Helpers";

export default function Settings() {
  const buttonStates = [
    { id: 1, state: "Block", description: "Blocks content viewing" },
    { id: 2, state: "Redirect", description: "Redirects to a chosen site" },
    { id: 3, state: "Warn", description: "Notifies when your time is up" },
    { id: 4, state: "Disabled", description: "Website action is disabled" },
  ];

  const [action, setAction] = useState<string | null>(null);
  const [time, setTime] = useState({ hours: 0, minutes: 0 });
  const [active, setActive] = useState<boolean | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [settingTab, setSettingTab] = useState<string>("Basic");
  const [afkTimer, setAfkTimer] = useState({ minutes: 1 });
  const [afkActive, setAfkActive] = useState<boolean | null>(null);
  const [redirect, setRedirect] = useState<string>("");
  const [isAlert, setAlert] = useState<string>("");
  const [savedRedirect, setSavedRedirect] = useState<string>("");

  function convertTime(totalSec: number) {
    const hour = Math.floor(totalSec / 3600);
    const min = Math.floor((totalSec % 3600) / 60);
    return { hour, min };
  }

  useEffect(() => {
    const loadData = async () => {
      try {
        const { maxTime, action, active, afkTime, afkActive, redirect } = await chrome.storage.sync.get([
          "maxTime",
          "action",
          "active",
          "afkTime",
          "afkActive",
          "redirect",
        ]);

        // grab button states and update ui
        setAction(action as string);
        setActive(active as boolean);
        setAfkActive(afkActive as boolean);
        setRedirect(redirect as string);
        setSavedRedirect(redirect as string);

        const { min: afkMin } = convertTime(afkTime as number);
        setAfkTimer({ minutes: afkMin });

        const { hour: timerHour, min: timerMin } = convertTime(maxTime as number);
        setTime({ hours: timerHour, minutes: timerMin });
        setIsLoaded(true);
      } catch (error) {
        console.log(error);
      }
    };
    loadData();
  }, []);

  // Helper func visual time update
  const saveTime = (h: number, m: number) => {
    const newTime = { hours: h, minutes: m };
    const newTimeSec: number = newTime.hours * 3600 + newTime.minutes * 60;
    setTime(newTime);
    return newTimeSec;
  };

  const saveAfkTime = (m: number) => {
    const newTime = { minutes: m };
    const newTimeSec: number = newTime.minutes * 60;
    setAfkTimer(newTime);
    return newTimeSec;
  };

  // helper function to save active state on change
  const updateActive = (onOff: boolean) => {
    const newActive = !onOff;
    setActive(newActive);
    return newActive;
  };

  const updateAfkActive = (onOff: boolean) => {
    const newActive = !onOff;
    setAfkActive(newActive);
    return newActive;
  };

  // helper function to save action to storage on change
  const updateAction = (newAction: string) => {
    setAction(newAction);
    chrome.storage.sync.set({ action: newAction });
  };

  const handleKeyDown = async () => {
    const valid = await isValidSyntax(redirect);
    if (!valid) {
      setAlert("Please enter a valid domain!");
    } else {
      const urlToCheck = redirect.includes("://") ? redirect : "https://" + redirect;
      const blocked = await checkBlock(urlToCheck);
      if (blocked) {
        setAlert("Can't redirect to a blocked site!");
      } else {
        setSavedRedirect(redirect);
        chrome.storage.sync.set({ redirect });
        setAlert("Redirect saved!");
      }
    }
  };

  const handleBlur = async () => {
    const valid = await isValidSyntax(redirect);
    if (!valid) {
      setAlert("Please enter a valid domain!");
      setRedirect(savedRedirect);
    } else {
      const urlToCheck = redirect.includes("://") ? redirect : "https://" + redirect;
      const blocked = await checkBlock(urlToCheck);
      if (blocked) {
        setAlert("Can't redirect to a blocked site!");
        setRedirect(savedRedirect);
      } else {
        if (savedRedirect === redirect) {
          setAlert("");
        } else {
          setSavedRedirect(redirect);
          chrome.storage.sync.set({ redirect });
          setAlert("Redirect saved!");
        }
      }
    }
  };

  useEffect(() => {
    if (isAlert) {
      const timer = setTimeout(() => {
        setAlert("");
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [isAlert]);

  // check if settings are loaded before showing ui
  if (!isLoaded) {
    return <div className="bg-bg"></div>;
  }

  return (
    <div>
      <div className="text-text">
        <div className="flex flex-row items-center w-full h-fit">
          <div className="grid-cols-2 grid my-4 w-full">
            <button
              onClick={() => setSettingTab("Basic")}
              className={`col-1 flex justify-center p-1 cursor-pointer transition-all duration-300 border-2 ${
                settingTab === "Basic"
                  ? "border-primary text-text"
                  : "bg-transparent hover:bg-primary-dark text-sub-text border-transparent"
              }`}
            >
              Basic Blocking
            </button>
            <button
              onClick={() => setSettingTab("Preset")}
              className={`col-2 flex justify-center p-1 cursor-pointer transition-all duration-300 border-2 ${
                settingTab === "Preset"
                  ? "border-primary text-text"
                  : "bg-transparent hover:bg-primary-dark text-sub-text border-transparent"
              }`}
            >
              Preset Modes
            </button>
          </div>
        </div>

        <div
          style={{ "--delay": `50ms` } as React.CSSProperties}
          className={`animate-fade-up animate-stagger grid grid-cols-3 w-full border-2 border-bg-light justify-center transition-all duration-300 ${active ? "border-primary" : "border-bg-light"}`}
        >
          {/* Hours Column */}
          <div className="grid grid-cols-2 col-1 w-full">
            <input
              className="text-center flex justify-center w-full focus:bg-transparent focus:outline-none focus:ring-0 focus:shadow-none"
              type="number"
              placeholder="0"
              value={time.hours || ""}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                const finalVal = isNaN(val) ? 0 : val;

                if (finalVal > 24) {
                  chrome.storage.sync.set({ maxTime: saveTime(0, time.minutes) });
                } else if (finalVal === 24) {
                  chrome.storage.sync.set({ maxTime: saveTime(finalVal, 0) });
                } else {
                  chrome.storage.sync.set({ maxTime: saveTime(finalVal, time.minutes) });
                }
              }}
              onKeyDown={(e) => ["e", "E", "+", "-"].includes(e.key) && e.preventDefault()}
            />
            <label className="flex items-center text-sub-text">{time.hours > 1 ? "hours" : "hour"}</label>
          </div>
          {/* Minutes Column */}
          <div className="grid grid-cols-2 col-2 w-full">
            <input
              className="text-center flex justify-center w-full focus:bg-transparent focus:outline-none focus:ring-0 focus:shadow-none"
              type="number"
              placeholder="0"
              value={time.minutes || ""}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                const finalVal = isNaN(val) ? 0 : val;

                if (finalVal >= 60) {
                  chrome.storage.sync.set({ maxTime: saveTime(time.hours, 0) });
                } else {
                  chrome.storage.sync.set({ maxTime: saveTime(time.hours, finalVal) });
                }
              }}
              onKeyDown={(e) => ["e", "E", "+", "-"].includes(e.key) && e.preventDefault()}
            />
            <span className="flex items-center text-sub-text">min</span>
          </div>
          <button
            className={`p-1 flex justify-center items-center col-3 cursor-pointer transition-all duration-300 ${
              active ? "text-text bg-primary-dark" : "text-sub-text hover:bg-primary-dark"
            }`}
            onClick={() => chrome.storage.sync.set({ active: updateActive(active as boolean) })}
          >
            {active ? "Enabled" : "Disabled"}
          </button>
        </div>
        <p
          style={{ "--delay": `100ms` } as React.CSSProperties}
          className="animate-fade-up animate-stagger flex justify-center mb-2 mt-1 text-sub-text"
        >
          Daily maximum time allowed
        </p>
        <div
          style={{ "--delay": `50ms` } as React.CSSProperties}
          className={`animate-fade-up animate-stagger relative grid grid-cols-4 items-center w-full border-2 transition-all duration-300 ease-in-out ${action === "Disabled" ? "border-bg-light" : "border-primary"} bg-transparent overflow-hidden`}
        >
          {/* Sliding button */}
          <div
            className={`absolute h-full transition-all duration-300 ease-in-out ${action === "Disabled" ? "bg-transparent" : "bg-primary-dark"}`}
            style={{
              width: "25%",
              transform: `translateX(${buttonStates.findIndex((b) => b.state === action) * 100}%)`,
            }}
          />
          {buttonStates.map((b) => (
            <button
              key={b.id}
              onClick={() => updateAction(b.state)}
              className={`z-10 flex justify-center items-center p-1 hover:bg-primary-dark cursor-pointer transition-all duration-300 col-${b.id} ${b.state === action ? "text-text" : "text-sub-text"} ${action !== "Block" && action !== "Warn" && action !== "Redirect" ? "border-bg-light" : ""}`}
            >
              {b.state}
            </button>
          ))}
        </div>
        <div>
          {buttonStates.map((b) => (
            <p
              style={{ "--delay": `100ms` } as React.CSSProperties}
              className={`animate-fade-up animate-stagger flex justify-center items-center mt-1 ${action === b.state ? "text-sub-text" : "hidden"}`}
            >
              {b.description}
            </p>
          ))}
        </div>
        {action === "Redirect" && (
          <div>
            <input
              style={{ "--delay": `50ms` } as React.CSSProperties}
              className={`animate-fade-up text-center animate-stagger focus:border-primary focus:bg-primary-dark focus:hover:bg-primary-dark text-text w-full flex border-2 p-1 mt-2 transition-all duration-300 hover:bg-primary-dark outline-none ${redirect.length > 0 ? `border-primary` : `border-bg-light`} truncate`}
              type="text"
              value={redirect}
              placeholder="Enter a site to be redirected"
              onChange={(e) => setRedirect(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleKeyDown()}
              onBlur={handleBlur}
            />
            <span
              style={{ "--delay": `100ms` } as React.CSSProperties}
              className="animate-fade-up animate-stagger flex justify-center mt-1 text-sub-text"
            >
              Enter a valid website to redirect
            </span>
          </div>
        )}
        {action === "Block" && (
          <div>
            <button
              style={{ "--delay": `50ms` } as React.CSSProperties}
              className={`cursor-pointer animate-fade-up justify-center animate-stagger text-text w-full flex border-2 border-primary-dark p-1 mt-2 transition-all duration-300 hover:bg-primary-dark outline-none`}
            >
              Nuke
            </button>
            <span
              style={{ "--delay": `100ms` } as React.CSSProperties}
              className="animate-fade-up animate-stagger flex justify-center mt-1 text-sub-text"
            >
              No warning or notification just complete deletion
            </span>
          </div>
        )}
        <div
          style={{ "--delay": `50ms` } as React.CSSProperties}
          className={`animate-fade-up animate-stagger grid grid-cols-2 w-full border-2 justify-center mt-2 transition-all duration-300 ${afkActive ? "border-primary" : "border-bg-light"}`}
        >
          {/* AFK Minutes Input */}
          <div className="grid grid-cols-2 col-1 w-full">
            <input
              className="text-center flex justify-center w-full focus:bg-transparent focus:outline-none focus:ring-0 focus:shadow-none"
              type="number"
              placeholder="1"
              value={afkTimer.minutes || ""}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                const finalVal = isNaN(val) ? 0 : val;
                if (finalVal >= 60) {
                  chrome.storage.sync.set({ afkTime: saveAfkTime(1) });
                } else {
                  chrome.storage.sync.set({ afkTime: saveAfkTime(finalVal) });
                }
              }}
              onKeyDown={(e) => ["e", "E", "+", "-"].includes(e.key) && e.preventDefault()}
            />
            <label className="flex items-center text-sub-text">minutes</label>
          </div>

          <button
            className={`p-1 flex justify-center items-center col-2 cursor-pointer transition-all duration-300 ${
              afkActive ? "text-text bg-primary-dark" : " text-sub-text hover:bg-primary-dark"
            }`}
            onClick={() => chrome.storage.sync.set({ afkActive: updateAfkActive(afkActive as boolean) })}
          >
            {afkActive ? "Enabled" : "Disabled"}
          </button>
        </div>
        <span
          style={{ "--delay": `100ms` } as React.CSSProperties}
          className="animate-fade-up animate-stagger flex justify-center mt-1 text-sub-text"
        >
          Total time of inactivity before AFK state
        </span>
      </div>
      {isAlert && (
        <div
          className={`${isAlert.includes("saved") ? "animate-fade" : "animate-shake-fade"} bg-primary text-text w-[95%] border-2 border-secondary shadow-lg shadow-secondary/50 p-1 flex justify-center absolute bottom-4 left-1/2 -translate-x-1/2 rounded`}
        >
          {isAlert}
        </div>
      )}
    </div>
  );
}
