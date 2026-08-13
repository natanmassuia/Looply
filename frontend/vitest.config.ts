import { defineConfig } from "vitest/config";

// Separate test config so Vite (build) and Vitest don't fight over Vite versions.
export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
});
