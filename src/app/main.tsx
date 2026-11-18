import React from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/dm-sans/wght.css";
import "@fontsource-variable/manrope/wght.css";
import App from "./HawaApp";
import "./styles.css";
import "./styles-v2.css";
import "./styles-schedule.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () =>
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* Online app remains usable. */
    }),
  );
}
