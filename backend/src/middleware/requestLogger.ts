import type { RequestHandler } from "express";
import { logger } from "../lib/logger";

// One line per request: method, path (no query string — query may carry tokens),
// status, duration and the correlation id.
export const requestLogger: RequestHandler = (req, res, next) => {
  const start = Date.now();
  const path = req.path.replace(
    /\/api\/public\/approvals\/[^/]+/g,
    "/api/public/approvals/[redacted]",
  );
  res.on("finish", () => {
    logger.info("request", {
      requestId: res.locals.requestId,
      // companyId is populated by requireAuth from the authenticated session
      // context; absent for unauthenticated/public requests.
      companyId: res.locals.companyId,
      method: req.method,
      path,
      status: res.statusCode,
      durationMs: Date.now() - start,
    });
  });
  next();
};
