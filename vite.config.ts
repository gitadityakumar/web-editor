import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { almostnodePlugin } from "almostnode/vite";

const SPRINTF_SOURCE_RE = /sprintf-js\/src\/sprintf\.js(?:\?.*)?$/;

function sprintfCompatPlugin() {
  return {
    name: "sprintf-compat-shim",
    enforce: "pre" as const,
    resolveId(source: string) {
      if (SPRINTF_SOURCE_RE.test(source)) {
        return "/src/shims/sprintf.ts";
      }
      return null;
    },
    load(id: string) {
      if (SPRINTF_SOURCE_RE.test(id)) {
        return 'export * from "/src/shims/sprintf.ts"; import d from "/src/shims/sprintf.ts"; export default d;';
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [sprintfCompatPlugin(), react(), tailwindcss(), almostnodePlugin()],
  resolve: {
    alias: {
      // almostnode transitively imports this file as ESM named exports, but sprintf-js ships CJS.
      "sprintf-js/src/sprintf.js": "/src/shims/sprintf.ts",
      "sprintf-js": "/src/shims/sprintf.ts",
      "node:zlib": "/src/shims/node-zlib.ts",
      zlib: "/src/shims/node-zlib.ts",
      "node:module": "/src/shims/node-module.ts",
      module: "/src/shims/node-module.ts",
    },
  },
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
