import type { AssistantResult, AssistantOperation } from "./assistantCommandService";

// ── Deterministic WhatsApp reply copy (A3.1) ─────────────────────────────
// No LLM call is used to formulate operational responses. Bounded output.

export const WHATSAPP_MAX_LIST_ITEMS = 10;

export const WHATSAPP_COPY = {
  unauthorized: "Este número não possui acesso ao Looply.",
  transientFailure: "Serviço temporariamente indisponível. Tente novamente em instantes.",
  unsupported: "Esse tipo de ação ainda não é suportado pelo Assistant.",
  clarificationGeneric: "Preciso de mais informações para concluir esse pedido.",
  noPendingConfirmation: "Não há nenhuma ação pendente para confirmar.",
  confirmationCancelled: "Ação cancelada.",
  nonText: "Por enquanto, envie sua solicitação em texto.",
  domainError: "Não foi possível concluir o pedido.",
} as const;

const SUCCESS_COPY: Record<AssistantOperation, string> = {
  "calendar.create": "Compromisso criado com sucesso.",
  "calendar.update": "Compromisso atualizado.",
  "calendar.delete": "Compromisso cancelado.",
  "ticket.create": "Chamado criado com sucesso.",
  "ticket.read": "",
  "calendar.read": "",
  "ticket.update": "Chamado atualizado.",
  "ticket.delete": "Chamado cancelado.",
};

const ACTION_COPY: Record<string, string> = {
  "calendar.update": "a alteração do compromisso",
  "calendar.delete": "o cancelamento do compromisso",
  "ticket.update": "a alteração do chamado",
  "ticket.delete": "o cancelamento do chamado",
};

export function confirmationPrompt(operation: AssistantOperation | string): string {
  const action = ACTION_COPY[operation] ?? "esta ação";
  return `Confirma ${action}? Responda SIM para confirmar.`;
}

function formatDate(value: string | Date | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function boundLines(items: string[]): string {
  const shown = items.slice(0, WHATSAPP_MAX_LIST_ITEMS);
  const rest = items.length - shown.length;
  const lines = shown.map((item) => `- ${item}`);
  if (rest > 0) lines.push(`+ ${rest} outros resultados.`);
  return lines.join("\n");
}

function formatRead(operation: AssistantOperation, result: unknown): string {
  if (operation === "calendar.read") {
    const value = result as { appointments?: Array<{ title: string; startsAt: string | Date }>; events?: Array<{ title: string; at: string | Date }> };
    if (Array.isArray(value?.appointments)) {
      const empty = value.appointments.length === 0 ? "Nenhum compromisso encontrado." : "";
      return [boundLines(value.appointments.map((a) => `${a.title} (${formatDate(a.startsAt)})`)), empty].filter(Boolean).join("\n");
    }
    if (Array.isArray(value?.events)) {
      const empty = value.events.length === 0 ? "Nenhum evento encontrado." : "";
      return [boundLines(value.events.map((e) => `${e.title} (${formatDate(e.at)})`)), empty].filter(Boolean).join("\n");
    }
    return "Consulta concluída.";
  }
  const value = result as { jobs?: Array<{ title: string; lifecycleStatus?: string }>; client?: { name?: string }; lifecycleStatus?: string; title?: string };
  if (Array.isArray(value?.jobs)) {
    const empty = value.jobs.length === 0 ? "Nenhum chamado encontrado." : "";
    return [boundLines(value.jobs.map((j) => j.title)), empty].filter(Boolean).join("\n");
  }
  if (value?.title) return `${value.title}${value.client?.name ? ` — ${value.client.name}` : ""}`;
  return "Consulta concluída.";
}

export function formatAssistantResult(result: AssistantResult): string {
  if (!result.ok) {
    switch (result.error.code) {
      case "ASSISTANT_CONFIRMATION_REQUIRED":
        return confirmationPrompt(result.operation ?? "");
      case "forbidden":
        return WHATSAPP_COPY.domainError;
      case "not_found":
        return "Registro não encontrado.";
      case "conflict":
        return result.error.message || WHATSAPP_COPY.domainError;
      case "validation_error":
      case "bad_request":
        return WHATSAPP_COPY.domainError;
      default:
        return WHATSAPP_COPY.transientFailure;
    }
  }
  const copy = SUCCESS_COPY[result.operation];
  if (copy) return copy;
  return formatRead(result.operation, result.result);
}
