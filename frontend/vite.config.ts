import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev: proxy API + health to the backend so the SPA can use relative URLs.
export default defineConfig({
  envDir: "..",
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:4000", changeOrigin: true },
      "/health": { target: "http://localhost:4000", changeOrigin: true },
    },
  },
});
