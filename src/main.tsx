import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { markPerf } from "./perf/metrics";
import "./styles.css";

markPerf("app-bootstrap-start");

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

markPerf("app-bootstrap-end");
