// src/content.tsx
import { createRoot } from "react-dom/client";
import OverlayManager from "./components/OverlayManager";
import tailwindStyles from "./index.css?inline";

console.log("Distraction blocker content script loaded");

// Wait for DOM to be ready
function initializeExtension() {
  // Create the container for shadow DOM
  const container = document.createElement("div");
  container.id = "distraction-blocker-extension-root";

  // Attach shadow DOM for style isolation
  const shadowRoot = container.attachShadow({ mode: "open" });

  // Inject Tailwind CSS into shadow DOM
  const styleElement = document.createElement("style");
  styleElement.textContent = tailwindStyles;
  shadowRoot.appendChild(styleElement);

  // Create a div inside shadow DOM for React to render into
  const shadowContainer = document.createElement("div");
  shadowRoot.appendChild(shadowContainer);

  // Append to body
  document.body.appendChild(container);

  // Render React app into shadow DOM
  const root = createRoot(shadowContainer);
  root.render(<OverlayManager />);
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeExtension);
} else {
  initializeExtension();
}
