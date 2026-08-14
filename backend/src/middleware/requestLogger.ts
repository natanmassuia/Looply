import type { RequestHandler } from "express";
import { logger } from "../lib/logger";

// One line per request: method, path (no query string — query may carry tokens),
// status, duration and the correlation id.
export const requestLogger: RequestHandler = (req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    logger.info("request", {
      requestId: res.locals.requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - start,
    });
  });
  next();
};
