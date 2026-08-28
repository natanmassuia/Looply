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
  HOST: process.env.HOST ?? "127.0.0.1",
  PORT: Number(process.env.PORT ?? 4000),
  DATABASE_URL: process.env.DATABASE_URL,
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  // Public frontend origin used to build client approval URLs (/approve/:token).
  PUBLIC_APP_URL: (process.env.PUBLIC_APP_URL ?? "http://localhost:5173").replace(/\/$/, ""),
  STORAGE_ENDPOINT: process.env.STORAGE_ENDPOINT,
  // Browser-reachable base for presigned URLs (Nginx-proxied S3 API). Falls
  // back to STORAGE_ENDPOINT when unset (single-host dev without a proxy).
  STORAGE_PUBLIC_ENDPOINT: process.env.STORAGE_PUBLIC_ENDPOINT,
  STORAGE_REGION: process.env.STORAGE_REGION ?? "us-east-1",
  STORAGE_BUCKET: process.env.STORAGE_BUCKET,
  STORAGE_ACCESS_KEY: process.env.STORAGE_ACCESS_KEY,
  STORAGE_SECRET_KEY: process.env.STORAGE_SECRET_KEY,
  STORAGE_FORCE_PATH_STYLE: (process.env.STORAGE_FORCE_PATH_STYLE ?? "false").toLowerCase() === "true",
  STORAGE_PRESIGN_TTL_SECONDS: Number(process.env.STORAGE_PRESIGN_TTL_SECONDS ?? 600),
  TRUST_PROXY: (process.env.TRUST_PROXY ?? "false").toLowerCase() === "true",
  REDIS_URL: process.env.REDIS_URL,
  WHATSAPP_VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN,
  WHATSAPP_APP_SECRET: process.env.WHATSAPP_APP_SECRET,
  WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN,
  WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID,
  GUPSHUP_API_KEY: process.env.GUPSHUP_API_KEY,
  GUPSHUP_APP_NAME: process.env.GUPSHUP_APP_NAME,
  GUPSHUP_SOURCE_NUMBER: process.env.GUPSHUP_SOURCE_NUMBER,
  GUPSHUP_WEBHOOK_IP_ALLOWLIST: process.env.GUPSHUP_WEBHOOK_IP_ALLOWLIST,
  ASSISTANT_LLM_BASE_URL: process.env.ASSISTANT_LLM_BASE_URL,
  ASSISTANT_LLM_API_KEY: process.env.ASSISTANT_LLM_API_KEY,
  ASSISTANT_LLM_MODEL: process.env.ASSISTANT_LLM_MODEL,
  AUDIO_TRANSCRIPTION_BASE_URL: process.env.AUDIO_TRANSCRIPTION_BASE_URL,
  AUDIO_TRANSCRIPTION_API_KEY: process.env.AUDIO_TRANSCRIPTION_API_KEY,
  AUDIO_TRANSCRIPTION_MODEL: process.env.AUDIO_TRANSCRIPTION_MODEL,
};

export const isProd = env.NODE_ENV === "production";

// A4 (auditoria): rejeita valores placeholder de segredos em produção.
const PLACEHOLDER_SECRET_RE =
  /change[ _-]?me|placeholder|example|dummy|password123|^password$|^secret$|^123456$/i;

const PRODUCTION_SECRET_KEYS = [
  "DATABASE_URL",
  "SEED_ADMIN_PASSWORD",
  "STORAGE_ACCESS_KEY",
  "STORAGE_SECRET_KEY",
  "REDIS_URL",
  "WHATSAPP_APP_SECRET",
  "WHATSAPP_VERIFY_TOKEN",
  "WHATSAPP_ACCESS_TOKEN",
  "GUPSHUP_API_KEY",
  "ASSISTANT_LLM_API_KEY",
  "AUDIO_TRANSCRIPTION_API_KEY",
  "RESEND_API_KEY",
] as const;

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

  const nodeEnv = process.env.NODE_ENV ?? env.NODE_ENV;
  if (nodeEnv === "production") {
    for (const key of PRODUCTION_SECRET_KEYS) {
      const val = process.env[key];
      if (typeof val === "string" && val.trim() !== "") {
        if (PLACEHOLDER_SECRET_RE.test(val)) {
          throw new Error(`[env] ${key} contém valor placeholder em produção`);
        }
      }
    }
  }
}
