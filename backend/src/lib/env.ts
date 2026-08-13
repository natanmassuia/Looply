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
