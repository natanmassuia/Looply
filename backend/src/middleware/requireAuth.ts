import type { RequestHandler } from "express";
import { prisma } from "../lib/db";
import { unauthorized, forbidden } from "../lib/errors";
import { cookiesFromReq, SESSION_COOKIE } from "../lib/session";
import { resolveAuth, type AuthContext } from "../services/authService";

// Factory form (makeRequireAuth(db)) is used by unit tests with a fake DB.
export function makeRequireAuth(db: typeof prisma): RequestHandler {
  return (req, _res, next) => {
    const token = cookiesFromReq(req)[SESSION_COOKIE];
    resolveAuth(db, token)
      .then((result) => {
        if (!result) throw unauthorized();
        req.auth = result.auth;
        next();
      })
      .catch(next);
  };
}

export const requireAuth = makeRequireAuth(prisma);

// Company-level authorization primitive. Expands per domain battery.
export const requireRole =
  (...roles: string[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      next(forbidden());
      return;
    }
    next();
  };

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}
