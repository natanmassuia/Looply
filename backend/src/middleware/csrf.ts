import type { RequestHandler } from "express";
import { forbidden } from "../lib/errors";
import { env } from "../lib/env";

// Cookie-authenticated unsafe requests must come from the configured web
// origin. Requests without Origin/Referer remain allowed for curl/CLI clients.
// Public approval token routes are bearer-token authenticated and do not use
// the session cookie, so they are intentionally outside this check.
export const csrfOriginGuard: RequestHandler = (req, _res, next) => {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    next();
    return;
  }
  if (req.path.startsWith("/api/public/approvals")) {
    next();
    return;
  }
  const value = req.get("origin") ?? req.get("referer");
  if (!value) {
    next();
    return;
  }
  try {
    if (new URL(value).origin !== new URL(env.CORS_ORIGIN).origin) {
      next(forbidden("Origem não autorizada"));
      return;
    }
  } catch {
    next(forbidden("Origem não autorizada"));
    return;
  }
  next();
};
