import type { Request, Response, NextFunction } from "express";

export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "true";
}

/**
 * demoGuard — Protects against destructive mutations and account takeovers in DEMO_MODE.
 * Returns 403 Forbidden with: "Ação desativada no modo demonstração".
 */
export function demoGuard(_req: Request, res: Response, next: NextFunction) {
  if (isDemoMode()) {
    return res.status(403).json({
      error: "Ação desativada no modo demonstração",
      code: "DEMO_MODE_BLOCKED",
    });
  }
  next();
}
