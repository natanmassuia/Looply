import { Router } from "express";
import { getDashboard } from "../services/dashboardService";
import { asyncHandler } from "../lib/errors";

const router = Router();

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const data = await getDashboard();
    res.json(data);
  }),
);

export default router;
