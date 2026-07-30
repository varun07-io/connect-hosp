import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const API_TARGET = process.env.API_PROXY_TARGET ?? "http://localhost:4000";

/** Backend paths the API owns. Proxying them lets the frontend call the API
 *  same-origin (VITE_API_URL="") — which removes CORS entirely and, for shared
 *  previews, means one tunnel instead of two (see README). */
const apiProxy = {
  "/api": { target: API_TARGET, changeOrigin: true },
  "/health": { target: API_TARGET, changeOrigin: true },
  "/files": { target: API_TARGET, changeOrigin: true },
};

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Split heavy third-party code out of the app chunk. Two wins: the
        // browser can fetch them in parallel, and they keep their cache across
        // app deploys instead of being invalidated by every code change.
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          firebase: ["firebase/app", "firebase/auth"],
          query: ["@tanstack/react-query"],
          ui: [
            "@radix-ui/react-avatar",
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-label",
            "@radix-ui/react-select",
            "@radix-ui/react-separator",
            "@radix-ui/react-tabs",
            "@radix-ui/react-toast",
          ],
        },
      },
    },
  },
  server: {
    port: 5173,
    // Vite blocks unrecognized Host headers by default (DNS-rebinding
    // protection) — the tunnel used for client previews (see README) puts a
    // *.trycloudflare.com Host header on every request, so it needs to be
    // allow-listed explicitly. Harmless for normal local dev.
    allowedHosts: [".trycloudflare.com"],
    proxy: apiProxy,
  },
  preview: {
    port: 5173,
    allowedHosts: [".trycloudflare.com"],
    proxy: apiProxy,
  },
});
