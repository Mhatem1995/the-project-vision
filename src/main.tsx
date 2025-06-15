
import { Buffer } from "buffer";

// Polyfill Buffer globally BEFORE anything else (including react, other libraries)
if (typeof window !== "undefined" && !window.Buffer) {
  window.Buffer = Buffer;
}
if (typeof globalThis !== "undefined" && !globalThis.Buffer) {
  globalThis.Buffer = Buffer;
}

// Now import the rest of the app
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

createRoot(document.getElementById("root")!).render(<App />);
