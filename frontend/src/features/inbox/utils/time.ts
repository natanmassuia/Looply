export function formatTimeAgo(dateStr: string | null | undefined, now = Date.now()): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const diffMs = now - date.getTime();
  if (diffMs < 0) return "agora";

  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "agora";
  if (diffMins < 60) return `${diffMins} min`;
  if (diffHours < 24) return `${diffHours} h`;
  if (diffDays === 1) return "ontem";
  if (diffDays < 7) return `${diffDays} d`;

  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function formatMessageTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function formatDateHeader(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return "Hoje";
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return "Ontem";
  }

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}
