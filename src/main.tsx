
import { Buffer } from "buffer";
// Polyfill Buffer BEFORE anything else (including react, libraries)
if (typeof window !== "undefined" && !window.Buffer) {
  window.Buffer = Buffer;
}

import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

createRoot(document.getElementById("root")!).render(<App />);
