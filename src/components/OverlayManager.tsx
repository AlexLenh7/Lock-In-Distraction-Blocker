// src/components/OverlayManager.tsx
import { useEffect, useState } from "react";
import Block from "./Block";
import Warn from "./Warn";

export default function OverlayManager() {
  const [isAction, setisAction] = useState<boolean>(false);
  const [localAction, setLocalAction] = useState<string | null>(null);

  useEffect(() => {
    const checkStatus = async () => {
      const { active, action, globalSwitch } = await chrome.storage.sync.get(["active", "action", "globalSwitch"]);
      const { showAction } = await chrome.storage.local.get(["showAction"]);

      if (action === undefined || active === undefined) {
        console.log("[Guard] Storage not ready, skipping enforcement.");
        return;
      }

      const shouldShow = showAction as boolean;
      const currentAction = action as string;

      setisAction(shouldShow);
      setLocalAction(currentAction);

      // another check for global switch
      if (globalSwitch === false) {
        setisAction(false);
        return;
      }

      if (isAction) {
        // if action is block then redirect
        if (localAction === "Block") {
          console.log("Setting is Block, Redirect Blocking site");
        } else if (localAction === "Warn") {
          console.log("Setting is Warn, give warn notification");
        } else if (localAction === "Disable") {
          console.log("Setting is Disable, do nothing");
        }
      }
    };

    checkStatus();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleStorageChange = (changes: any, area: string) => {
      if (area === "sync" || area === "local") {
        if (changes.showAction || changes.active) {
          checkStatus();
        }
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
      // Restore scrolling on cleanup
      if (document.body) {
        document.body.style.overflow = "auto";
      }
    };
  }, []);

  const handleClose = () => {
    setisAction(false);
    // Restore scrolling when overlay is closed
    if (document.body && localAction === "Block") {
      document.body.style.overflow = "auto";
    }
  };

  if (!isAction || !localAction) return null;

  if (localAction === "Block") {
    return (
      <div className="fixed inset-0 w-screen h-screen z-2147483647">
        <div className="animate-slide-down">
          <Block onClose={handleClose} />
        </div>
        <div className="absolute inset-0 bg-black/50 backdrop-blur-lg -z-10"></div>
      </div>
    );
  }

  if (localAction === "Warn") {
    return (
      <div className="fixed inset-0 w-screen h-screen z-2147483647 animate-slide-in-right pointer-events-none">
        <Warn onClose={handleClose} />
      </div>
    );
  }
}
