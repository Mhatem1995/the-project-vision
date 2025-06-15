
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
// @ts-ignore
import { componentTagger } from "lovable-tagger";

// ---- Buffer global polyfill plugin ----
function bufferGlobalPolyfill() {
  return {
    name: "buffer-global-polyfill",
    enforce: "pre",
    transformIndexHtml(html) {
      return html.replace(
        "<head>",
        `<head>
        <script>
        // Ensure Buffer is available very early for all modules
        window.Buffer = window.Buffer || undefined;
        globalThis.Buffer = globalThis.Buffer || undefined;
        </script>`
      );
    },
    // Needed for some build cases (not all)
    transform(code, id) {
      if (id.endsWith("main.tsx")) {
        return `import { Buffer } from "buffer"; window.Buffer = Buffer; globalThis.Buffer = Buffer;\n${code}`;
      }
      return code;
    }
  };
}

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    bufferGlobalPolyfill(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      buffer: "buffer",
      stream: "stream-browserify",
      process: "process/browser",
    },
  },
  define: {
    global: "globalThis",
    process: "globalThis.process",
    // Avoid direct Buffer: "..." as this can break for UMD/CJS
  },
  optimizeDeps: {
    include: ["buffer", "process", "stream-browserify"],
    // esbuildOptions.plugins are intentionally omitted (see Vite docs)
  },
}));
