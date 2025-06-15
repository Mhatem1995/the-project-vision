
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
// Now import the rest of the app
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

createRoot(document.getElementById("root")!).render(<App />);
