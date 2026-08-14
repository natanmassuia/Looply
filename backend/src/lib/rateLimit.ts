import type { RequestHandler } from "express";
import { createHash } from "node:crypto";
import { tooManyRequests } from "./errors";

type Entry = { count: number; resetAt: number };
const entries = new Map<string, Entry>();

export function rateLimitKey(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function checkRateLimit(key: string, max: number, windowMs: number): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const current = entries.get(key);
  if (!current || current.resetAt <= now) {
    entries.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: Math.ceil(windowMs / 1000) };
  }
  current.count += 1;
  return { allowed: current.count <= max, retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
}

export function requestRateLimit(input: { name: string; max: number; windowMs: number; key: (req: Parameters<RequestHandler>[0]) => string }): RequestHandler {
  return (req, res, next) => {
    const result = checkRateLimit(`${input.name}:${rateLimitKey(input.key(req))}`, input.max, input.windowMs);
    if (!result.allowed) {
      res.setHeader("Retry-After", String(result.retryAfterSeconds));
      next(tooManyRequests());
      return;
    }
    next();
  };
}

export const PUBLIC_APPROVAL_WRITE_LIMIT = requestRateLimit({
  name: "approval-write",
  max: 20,
  windowMs: 15 * 60 * 1000,
  key: (req) => `${req.ip}:${req.params.token ?? "unknown"}`,
});

export const PUBLIC_APPROVAL_READ_LIMIT = requestRateLimit({
  name: "approval-read",
  max: 60,
  windowMs: 15 * 60 * 1000,
  key: (req) => `${req.ip}:${req.params.token ?? "unknown"}`,
});

export const INVITATION_ACCEPT_LIMIT = requestRateLimit({
  name: "invitation-accept",
  max: 20,
  windowMs: 15 * 60 * 1000,
  key: (req) => `${req.ip}:${typeof req.body?.token === "string" ? req.body.token : "missing"}`,
});
