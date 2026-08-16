// Workspace appearance (BP1). Canonical product vocabulary, shared by the
// persistence service and the WorkspaceContext contract. The backend only
// stores the workspace's CHOICE — theme derivation / CSS stays on the frontend
// (F1 Semantic+Theme runtime).
//
// V1 six base colors (stable contract): primary, secondary, accent, surface,
// text, border. Exact six keys, no arbitrary extra keys. Values are #RRGGBB
// hex, stored uppercase. Only the CUSTOM preset carries custom colors.

export const APPEARANCE_PRESETS = ["AURA", "FLUX", "PULSE", "CUSTOM"] as const;
export type AppearancePreset = (typeof APPEARANCE_PRESETS)[number];

export const APPEARANCE_MODES = ["LIGHT", "DARK"] as const;
export type AppearanceMode = (typeof APPEARANCE_MODES)[number];

export const CUSTOM_COLOR_KEYS = [
  "primary",
  "secondary",
  "accent",
  "surface",
  "text",
  "border",
] as const;
export type CustomColorKey = (typeof CUSTOM_COLOR_KEYS)[number];

export type CustomColors = Record<CustomColorKey, string>;

// Deterministic safe default for any workspace row that has never had an
// appearance written (existing rows / onboarding default).
export const DEFAULT_PRESET: AppearancePreset = "AURA";
export const DEFAULT_MODE: AppearanceMode = "LIGHT";

// #RRGGBB only — rejects #RGB shorthand, var(), url(), rgba(), hsl(), etc.
export const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

// Storage shape of the Company appearance columns (nullable row subset).
export interface AppearanceColumns {
  appearancePreset: AppearancePreset | null;
  appearanceMode: AppearanceMode | null;
  appearanceCustomPrimary: string | null;
  appearanceCustomSecondary: string | null;
  appearanceCustomAccent: string | null;
  appearanceCustomSurface: string | null;
  appearanceCustomText: string | null;
  appearanceCustomBorder: string | null;
}

export interface WorkspaceAppearance {
  preset: AppearancePreset;
  mode: AppearanceMode;
  customColors: CustomColors | null;
}

export function normalizeHex(value: string): string {
  return value.toUpperCase();
}

export function isHexColor(value: string): boolean {
  return HEX_COLOR_RE.test(value);
}

// Deterministic null → default resolution. CUSTOM rows carry their persisted
// six colors; any other preset resolves customColors to null.
export function resolveAppearance(row: Partial<AppearanceColumns>): WorkspaceAppearance {
  const preset = row.appearancePreset ?? DEFAULT_PRESET;
  const mode = row.appearanceMode ?? DEFAULT_MODE;
  if (preset !== "CUSTOM") {
    return { preset, mode, customColors: null };
  }
  return {
    preset,
    mode,
    customColors: {
      primary: row.appearanceCustomPrimary ?? "",
      secondary: row.appearanceCustomSecondary ?? "",
      accent: row.appearanceCustomAccent ?? "",
      surface: row.appearanceCustomSurface ?? "",
      text: row.appearanceCustomText ?? "",
      border: row.appearanceCustomBorder ?? "",
    },
  };
}