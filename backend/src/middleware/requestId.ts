import type { RequestHandler } from "express";
import { randomUUID } from "node:crypto";

// Only honor an incoming correlation id if it is short, url-safe alphanumerics.
// Anything else (or nothing) gets a fresh server-generated UUID.
const SAFE_ID = /^[A-Za-z0-9_-]{8,64}$/;

export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.header("x-request-id");
  const id = incoming && SAFE_ID.test(incoming) ? incoming : randomUUID();
  res.locals.requestId = id;
  res.setHeader("x-request-id", id);
  next();
};
