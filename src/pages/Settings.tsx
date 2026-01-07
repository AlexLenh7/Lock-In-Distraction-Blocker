import { useEffect, useState } from "react";

export default function Settings() {
  const buttonStates = [
    { id: 1, state: "Block", description: "Prevents site visit", color: "#b91717" },
    { id: 2, state: "Warn", description: "Notification but can close out", color: "#f49f38" },
    { id: 3, state: "Disable", description: "Just disabled", color: "#818181" },
  ];

  const [action, setAction] = useState<string>("Block");
  const [time, setTime] = useState({ hours: 0, minutes: 0 });
  const [active, setActive] = useState<boolean>(false);

  // save the time in minutes to storage
  const saveTime = (h: number, m: number) => {
    const newTime = { hours: h, minutes: m };
    const newTimeMin: number = newTime.minutes + newTime.hours * 60;
    setTime(newTime);
    chrome.storage.sync.set({ maxTime: newTimeMin });
  };

  useEffect(() => {
    // grab and convert time from minutes to hours for display
    chrome.storage.sync.get({ maxTime: 30 }, (data) => {
      const totalMin = data.maxTime as number;
      const hour = Math.floor(totalMin / 60);
      const min = totalMin % 60;
      setTime({ hours: hour, minutes: min });
    });

    // grab button state and update ui
    chrome.storage.sync.get({ action: "Block" }, (data) => {
      setAction(data.action as string);
    });

    // grab button state on popup
    chrome.storage.sync.get({ active: false }, (data) => {
      setActive(data.active as boolean);
    });
  }, []);

  // helper function to save active state on change
  const updateActive = () => {
    const newActive = !active;
    setActive(newActive);
    chrome.storage.sync.set({ active: newActive });
  };

  // helper function to save action to storage on change
  const updateAction = (newAction: string) => {
    setAction(newAction);
    chrome.storage.sync.set({ action: newAction });
  };

  // saves action to storage on change
  useEffect(() => {
    chrome.storage.sync.set({ action });
  }, [action]);

  return (
    // TODO: Add a choosable option between block, warn, and disable
    // Add maximum time allowed set by user
    // Add a mode selector
    <div>
      <h1 className="text-text my-2">Default Block Settings</h1>
      <div className="rounded-lg text-text p-3 bg-secondary-background">
        <div>
          <div className="grid grid-cols-3 w-full gap-2 border-2 justify-center">
            {/* Hours Column */}
            <div className="grid grid-cols-2 col-1 w-full">
              <input
                className="text-center flex justify-center w-full focus:bg-transparent focus:outline-none focus:ring-0 focus:shadow-none"
                type="number"
                placeholder="hour"
                value={time.hours}
                onChange={(e) => saveTime(parseInt(e.target.value) || 0, time.minutes)}
              />
              <label className="flex items-center">{time.hours > 1 ? "hours" : "hour"}</label>
            </div>
            {/* Minutes Column */}
            <div className="grid grid-cols-2 col-2 w-full">
              <input
                className="text-center flex justify-center w-full focus:bg-transparent focus:outline-none focus:ring-0 focus:shadow-none"
                type="number"
                placeholder="min"
                value={time.minutes}
                onChange={(e) => saveTime(time.hours, parseInt(e.target.value) || 0)}
              />
              <span className="flex items-center">min</span>
            </div>
            <button
              className={`p-1 flex justify-center items-center col-3 cursor-pointer transition-all duration-300 ${
                active ? "bg-primary text-text" : "text-gray-500"
              }`}
              onClick={() => updateActive()}
            >
              {active ? "Enabled" : "Disabled"}
            </button>
          </div>
        </div>
        <p className="flex justify-center mb-4 mt-1 text-secondary-text">Maximum time allowed</p>
        <div className="relative grid grid-cols-3 items-center w-full border-2 border-(--secondary-text) bg-transparent overflow-hidden">
          {/* Sliding button */}
          <div
            className="absolute h-full transition-all duration-300 ease-in-out"
            style={{
              width: "96px",
              transform: `translateX(${buttonStates.findIndex((b) => b.state === action) * 100}%)`,
              backgroundColor: buttonStates.find((b) => b.state === action)?.color || "#818181",
            }}
          />
          {buttonStates.map((b) => (
            <button
              key={b.id}
              onClick={() => updateAction(b.state)}
              className={`z-10 flex justify-center items-center col-${
                b.id
              } p-1 cursor-pointer transition-colors duration-300${
                action === b.state
                  ? " text-text shadow-md" // Active Style
                  : "border-gray-500 text-gray-500 hover:border-text" // Inactive Style
              }`}
            >
              {b.state}
            </button>
          ))}
        </div>
        {buttonStates.map((b) => (
          <p
            className={`flex justify-center items-center mt-1 ${action === b.state ? "text-secondary-text" : "hidden"}`}
          >
            {b.description}
          </p>
        ))}
      </div>
    </div>
  );
}
