import { Router } from "express";
import { prisma } from "../lib/db";

const router = Router();

// Lightweight health probe. Deliberately does NOT touch the DB so it remains a
// reliable liveness check even if the database is unreachable.
router.get("/", (_req, res) => {
  res.json({
    status: "ok",
    service: "looply-backend",
    time: new Date().toISOString(),
    db: prisma ? "configured" : "missing",
  });
});

// Readiness: can we actually serve requests? Runs one trivial DB round-trip.
router.get("/ready", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: "ready" });
  } catch {
    res.status(503).json({ status: "unavailable" });
  }
});

export default router;
