import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["tests/**/*.test.ts"],
    globalSetup: ["./tests/globalSetup.ts"],
    // The DB-gated suites share one real PostgreSQL database and the tenant
    // fixture provisions shared rows at runtime; running files sequentially
    // prevents cross-worker races on that shared state.
    fileParallelism: false,
  },
});
