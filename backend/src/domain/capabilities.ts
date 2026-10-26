// Workspace templates & capability resolution (B3).
// Product principle: user chooses a use case, the system resolves capabilities.
// Templates are static, versioned product behavior owned by Verbum Lab —
// they live in code, not in the database. No plugin framework, no per-customer
// overrides in V1.

import { resolveAppearance, type AppearanceColumns, type WorkspaceAppearance } from "./appearance";

export enum Capability {
  CLIENTS = "CLIENTS",
  JOBS = "JOBS",
  WORKFLOW = "WORKFLOW",
  KANBAN = "KANBAN",
  FILES = "FILES",
  APPROVAL = "APPROVAL",
  CALENDAR = "CALENDAR",
  ACTIVITY = "ACTIVITY",
  DASHBOARD = "DASHBOARD",
}

export type WorkspaceTemplate = "LOCAL_BUSINESS" | "HIGH_TICKET" | "MARKETING_AGENCY";

export interface TemplateDefinition {
  template: WorkspaceTemplate;
  capabilities: Capability[];
}

// LOCAL_BUSINESS: "press a button and it works" — minimal operational surface.
// WORKFLOW runs internally with simple defaults; the future UI hides complexity.
// KANBAN is on for the MVP atendimento loop (board + table demand views).
const LOCAL_BUSINESS: Capability[] = [
  Capability.CLIENTS,
  Capability.JOBS,
  Capability.WORKFLOW,
  Capability.KANBAN,
  Capability.FILES,
  Capability.CALENDAR,
  Capability.ACTIVITY,
  Capability.DASHBOARD,
];

// HIGH_TICKET: quality, approval and sales handoff.
const HIGH_TICKET: Capability[] = [
  Capability.CLIENTS,
  Capability.JOBS,
  Capability.WORKFLOW,
  Capability.FILES,
  Capability.APPROVAL,
  Capability.CALENDAR,
  Capability.ACTIVITY,
  Capability.DASHBOARD,
];

// MARKETING_AGENCY: control and scale — full surface.
const MARKETING_AGENCY: Capability[] = [
  Capability.CLIENTS,
  Capability.JOBS,
  Capability.WORKFLOW,
  Capability.KANBAN,
  Capability.FILES,
  Capability.APPROVAL,
  Capability.CALENDAR,
  Capability.ACTIVITY,
  Capability.DASHBOARD,
];

export const TEMPLATE_REGISTRY: Record<WorkspaceTemplate, TemplateDefinition> = {
  LOCAL_BUSINESS: { template: "LOCAL_BUSINESS", capabilities: LOCAL_BUSINESS },
  HIGH_TICKET: { template: "HIGH_TICKET", capabilities: HIGH_TICKET },
  MARKETING_AGENCY: { template: "MARKETING_AGENCY", capabilities: MARKETING_AGENCY },
};

// Deterministic resolution: template → capabilities.
// Unconfigured workspace (null template) resolves to ZERO domain capabilities —
// never a permissive fallback. Only onboarding/config endpoints (B4+) apply.
export function capabilitiesForTemplate(
  template: WorkspaceTemplate | null | undefined,
): Capability[] {
  if (!template) return [];
  return TEMPLATE_REGISTRY[template].capabilities.slice();
}

export function hasCapability(
  template: WorkspaceTemplate | null | undefined,
  capability: Capability,
): boolean {
  return capabilitiesForTemplate(template).includes(capability);
}

// Workspace context as exposed through API contracts.
export interface WorkspaceContext {
  id: string;
  name: string;
  logoUrl?: string | null;
  timezone?: string | null;
  template: WorkspaceTemplate | null;
  capabilities: Capability[];
  status: "UNCONFIGURED" | "ACTIVE";
  appearance: WorkspaceAppearance;
}

export function resolveWorkspaceContext(company: {
  id: string;
  name: string;
  logoUrl?: string | null;
  timezone?: string | null;
  workspaceTemplate: WorkspaceTemplate | null;
} & Partial<AppearanceColumns>): WorkspaceContext {
  return {
    id: company.id,
    name: company.name,
    logoUrl: company.logoUrl ?? null,
    timezone: company.timezone ?? null,
    template: company.workspaceTemplate,
    capabilities: capabilitiesForTemplate(company.workspaceTemplate),
    status: company.workspaceTemplate ? "ACTIVE" : "UNCONFIGURED",
    appearance: resolveAppearance(company),
  };
}
