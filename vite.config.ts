
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
// @ts-ignore
import { componentTagger } from "lovable-tagger";
// NOTE: Remove esbuild-polyfill plugins because of type errors and no real necessity on Vite 4+

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
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
  },
  optimizeDeps: {
    include: ["buffer", "process", "stream-browserify"],
    // REMOVE esbuildOptions.plugins to resolve typescript conflict!
    // No esbuild plugins here!
  },
}));
