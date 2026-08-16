import { Router } from "express";
import { prisma } from "../lib/db";
import {
  listClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
} from "../services/clientService";
import { asyncHandler } from "../lib/errors";
import { parse } from "../lib/parse";
import { createClientSchema } from "../lib/validation";
import { Capability } from "../domain/capabilities";
import { requireCapability } from "../middleware/requireCapability";

const router = Router();

// Capability boundary: CLIENTS must be enabled for the workspace.
// (Global app middleware already enforces auth + password + workspace ACTIVE.)
router.use(requireCapability(Capability.CLIENTS));

const CLIENT_STATUSES = ["ACTIVE", "INACTIVE", "PROSPECT"] as const;

const updateClientSchema = createClientSchema.partial();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    if (status && !CLIENT_STATUSES.includes(status as (typeof CLIENT_STATUSES)[number])) {
      return res
        .status(400)
        .json({ error: { code: "validation_error", message: "status inválido" } });
    }
    const clients = await listClients(prisma, req.auth!.companyId, { status, search });
    res.json({ clients });
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const client = await getClient(prisma, req.auth!.companyId, req.params.id);
    res.json(client);
  }),
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = parse(createClientSchema, req.body);
    const client = await createClient(prisma, req.auth!.companyId, {
      name: input.name,
      brandColor: input.brandColor ?? undefined,
      status: input.status ?? "ACTIVE",
      primaryContactName: input.primaryContactName ?? undefined,
      primaryContactEmail: input.primaryContactEmail ?? undefined,
      primaryContactPhone: input.primaryContactPhone ?? undefined,
      channels: input.channels ?? [],
    });
    res.status(201).json(client);
  }),
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const input = parse(updateClientSchema, req.body);
    const client = await updateClient(prisma, req.auth!.companyId, req.params.id, input);
    res.json(client);
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await deleteClient(prisma, req.auth!.companyId, req.params.id);
    res.status(204).end();
  }),
);

export default router;
