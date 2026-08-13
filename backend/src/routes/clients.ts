import { Router } from "express";
import { prisma } from "../lib/db";
import { listClients, getClient, createClient } from "../services/clientService";
import { asyncHandler } from "../lib/errors";
import { parse } from "../lib/parse";
import { createClientSchema } from "../lib/validation";

const router = Router();

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const clients = await listClients(prisma);
    res.json({ clients });
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const client = await getClient(prisma, req.params.id);
    res.json(client);
  }),
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = parse(createClientSchema, req.body);
    const client = await createClient(prisma, {
      name: input.name,
      brandColor: input.brandColor ?? undefined,
      status: input.status ?? "ACTIVE",
      primaryContactName: input.primaryContactName ?? null,
      primaryContactEmail: input.primaryContactEmail ?? null,
      primaryContactPhone: input.primaryContactPhone ?? null,
      channels: input.channels ?? [],
    });
    res.status(201).json(client);
  }),
);

export default router;
