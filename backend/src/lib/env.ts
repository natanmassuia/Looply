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
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  // Public frontend origin used to build client approval URLs (/approve/:token).
  PUBLIC_APP_URL: (process.env.PUBLIC_APP_URL ?? "http://localhost:5173").replace(/\/$/, ""),
  STORAGE_ENDPOINT: process.env.STORAGE_ENDPOINT,
  STORAGE_REGION: process.env.STORAGE_REGION ?? "us-east-1",
  STORAGE_BUCKET: process.env.STORAGE_BUCKET,
  STORAGE_ACCESS_KEY: process.env.STORAGE_ACCESS_KEY,
  STORAGE_SECRET_KEY: process.env.STORAGE_SECRET_KEY,
  STORAGE_FORCE_PATH_STYLE: (process.env.STORAGE_FORCE_PATH_STYLE ?? "false").toLowerCase() === "true",
  STORAGE_PRESIGN_TTL_SECONDS: Number(process.env.STORAGE_PRESIGN_TTL_SECONDS ?? 600),
  TRUST_PROXY: (process.env.TRUST_PROXY ?? "false").toLowerCase() === "true",
  REDIS_URL: process.env.REDIS_URL,
  ASSISTANT_LLM_BASE_URL: process.env.ASSISTANT_LLM_BASE_URL,
  ASSISTANT_LLM_API_KEY: process.env.ASSISTANT_LLM_API_KEY,
  ASSISTANT_LLM_MODEL: process.env.ASSISTANT_LLM_MODEL,
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
  if (env.CORS_ORIGIN === "*") throw new Error("CORS_ORIGIN must not be wildcard");
  if (!Number.isFinite(env.STORAGE_PRESIGN_TTL_SECONDS) || env.STORAGE_PRESIGN_TTL_SECONDS <= 0) {
    throw new Error("Invalid STORAGE_PRESIGN_TTL_SECONDS");
  }
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}
