// @ts-nocheck
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execSync } from "child_process";
import pkg from "./package.json";

const commitHash = (() => {
  if (process.env.GIT_COMMIT) return process.env.GIT_COMMIT;
  try {
    return execSync("git rev-parse --short HEAD", { timeout: 1000 }).toString().trim();
  } catch {
    return "dev";
  }
})();

const buildTime = new Date().toISOString();

// Dev: proxy API + health to the backend so the SPA can use relative URLs.
export default defineConfig({
  envDir: "..",
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version || "0.1.0"),
    __COMMIT_HASH__: JSON.stringify(commitHash),
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:4000", changeOrigin: true },
      "/health": { target: "http://localhost:4000", changeOrigin: true },
    },
  },
});
