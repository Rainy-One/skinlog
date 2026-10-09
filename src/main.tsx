import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./style.css";
import { registerSW } from "virtual:pwa-register";
registerSW({
  onNeedRefresh() {
    window.dispatchEvent(new Event("skinlog-update"));
  },
  onOfflineReady() {
    window.dispatchEvent(new Event("skinlog-offline"));
  },
});
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
