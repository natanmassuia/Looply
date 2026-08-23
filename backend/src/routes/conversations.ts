import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/db";
import { asyncHandler } from "../lib/errors";
import { parse } from "../lib/parse";
import {
  bindConversationClient,
  getConversation,
  listConversations,
  listMessages,
  markConversationRead,
  setConversationAiStatus,
} from "../services/conversationService";
import type { DB } from "../lib/db";
import type { ObjectStorage } from "../lib/storage";

// ── Conversations Router (F15.2) ──────────────────────────────────────────
// Read-only + state management API for AI Inbox. All routes inherit session
// authentication, workspace active check, and tenant scoping (req.auth.companyId).

const aiStatusSchema = z.enum(["ACTIVE", "PAUSED", "NEEDS_ATTENTION"]);

const listConversationsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().max(200).optional(),
  aiStatus: aiStatusSchema.optional(),
});

const listMessagesQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const updateAiStatusSchema = z.object({
  aiStatus: aiStatusSchema,
}).strict();

const updateClientBindingSchema = z.object({
  clientId: z.string().min(1).max(64).nullable(),
}).strict();

export function makeConversationsRouter(db: DB, deps?: { storage?: ObjectStorage }) {
  const router = Router();

  // GET /api/conversations — List conversations in active workspace
  router.get("/", asyncHandler(async (req, res) => {
    const query = parse(listConversationsQuerySchema, req.query);
    const result = await listConversations(db, req.auth!.companyId, query);
    res.json(result);
  }));

  // GET /api/conversations/:id — Get conversation detail
  router.get("/:id", asyncHandler(async (req, res) => {
    const conversation = await getConversation(db, req.auth!.companyId, req.params.id);
    res.json(conversation);
  }));

  // GET /api/conversations/:id/messages — List conversation messages
  router.get("/:id/messages", asyncHandler(async (req, res) => {
    const query = parse(listMessagesQuerySchema, req.query);
    const result = await listMessages(db, req.auth!.companyId, req.params.id, query);
    res.json(result);
  }));

  // PATCH /api/conversations/:id/read — Mark conversation as read (unreadCount = 0)
  router.patch("/:id/read", asyncHandler(async (req, res) => {
    const result = await markConversationRead(db, req.auth!.companyId, req.params.id);
    res.json(result);
  }));

  // PATCH /api/conversations/:id/ai-status — Update AI status (ACTIVE / PAUSED / NEEDS_ATTENTION)
  router.patch("/:id/ai-status", asyncHandler(async (req, res) => {
    const input = parse(updateAiStatusSchema, req.body);
    const updated = await setConversationAiStatus(db, req.auth!.companyId, req.params.id, input.aiStatus);
    res.json(updated);
  }));

  // PATCH /api/conversations/:id/client — Bind or unbind client
  router.patch("/:id/client", asyncHandler(async (req, res) => {
    const input = parse(updateClientBindingSchema, req.body);
    const updated = await bindConversationClient(db, req.auth!.companyId, req.params.id, input.clientId);
    res.json(updated);
  }));

  // GET /api/conversations/:id/messages/:messageId/media — Presigned download/playback URL for message media
  router.get("/:id/messages/:messageId/media", asyncHandler(async (req, res) => {
    const msg = await db.conversationMessage.findFirst({
      where: {
        id: req.params.messageId,
        conversationId: req.params.id,
        companyId: req.auth!.companyId,
      },
      select: {
        mediaStorageKey: true,
        mediaFilename: true,
        mediaMimeType: true,
      },
    });
    if (!msg || !msg.mediaStorageKey) {
      res.status(404).json({ error: { code: "not_found", message: "Mídia não encontrada" } });
      return;
    }
    const { getObjectStorage } = await import("../lib/storage");
    const storage = deps?.storage ?? getObjectStorage();
    const download = await storage.createDownloadUrl({
      key: msg.mediaStorageKey,
      filename: msg.mediaFilename || "audio.ogg",
    });
    res.redirect(download.url);
  }));

  return router;
}

export default makeConversationsRouter(prisma);
