import type {
  AppearanceMode,
  AppearancePreset,
  CustomColors,
  WorkspaceAppearance,
} from "../lib/types";
import type { ResolvedTheme, SemanticTokens } from "./types";
import {
  BRAND,
  isAppearanceMode,
  isStaticPreset,
  resolvePresetTokens,
} from "./presets";
import {
  contrastRatio,
  darken,
  isHexColor,
  lighten,
  mix,
  relativeLuminance,
} from "./color";

export const DEFAULT_APPEARANCE: WorkspaceAppearance = {
  preset: "AURA",
  mode: "LIGHT",
  customColors: null,
};

const CUSTOM_KEYS = ["primary", "secondary", "accent", "surface", "text", "border"] as const;

function normalizeCustomColors(input: unknown): CustomColors | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const record = input as Record<string, unknown>;
  const next: Partial<Record<(typeof CUSTOM_KEYS)[number], string>> = {};
  for (const key of CUSTOM_KEYS) {
    const value = record[key];
    if (!isHexColor(value)) return null;
    next[key] = value.toUpperCase();
  }
  return next as CustomColors;
}

// Defensive coercion of whatever the server (or a stale cache) hands us.
// Unknown/missing/malformed input always collapses to the deterministic
// AURA/LIGHT default — never throws, never applies arbitrary keys.
export function normalizeAppearance(input: unknown): WorkspaceAppearance {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ...DEFAULT_APPEARANCE };
  }
  const record = input as Record<string, unknown>;
  const mode: AppearanceMode = isAppearanceMode(record.mode) ? record.mode : "LIGHT";
  let preset: AppearancePreset = isStaticPreset(record.preset) ? record.preset : "AURA";
  let customColors: CustomColors | null = null;
  if (record.preset === "CUSTOM") {
    const colors = normalizeCustomColors(record.customColors);
    if (colors) {
      preset = "CUSTOM";
      customColors = colors;
    }
  }
  return { preset, mode, customColors };
}

export function resolveTheme(input?: unknown): ResolvedTheme {
  const appearance = normalizeAppearance(input);
  const preset: "AURA" | "FLUX" | "PULSE" =
    appearance.preset === "CUSTOM" ? "AURA" : appearance.preset;
  const tokens =
    appearance.preset === "CUSTOM" && appearance.customColors
      ? resolveCustomTheme(appearance.customColors, appearance.mode)
      : resolvePresetTokens(preset, appearance.mode);
  return { preset: appearance.preset, mode: appearance.mode, tokens };
}

// ── CUSTOM palette mapping ──────────────────────────────────────────────────
// Six client-supplied colors → the full semantic set, with deterministic
// contrast correction so any palette stays readable on canvas AND surface.
// The input is never mutated; roles are derived, never copied blindly.
export function resolveCustomTheme(base: CustomColors, mode: AppearanceMode): SemanticTokens {
  const light = mode === "LIGHT";
  const surface = base.surface;
  const canvas = light ? mix(surface, BRAND.cream100, 0.62) : mix(surface, BRAND.aubergine950, 0.55);
  const subtle = mix(canvas, surface, 0.5);

  const bgs = [canvas, surface];
  const towardLight = relativeLuminance(canvas) < 0.5;

  function ensureVsBoth(color: string, target: number): string {
    let current = color;
    for (let i = 0; i < 12; i++) {
      if (bgs.every((bg) => contrastRatio(current, bg) >= target)) return current;
      current = towardLight ? lighten(current, 0.12) : darken(current, 0.12);
    }
    return towardLight ? "#FFFFFF" : "#000000";
  }

  const textPrimary = ensureVsBoth(base.text, 4.5);
  const textSecondary = ensureVsBoth(mix(textPrimary, canvas, light ? 0.34 : 0.3), 4.5);
  const textMuted = ensureVsBoth(mix(textPrimary, canvas, light ? 0.55 : 0.48), 3.0);
  const textBrand = ensureVsBoth(base.primary, 4.5);
  const borderDefault = ensureVsBoth(base.border, 1.6);
  const borderBrand = base.primary;

  let actionPrimary = ensureVsBoth(base.primary, 3.0);
  const textInverse = pickInverse(actionPrimary);
  if (contrastRatio(textInverse, actionPrimary) < 3.0) {
    // Pathological primary — anchor to the brand action color (deterministic).
    actionPrimary = BRAND.coral500;
  }
  const actionPrimaryHover = ensureVsBoth(
    light ? darken(actionPrimary, 0.12) : lighten(actionPrimary, 0.12),
    3.0,
  );
  const actionPrimaryActive = ensureVsBoth(
    light ? darken(actionPrimary, 0.22) : lighten(actionPrimary, 0.22),
    3.0,
  );
  const actionSecondary = ensureVsBoth(base.accent, 3.0);
  const focusRing = ensureVsBoth(base.accent, 3.0);

  const status =
    mode === "DARK"
      ? {
          statusSuccess: "#34D399",
          statusWarning: "#FBBF24",
          statusDanger: "#F87171",
          statusInfo: "#C9A2B4",
        }
      : {
          statusSuccess: "#059669",
          statusWarning: "#B45309",
          statusDanger: "#DC2626",
          statusInfo: "#7C5C6B",
        };

  return {
    bgCanvas: canvas,
    bgSurface: surface,
    bgSubtle: subtle,
    textPrimary,
    textSecondary,
    textMuted,
    textInverse,
    textBrand,
    borderDefault,
    borderBrand,
    actionPrimary,
    actionPrimaryHover,
    actionPrimaryActive,
    actionSecondary,
    focusRing,
    ...status,
  };
}

function pickInverse(bg: string): string {
  const white = "#FFFDFC";
  const ink = BRAND.aubergine950;
  const rWhite = contrastRatio(white, bg);
  const rInk = contrastRatio(ink, bg);
  if (rWhite >= 4.5 && rInk >= 4.5) return rWhite >= rInk ? white : ink;
  if (rWhite >= 4.5) return white;
  if (rInk >= 4.5) return ink;
  return rWhite >= rInk ? white : ink;
}