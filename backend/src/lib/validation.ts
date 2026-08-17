import { z } from "zod";
import { APPEARANCE_MODES, APPEARANCE_PRESETS, HEX_COLOR_RE } from "../domain/appearance";

// Shared Zod schemas for request payloads. Keeps validation in one place.

export const uuidish = z.string().min(1).max(64);

export const createContentSchema = z.object({
  title: z.string().min(1).max(200),
  clientId: uuidish,
  format: z.enum(["POST", "REELS", "STORY", "CAROUSEL", "VIDEO", "IMAGE"]),
  channel: z.string().max(80).optional(),
  responsibleId: uuidish.optional(),
  publicationTarget: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
  // initial version payload
  caption: z.string().min(1).max(5000),
  mediaUrl: z.string().url().max(2000).optional().or(z.literal("")).optional(),
  mediaType: z.string().max(80).optional(),
});
export type CreateContentInput = z.infer<typeof createContentSchema>;

export const createVersionSchema = z.object({
  caption: z.string().min(1).max(5000),
  mediaUrl: z.string().url().max(2000).optional().or(z.literal("")).optional(),
  mediaType: z.string().max(80).optional(),
  changeNote: z.string().max(1000).optional(),
});
export type CreateVersionInput = z.infer<typeof createVersionSchema>;

export const scheduleSchema = z.object({
  scheduledAt: z.string().datetime(),
});
export type ScheduleInput = z.infer<typeof scheduleSchema>;

export const requestChangesSchema = z.object({
  feedback: z.string().min(1).max(5000),
  reviewerName: z.string().max(120).optional(),
});
export type RequestChangesInput = z.infer<typeof requestChangesSchema>;

export const approveSchema = z.object({
  reviewerName: z.string().max(120).optional(),
});
export type ApproveInput = z.infer<typeof approveSchema>;

export const createClientSchema = z.object({
  name: z.string().min(1).max(120),
  brandColor: z.string().max(20).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "PROSPECT"]).optional(),
  primaryContactName: z.string().max(120).optional(),
  primaryContactEmail: z.string().email().max(160).optional().or(z.literal("")).optional(),
  primaryContactPhone: z.string().max(40).optional(),
  channels: z.array(z.string().max(60)).max(10).optional(),
  logoUrl: z.string().max(2000).optional().or(z.literal("")).nullable(),
});
export type CreateClientInput = z.infer<typeof createClientSchema>;

// ── Workspace appearance (BP1) ───────────────────────────────────────────
// .strict() rejects any extra key — including forged tenant fields (e.g.
// companyId) and arbitrary color keys beyond the exact six base colors.

const hexColor = z.string().regex(HEX_COLOR_RE);

// F14: explicit `null` is a valid clear. The frontend always sends
// `customColors: null` when the selected preset is not CUSTOM, so the schema
// must accept both an object (set custom palette) and null (use preset colors).
export const customColorsSchema = z
  .union([
    z
      .object({
        primary: hexColor,
        secondary: hexColor,
        accent: hexColor,
        surface: hexColor,
        text: hexColor,
        border: hexColor,
      })
      .strict(),
    z.null(),
  ])
  .optional();

export const updateAppearanceSchema = z
  .object({
    preset: z.enum(APPEARANCE_PRESETS).optional(),
    mode: z.enum(APPEARANCE_MODES).optional(),
    customColors: customColorsSchema,
  })
  .strict();
export type UpdateAppearancePayload = z.infer<typeof updateAppearanceSchema>;
