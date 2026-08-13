// Pure content-lifecycle rules. No DB, no Prisma dependency → fully unit-testable.
// Transitions are explicit; the frontend may NOT set arbitrary statuses.

export const CONTENT_STATUSES = [
  "DRAFT",
  "IN_REVIEW",
  "AWAITING_CLIENT",
  "CHANGES_REQUESTED",
  "APPROVED",
  "SCHEDULED",
  "PUBLISHED",
] as const;

export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export const TRANSITIONS: Record<ContentStatus, readonly ContentStatus[]> = {
  DRAFT: ["IN_REVIEW"],
  IN_REVIEW: ["AWAITING_CLIENT", "DRAFT"],
  AWAITING_CLIENT: ["CHANGES_REQUESTED", "APPROVED"],
  CHANGES_REQUESTED: ["IN_REVIEW"],
  APPROVED: ["SCHEDULED"],
  SCHEDULED: ["PUBLISHED"],
  PUBLISHED: [],
};

export function canTransition(from: ContentStatus, to: ContentStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertCanTransition(from: ContentStatus, to: ContentStatus): void {
  if (!canTransition(from, to)) {
    throw new TransitionError(from, to);
  }
}

export class TransitionError extends Error {
  constructor(public readonly from: string, public readonly to: string) {
    super(`Transição de status inválida: ${from} → ${to}`);
    this.name = "TransitionError";
  }
}

// Versioning: monotonic increase. Given the highest existing version number
// (0 when none exists), the next version is max + 1.
export function nextVersionNumber(currentMax: number): number {
  if (!Number.isInteger(currentMax) || currentMax < 0) {
    throw new Error(`currentMax deve ser inteiro >= 0 (recebido ${currentMax})`);
  }
  return currentMax + 1;
}

// Friendly Portuguese label per status (used by API + shared with frontend copy).
export const STATUS_LABEL: Record<ContentStatus, string> = {
  DRAFT: "Rascunho",
  IN_REVIEW: "Em revisão",
  AWAITING_CLIENT: "Aguardando cliente",
  CHANGES_REQUESTED: "Alterações solicitadas",
  APPROVED: "Aprovado",
  SCHEDULED: "Agendado",
  PUBLISHED: "Publicado",
};
