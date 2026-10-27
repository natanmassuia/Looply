import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/db";
import { getObjectStorage } from "../lib/storage";
import { asyncHandler, forbidden, badRequest } from "../lib/errors";
import { parse } from "../lib/parse";
import {
  createUserAvatarIntent,
  completeUserAvatarUpload,
  deleteUserAvatar,
  createCompanyLogoIntent,
  completeCompanyLogoUpload,
  deleteCompanyLogo,
  createClientLogoIntent,
  completeClientLogoUpload,
  deleteClientLogo,
  createContactAvatarIntent,
  completeContactAvatarUpload,
  deleteContactAvatar,
  resolveMediaDownloadUrl,
} from "../services/identityMediaService";

const router = Router();

const intentSchema = z.object({
  contentType: z.string().min(1).max(100),
  sizeBytes: z.number().int().positive(),
  originalName: z.string().max(255).optional(),
});

const completeSchema = z.object({
  key: z.string().min(1).max(500),
});

function requireAdminOrOwner(req: any) {
  const role = req.auth?.role;
  if (role !== "OWNER" && role !== "ADMIN") {
    throw forbidden("Apenas administradores podem gerenciar os dados da empresa");
  }
}

// ── 0. MEDIA RESOLVE / SERVING ─────────────────────────────────────────────

router.get("/media/file", asyncHandler(async (req, res) => {
  const key = req.query.key;
  if (typeof key !== "string" || !key) {
    throw badRequest("Parâmetro 'key' é obrigatório");
  }

  const result = await resolveMediaDownloadUrl(prisma, getObjectStorage(), req.auth!, key);
  res.setHeader("Cache-Control", "private, max-age=300");
  res.redirect(302, result.url);
}));

// ── 1. USER AVATAR ─────────────────────────────────────────────────────────

router.post("/me/avatar/upload-intent", asyncHandler(async (req, res) => {
  const input = parse(intentSchema, req.body);
  const result = await createUserAvatarIntent(getObjectStorage(), req.auth!.userId, input);
  res.status(201).json(result);
}));

router.post("/me/avatar/complete", asyncHandler(async (req, res) => {
  const { key } = parse(completeSchema, req.body);
  const user = await completeUserAvatarUpload(prisma, getObjectStorage(), req.auth!.userId, key);
  res.json({ user });
}));

router.delete("/me/avatar", asyncHandler(async (req, res) => {
  const user = await deleteUserAvatar(prisma, getObjectStorage(), req.auth!.userId);
  res.json({ ok: true, user });
}));

// ── 2. COMPANY LOGO ────────────────────────────────────────────────────────

router.post("/settings/company/logo/upload-intent", asyncHandler(async (req, res) => {
  requireAdminOrOwner(req);
  const input = parse(intentSchema, req.body);
  const result = await createCompanyLogoIntent(getObjectStorage(), req.auth!.companyId, input);
  res.status(201).json(result);
}));

router.post("/settings/company/logo/complete", asyncHandler(async (req, res) => {
  requireAdminOrOwner(req);
  const { key } = parse(completeSchema, req.body);
  const company = await completeCompanyLogoUpload(prisma, getObjectStorage(), req.auth!.companyId, key);
  res.json({ company });
}));

router.delete("/settings/company/logo", asyncHandler(async (req, res) => {
  requireAdminOrOwner(req);
  const company = await deleteCompanyLogo(prisma, getObjectStorage(), req.auth!.companyId);
  res.json({ ok: true, company });
}));

// ── 3. CLIENT LOGO ─────────────────────────────────────────────────────────

router.post("/clients/:id/logo/upload-intent", asyncHandler(async (req, res) => {
  const input = parse(intentSchema, req.body);
  const result = await createClientLogoIntent(prisma, getObjectStorage(), req.auth!.companyId, req.params.id, input);
  res.status(201).json(result);
}));

router.post("/clients/:id/logo/complete", asyncHandler(async (req, res) => {
  const { key } = parse(completeSchema, req.body);
  const client = await completeClientLogoUpload(prisma, getObjectStorage(), req.auth!.companyId, req.params.id, key);
  res.json({ client });
}));

router.delete("/clients/:id/logo", asyncHandler(async (req, res) => {
  const client = await deleteClientLogo(prisma, getObjectStorage(), req.auth!.companyId, req.params.id);
  res.json({ ok: true, client });
}));

// ── 4. CONVERSATION CONTACT AVATAR (manual; WhatsApp sends no profile photo) ─

router.post("/conversations/:id/avatar/upload-intent", asyncHandler(async (req, res) => {
  const input = parse(intentSchema, req.body);
  const result = await createContactAvatarIntent(prisma, getObjectStorage(), req.auth!.companyId, req.params.id, input);
  res.status(201).json(result);
}));

router.post("/conversations/:id/avatar/complete", asyncHandler(async (req, res) => {
  const { key } = parse(completeSchema, req.body);
  const conversation = await completeContactAvatarUpload(prisma, getObjectStorage(), req.auth!.companyId, req.params.id, key);
  res.json({ conversation });
}));

router.delete("/conversations/:id/avatar", asyncHandler(async (req, res) => {
  const conversation = await deleteContactAvatar(prisma, getObjectStorage(), req.auth!.companyId, req.params.id);
  res.json({ ok: true, conversation });
}));

export default router;
