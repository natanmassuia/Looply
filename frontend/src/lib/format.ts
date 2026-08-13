import type { ContentStatus, ContentFormat, UserRole } from "./types";

export const STATUS_LABEL: Record<ContentStatus, string> = {
  DRAFT: "Rascunho",
  IN_REVIEW: "Em revisão",
  AWAITING_CLIENT: "Aguardando cliente",
  CHANGES_REQUESTED: "Alterações solicitadas",
  APPROVED: "Aprovado",
  SCHEDULED: "Agendado",
  PUBLISHED: "Publicado",
};

export const STATUS_STYLE: Record<ContentStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-600 ring-slate-200",
  IN_REVIEW: "bg-amber-50 text-amber-700 ring-amber-200",
  AWAITING_CLIENT: "bg-violet-50 text-violet-700 ring-violet-200",
  CHANGES_REQUESTED: "bg-rose-50 text-rose-700 ring-rose-200",
  APPROVED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  SCHEDULED: "bg-blue-50 text-blue-700 ring-blue-200",
  PUBLISHED: "bg-teal-50 text-teal-700 ring-teal-200",
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

export const STATUS_FILTERS: ContentStatus[] = [
  "DRAFT",
  "IN_REVIEW",
  "AWAITING_CLIENT",
  "CHANGES_REQUESTED",
  "APPROVED",
  "SCHEDULED",
  "PUBLISHED",
];

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
