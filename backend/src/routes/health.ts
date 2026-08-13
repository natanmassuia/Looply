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

export default router;
