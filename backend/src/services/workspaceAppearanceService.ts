import type { DB } from "../lib/db";
import { badRequest } from "../lib/errors";
import {
  CUSTOM_COLOR_KEYS,
  normalizeHex,
  resolveAppearance,
  type AppearanceColumns,
  type AppearanceMode,
  type AppearancePreset,
  type CustomColors,
  type WorkspaceAppearance,
} from "../domain/appearance";

// Canonical persistence service for workspace appearance (BP1). All appearance
// writes converge here: the Settings PATCH endpoint and the onboarding
// appearance step (F4B) both call this service.

const APPEARANCE_SELECT = {
  appearancePreset: true,
  appearanceMode: true,
  appearanceCustomPrimary: true,
  appearanceCustomSecondary: true,
  appearanceCustomAccent: true,
  appearanceCustomSurface: true,
  appearanceCustomText: true,
  appearanceCustomBorder: true,
} as const;

export interface UpdateAppearanceInput {
  preset?: AppearancePreset;
  mode?: AppearanceMode;
  customColors?: CustomColors;
}

function normalizeCustomColors(colors: CustomColors): CustomColors {
  return Object.fromEntries(
    CUSTOM_COLOR_KEYS.map((key) => [key, normalizeHex(colors[key])]),
  ) as CustomColors;
}

export async function getAppearance(db: DB, companyId: string): Promise<WorkspaceAppearance> {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: APPEARANCE_SELECT,
  });
  if (!company) throw badRequest("Workspace inválido");
  return resolveAppearance(company);
}

export async function updateAppearance(
  db: DB,
  companyId: string,
  input: UpdateAppearanceInput,
): Promise<WorkspaceAppearance> {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: APPEARANCE_SELECT,
  });
  if (!company) throw badRequest("Workspace inválido");
  const current = resolveAppearance(company);

  const preset = input.preset ?? current.preset;
  const mode = input.mode ?? current.mode;

  let customColors: CustomColors | null = current.customColors;

  if (input.customColors !== undefined) {
    if (preset !== "CUSTOM") {
      throw badRequest("Cores customizadas são válidas apenas no preset CUSTOM");
    }
    customColors = normalizeCustomColors(input.customColors);
  }

  // CUSTOM must always land with a complete set of six colors.
  if (preset === "CUSTOM" && customColors === null) {
    throw badRequest("O preset CUSTOM requer as seis cores base");
  }

  // Moving away from CUSTOM deterministically clears the custom colors.
  if (preset !== "CUSTOM") {
    customColors = null;
  }

  const data: AppearanceColumns = {
    appearancePreset: preset,
    appearanceMode: mode,
    appearanceCustomPrimary: customColors?.primary ?? null,
    appearanceCustomSecondary: customColors?.secondary ?? null,
    appearanceCustomAccent: customColors?.accent ?? null,
    appearanceCustomSurface: customColors?.surface ?? null,
    appearanceCustomText: customColors?.text ?? null,
    appearanceCustomBorder: customColors?.border ?? null,
  };

  await db.company.update({
    where: { id: companyId },
    data,
  });

  return { preset, mode, customColors };
}