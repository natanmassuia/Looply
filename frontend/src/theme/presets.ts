import type { AppearanceMode } from "../lib/types";
import type { SemanticTokens } from "./types";
import { darken, lighten } from "./color";

// Canonical Looply Human Relay brand base (figma node 19:2, "Looply / Foundations").
export const BRAND = {
  aubergine950: "#2A171F",
  coral500: "#F06D55",
  coral600: "#D95B47",
  amber400: "#F3B84B",
  coral100: "#FFE3D7",
  cream100: "#FFF7F1",
} as const;

// Status roles are preset-independent; only the mode shifts their luminance so
// dark surfaces keep readable, saturated status colors.
const STATUS_LIGHT = {
  statusSuccess: "#059669",
  statusWarning: "#B45309",
  statusDanger: "#DC2626",
  statusInfo: "#7C5C6B",
} as const;

const STATUS_DARK = {
  statusSuccess: "#34D399",
  statusWarning: "#FBBF24",
  statusDanger: "#F87171",
  statusInfo: "#C9A2B4",
} as const;

type StatusTokens = {
  statusSuccess: string;
  statusWarning: string;
  statusDanger: string;
  statusInfo: string;
};
type BaseTokens = Omit<SemanticTokens, keyof StatusTokens>;

function compose(base: BaseTokens, status: StatusTokens): SemanticTokens {
  return { ...base, ...status };
}

// AURA — canonical Looply Human Relay. Literal values (must match index.css
// static startup state so pre-auth and post-auth render identically).
const AURA_LIGHT: BaseTokens = {
  bgCanvas: "#FFF7F1",
  bgSurface: "#FFFFFF",
  bgSubtle: "#F8ECE5",
  textPrimary: "#2A171F",
  textSecondary: "#514146",
  textMuted: "#6D5A5D",
  textInverse: "#FFFDFC",
  textBrand: "#B94738",
  borderDefault: "#E8D8D1",
  borderBrand: "#F06D55",
  actionPrimary: "#F06D55",
  actionPrimaryHover: "#D95B47",
  actionPrimaryActive: "#C8503B",
  actionSecondary: "#F3B84B",
  focusRing: "#E0563F",
};

const AURA_DARK: BaseTokens = {
  bgCanvas: "#2A171F",
  bgSurface: "#34202A",
  bgSubtle: "#3D2731",
  textPrimary: "#FFFDFC",
  textSecondary: "#E8D8D1",
  textMuted: "#B7A4A9",
  textInverse: "#2A171F",
  textBrand: "#F58A75",
  borderDefault: "#5B434C",
  borderBrand: "#F06D55",
  actionPrimary: "#F06D55",
  actionPrimaryHover: "#F58470",
  actionPrimaryActive: "#FF9B82",
  actionSecondary: "#F3B84B",
  focusRing: "#F06D55",
};

// FLUX — provisional warm/amber-forward derivation. No exact figma values exist
// in the repo yet; F12 reconciles these against the figma variable set.
const FLUX_LIGHT: BaseTokens = {
  bgCanvas: "#FCF5EC",
  bgSurface: "#FFFFFF",
  bgSubtle: "#F6E8D9",
  textPrimary: "#3A2418",
  textSecondary: "#5F4A3B",
  textMuted: "#7D6456",
  textInverse: "#FFFDFC",
  textBrand: "#C2502E",
  borderDefault: "#EAD7C6",
  borderBrand: "#F3B84B",
  actionPrimary: "#F06D55",
  actionPrimaryHover: darken("#F06D55", 0.12),
  actionPrimaryActive: darken("#F06D55", 0.22),
  actionSecondary: "#F3B84B",
  focusRing: "#E0563F",
};

const FLUX_DARK: BaseTokens = {
  bgCanvas: "#241710",
  bgSurface: "#2E1F16",
  bgSubtle: "#3A281C",
  textPrimary: "#FFF7F1",
  textSecondary: "#EAD7C6",
  textMuted: "#C6AD9E",
  textInverse: "#241710",
  textBrand: "#F58A75",
  borderDefault: "#5C4436",
  borderBrand: "#F3B84B",
  actionPrimary: "#F06D55",
  actionPrimaryHover: lighten("#F06D55", 0.12),
  actionPrimaryActive: lighten("#F06D55", 0.22),
  actionSecondary: "#F3B84B",
  focusRing: "#F06D55",
};

// PULSE — provisional aubergine-forward high-contrast derivation (same caveat).
const PULSE_LIGHT: BaseTokens = {
  bgCanvas: "#F8F1F4",
  bgSurface: "#FFFFFF",
  bgSubtle: "#EFE1E7",
  textPrimary: "#2A171F",
  textSecondary: "#4A353E",
  textMuted: "#6D5A63",
  textInverse: "#FFFDFC",
  textBrand: "#B94738",
  borderDefault: "#E3D4DC",
  borderBrand: "#B94738",
  actionPrimary: "#2A171F",
  actionPrimaryHover: darken("#2A171F", 0.12),
  actionPrimaryActive: darken("#2A171F", 0.22),
  actionSecondary: "#F3B84B",
  focusRing: "#B94738",
};

const PULSE_DARK: BaseTokens = {
  bgCanvas: "#1C1116",
  bgSurface: "#2A171F",
  bgSubtle: "#3D2731",
  textPrimary: "#FFFDFC",
  textSecondary: "#E3D4DC",
  textMuted: "#B9A6AE",
  textInverse: "#2A171F",
  textBrand: "#F58A75",
  borderDefault: "#5B434C",
  borderBrand: "#F58A75",
  actionPrimary: "#F3B84B",
  actionPrimaryHover: lighten("#F3B84B", 0.12),
  actionPrimaryActive: lighten("#F3B84B", 0.22),
  actionSecondary: "#F58A75",
  focusRing: "#F3B84B",
};

const PRESETS = {
  AURA: { LIGHT: AURA_LIGHT, DARK: AURA_DARK },
  FLUX: { LIGHT: FLUX_LIGHT, DARK: FLUX_DARK },
  PULSE: { LIGHT: PULSE_LIGHT, DARK: PULSE_DARK },
} as const;

export type StaticPreset = "AURA" | "FLUX" | "PULSE";

export function resolvePresetTokens(preset: StaticPreset, mode: AppearanceMode): SemanticTokens {
  const status = mode === "DARK" ? STATUS_DARK : STATUS_LIGHT;
  const base = PRESETS[preset][mode];
  return compose(base, status);
}

export function isStaticPreset(value: unknown): value is StaticPreset {
  return value === "AURA" || value === "FLUX" || value === "PULSE";
}

export function isAppearanceMode(value: unknown): value is AppearanceMode {
  return value === "LIGHT" || value === "DARK";
}