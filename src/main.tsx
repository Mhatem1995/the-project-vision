
/* ---- POLYFILL: Ensure Buffer is globally available ---- */
import { Buffer } from "buffer";
if (typeof window !== "undefined") {
  window.Buffer = Buffer;
}
if (typeof globalThis !== "undefined") {
  globalThis.Buffer = Buffer;
}
console.log("[Polyfill] Buffer is", typeof Buffer, "globalThis.Buffer is", typeof globalThis.Buffer, "window.Buffer is", typeof window !== "undefined" ? typeof window.Buffer : "no window");

/* ---- Application Entrypoint ---- */
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
// New import for error boundary
import ErrorBoundary from "./components/ErrorBoundary";

const rootEl = document.getElementById("root");
if (!rootEl) {
  console.error("[main.tsx] root element not found!");
} else {
  console.log("[main.tsx] Found root element, rendering...");
  createRoot(rootEl).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
