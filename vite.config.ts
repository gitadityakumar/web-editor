import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { almostnodePlugin } from "almostnode/vite";

export default defineConfig({
  plugins: [react(), almostnodePlugin()],
  optimizeDeps: {
    // Avoid esbuild prebundle issues with top-level await in almostnode transitive deps.
    exclude: ["almostnode", "just-bash"],
    esbuildOptions: {
      target: "esnext",
    },
  },
  esbuild: {
    target: "esnext",
  },
  build: {
    target: "esnext",
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          monaco: ["@monaco-editor/react", "monaco-editor"],
        },
      },
    },
  },
});
