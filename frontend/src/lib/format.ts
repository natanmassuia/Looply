import type { ContentStatus, ContentFormat, UserRole, MemberRole } from "./types";

export const STATUS_LABEL: Record<ContentStatus, string> = {
  DRAFT: "Rascunho",
  IN_REVIEW: "Em revisão",
  AWAITING_CLIENT: "Aguardando cliente",
  CHANGES_REQUESTED: "Alterações solicitadas",
  APPROVED: "Aprovado",
  SCHEDULED: "Agendado",
  PUBLISHED: "Concluído",
};

export const STATUS_STYLE: Record<ContentStatus, string> = {
  DRAFT:
    "bg-[var(--looply-color-bg-subtle)] text-[var(--looply-color-text-secondary)] ring-1 ring-inset ring-[var(--looply-color-border-default)]",
  IN_REVIEW:
    "bg-[color-mix(in_srgb,var(--looply-color-status-warning)_14%,transparent)] text-[var(--looply-color-status-warning)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--looply-color-status-warning)_28%,transparent)]",
  AWAITING_CLIENT:
    "bg-[color-mix(in_srgb,var(--looply-color-status-info)_16%,transparent)] text-[var(--looply-color-status-info)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--looply-color-status-info)_30%,transparent)]",
  CHANGES_REQUESTED:
    "bg-[color-mix(in_srgb,var(--looply-color-status-danger)_14%,transparent)] text-[var(--looply-color-status-danger)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--looply-color-status-danger)_28%,transparent)]",
  APPROVED:
    "bg-[color-mix(in_srgb,var(--looply-color-status-success)_14%,transparent)] text-[var(--looply-color-status-success)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--looply-color-status-success)_28%,transparent)]",
  SCHEDULED:
    "bg-[color-mix(in_srgb,var(--looply-color-action-primary)_14%,transparent)] text-[var(--looply-color-text-brand)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--looply-color-action-primary)_28%,transparent)]",
  PUBLISHED:
    "bg-[color-mix(in_srgb,var(--looply-color-status-success)_18%,transparent)] text-[var(--looply-color-status-success)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--looply-color-status-success)_32%,transparent)]",
};

export const FORMAT_LABEL: Record<ContentFormat, string> = {
  POST: "Post",
  REELS: "Reels",
  STORY: "Story",
  CAROUSEL: "Carrossel",
  VIDEO: "Vídeo",
  IMAGE: "Imagem",
};

export const ROLE_LABEL: Record<UserRole, string> = {
  ADMIN: "Administrador",
  CONTENT_MANAGER: "Gerente de Conteúdo",
  EDITOR: "Editor",
  SOCIAL_MEDIA: "Social Media",
  DESIGNER: "Designer",
};

export const MEMBER_ROLE_LABEL: Record<MemberRole, string> = {
  OWNER: "Proprietário",
  ADMIN: "Administrador",
  MEMBER: "Membro",
};

// Display label for a role value that can be EITHER a membership role
// (OWNER/ADMIN/MEMBER) or a user role (ADMIN/CONTENT_MANAGER/…). Used where the
// shown role can be either, e.g. the sidebar and account modal.
export const DISPLAY_ROLE_LABEL: Record<string, string> = {
  ...MEMBER_ROLE_LABEL,
  ...ROLE_LABEL,
};

export function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0] ?? "")
      .join("")
      .toUpperCase() || "·"
  );
}

// Deterministic avatar color for a contact, seeded by phone (or name). The
// circle carries its own mid-tone background + white text, so it stays legible
// in both light and dark themes without a theme-specific palette.
export function avatarColor(seed: string): { bg: string; fg: string } {
  const s = seed || "?";
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return { bg: `hsl(${h} 52% 40%)`, fg: "#ffffff" };
}

export function latestVersion(c: { versions?: { versionNumber: number }[] }): number {
  if (!c.versions || c.versions.length === 0) return 1;
  return Math.max(...c.versions.map((v) => v.versionNumber));
}

export function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

// F14.2 — timezone-aware date/time formatting using the workspace/company
// timezone (Company.timezone), NOT the browser's implicit zone.
export function formatInTimeZone(iso: string, timeZone: string | null | undefined, opts: Intl.DateTimeFormatOptions): string {
  if (!iso) return "—";
  try {
    const tz = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    return new Intl.DateTimeFormat("pt-BR", { timeZone: tz, ...opts }).format(new Date(iso));
  } catch {
    try {
      return new Intl.DateTimeFormat("pt-BR", opts).format(new Date(iso));
    } catch {
      return "—";
    }
  }
}

// Current wall-clock in the workspace timezone (used by the Dashboard clock).
export function formatClock(now: Date, timeZone: string | null | undefined): string {
  try {
    const tz = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    return new Intl.DateTimeFormat("pt-BR", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(now);
  } catch {
    return now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
}

// Short appointment line, e.g. "18 ago · 14:00".
export function formatAppointmentLine(iso: string, timeZone: string | null | undefined): string {
  const date = formatInTimeZone(iso, timeZone, { day: "2-digit", month: "short" });
  const time = formatInTimeZone(iso, timeZone, { hour: "2-digit", minute: "2-digit" });
  return `${date} · ${time}`;
}

// Human-friendly GMT offset for the workspace timezone label.
export function gmtOffsetLabel(timeZone: string | null | undefined): string {
  try {
    const tz = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" }).formatToParts(now);
    const name = parts.find((p) => p.type === "timeZoneName")?.value;
    return name ?? "";
  } catch {
    return "";
  }
}

export function relativeTime(iso?: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const abs = Math.abs(diff);
  const day = 86_400_000;
  if (abs < day) {
    const h = Math.floor(abs / 3_600_000);
    if (h < 1) return "agora há pouco";
    return diff > 0 ? `há ${h}h` : `em ${h}h`;
  }
  const d = Math.floor(abs / day);
  return diff > 0 ? `há ${d}d` : `em ${d}d`;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Pretty-print a stored E.164 Brazilian number, e.g. "+5516999998888" →
// "+55 (16) 99999-8888". Non-BR numbers (or unexpected lengths) pass through.
export function formatPhone(phone: string): string {
  if (phone.startsWith("+55") && phone.length === 14) {
    return phone.replace(/(\+55)(\d{2})(\d{5})(\d{4})/, "$1 ($2) $3-$4");
  }
  if (phone.startsWith("+55") && phone.length === 13) {
    return phone.replace(/(\+55)(\d{2})(\d{4})(\d{4})/, "$1 ($2) $3-$4");
  }
  return phone;
}
