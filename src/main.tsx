import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/fonts.css";
import "./styles/tokens.css";
import "./styles/global.css";
import "./styles/components.css";
import "./styles/effects.css";
import "./styles/dashboard.css";
import "./styles/overhaul.css";
import "./styles/hq.css";
import "./styles/scene.css";
import "./styles/planner.css";
import "./styles/polish.css";
import "./styles/world.css";
import "./styles/import.css";
import "./styles/game3d.css";
import "./styles/characterCreator.css";
import "./styles/onboarding.css";
import "./styles/roomEditor.css";
import "./styles/campusDirectory.css";
import "./styles/prestige.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root not found");
}

// Installable, offline-capable app (production only — the dev server must always serve fresh files).
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Offline support is a bonus; the game works without it.
    });
  });
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
