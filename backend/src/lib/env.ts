import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";

// Load environment from repo root (.env), falling back to a local backend/.env.
// All npm scripts run with cwd = backend/, so "../.env" resolves to the repo root.
const candidates = [
  path.resolve(process.cwd(), "../.env"),
  path.resolve(process.cwd(), ".env"),
];
for (const p of candidates) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    break;
  }
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: Number(process.env.PORT ?? 4000),
  DATABASE_URL: process.env.DATABASE_URL,
  DEV_DEMO_USER: (process.env.DEV_DEMO_USER ?? "true").toLowerCase() === "true",
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  // Public frontend origin used to build client approval URLs (/approve/:token).
  PUBLIC_APP_URL: (process.env.PUBLIC_APP_URL ?? "http://localhost:5173").replace(/\/$/, ""),
};

export const isProd = env.NODE_ENV === "production";

// Fail fast on missing required runtime config. Called by server startup —
// NOT at import time, so unit tests can run without a live DB configured.
// Only vars the current code actually needs are required; future-battery
// vars (Redis, S3, email...) stay optional until their code lands.
// Read live from process.env so callers (and tests) can mutate the environment
// and re-run validation without reloading modules.
export function validateEnv(): void {
  const missing: string[] = [];
  if (!process.env.DATABASE_URL) missing.push("DATABASE_URL");
  const port = Number(process.env.PORT ?? env.PORT);
  if (!Number.isFinite(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid PORT: ${process.env.PORT}`);
  }
  const demoUser = (process.env.DEV_DEMO_USER ?? String(env.DEV_DEMO_USER)).toLowerCase() === "true";
  const nodeEnv = process.env.NODE_ENV ?? env.NODE_ENV;
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
  if (demoUser && nodeEnv === "production") {
    throw new Error("DEV_DEMO_USER must not be enabled in production");
  }
}
