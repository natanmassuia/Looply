import type { AppearanceMode, AppearancePreset } from "../lib/types";

// Single vocabulary for the semantic theme runtime. Order is stable and is the
// sole source of truth for what may be applied to the DOM at runtime — the
// applier writes ONLY the CSS variables listed here (never arbitrary keys).
export const SEMANTIC_TOKEN_IDS = [
  "bgCanvas",
  "bgSurface",
  "bgSubtle",
  "textPrimary",
  "textSecondary",
  "textMuted",
  "textInverse",
  "textBrand",
  "borderDefault",
  "borderBrand",
  "actionPrimary",
  "actionPrimaryHover",
  "actionPrimaryActive",
  "actionSecondary",
  "focusRing",
  "statusSuccess",
  "statusWarning",
  "statusDanger",
  "statusInfo",
] as const;

export type SemanticTokenId = (typeof SEMANTIC_TOKEN_IDS)[number];
export type SemanticTokens = { [K in SemanticTokenId]: string };

export const TOKEN_CSS_VARS: Record<SemanticTokenId, string> = {
  bgCanvas: "--looply-color-bg-canvas",
  bgSurface: "--looply-color-bg-surface",
  bgSubtle: "--looply-color-bg-subtle",
  textPrimary: "--looply-color-text-primary",
  textSecondary: "--looply-color-text-secondary",
  textMuted: "--looply-color-text-muted",
  textInverse: "--looply-color-text-inverse",
  textBrand: "--looply-color-text-brand",
  borderDefault: "--looply-color-border-default",
  borderBrand: "--looply-color-border-brand",
  actionPrimary: "--looply-color-action-primary",
  actionPrimaryHover: "--looply-color-action-primary-hover",
  actionPrimaryActive: "--looply-color-action-primary-active",
  actionSecondary: "--looply-color-action-secondary",
  focusRing: "--looply-color-focus-ring",
  statusSuccess: "--looply-color-status-success",
  statusWarning: "--looply-color-status-warning",
  statusDanger: "--looply-color-status-danger",
  statusInfo: "--looply-color-status-info",
};

// Static brand base tokens defined in index.css (not overridden at runtime).
export const BRAND_TOKEN_CSS_VARS = {
  aubergine950: "--looply-color-aubergine-950",
  coral500: "--looply-color-coral-500",
  coral600: "--looply-color-coral-600",
  amber400: "--looply-color-amber-400",
  coral100: "--looply-color-coral-100",
  cream100: "--looply-color-cream-100",
} as const;

export interface ResolvedTheme {
  preset: AppearancePreset;
  mode: AppearanceMode;
  tokens: SemanticTokens;
}