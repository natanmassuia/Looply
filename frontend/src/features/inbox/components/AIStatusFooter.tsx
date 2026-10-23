import type { ConversationSummaryDto, ConversationAiStatus, ConversationMessageDto } from "../../../lib/types";
import { useSetConversationAiStatus } from "../../../lib/api";
import { formatMessageTime } from "../utils/time";

interface Props {
  conversation: ConversationSummaryDto;
  messages?: ConversationMessageDto[];
}

export default function AIStatusFooter({ conversation, messages = [] }: Props) {
  const setAiStatusMutation = useSetConversationAiStatus();
  const status = conversation.aiStatus;

  // Human takeover: the AI auto-pauses when an operator replies. We treat the
  // pause as a takeover when the most recent message is from a human agent, and
  // surface who/when so the pause isn't a mystery.
  const lastMessage = messages[messages.length - 1];
  const takeover =
    status === "PAUSED" && lastMessage?.senderUser ? lastMessage : null;
  const takeoverName = takeover?.senderUser?.name;
  const takeoverTime = takeover ? formatMessageTime(takeover.createdAt) : null;

  const handleSetStatus = (newStatus: ConversationAiStatus) => {
    setAiStatusMutation.mutate({ id: conversation.id, aiStatus: newStatus });
  };

  const title =
    status === "ACTIVE"
      ? "Assistente de IA em Operação"
      : status === "PAUSED"
      ? takeover
        ? "Você está no comando"
        : "Assistente de IA Pausado"
      : "Conversa com Atenção Necessária";

  const subtitle =
    status === "ACTIVE"
      ? "O Looply AI atende e responde autonomamente a este contato no WhatsApp."
      : status === "PAUSED"
      ? takeover
        ? `${takeoverName ?? "Você"} assumiu esta conversa${
            takeoverTime ? ` às ${takeoverTime}` : ""
          }. A IA não responde até você devolvê-la.`
        : "Respostas automáticas pausadas. A IA não responde até ser reativada."
      : "Esta conversa foi sinalizada para acompanhamento humano prioritário.";

  return (
    <footer
      data-testid="ai-status-footer"
      className="shrink-0 border-t border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] px-4 py-2.5"
    >
      <div className="rounded-[10px] border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-subtle)] px-3.5 py-2.5 transition-all">
        <div className="flex flex-col justify-between gap-2.5 sm:flex-row sm:items-center">
          {/* Status info */}
          <div className="flex items-start gap-2.5">
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] text-[var(--looply-color-text-on-brand)] ${
                status === "ACTIVE"
                  ? "bg-[var(--looply-color-status-success)]"
                  : status === "PAUSED"
                  ? "bg-[var(--looply-color-status-warning)]"
                  : "bg-[var(--looply-color-status-danger)]"
              }`}
            >
              {status === "ACTIVE" ? (
                <svg
                  className="h-3.5 w-3.5 fill-current"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
                  <path d="M18 14l.75 2.25L21 17l-2.25.75L18 20l-.75-2.25L15 17l2.25-.75L18 14z" />
                </svg>
              ) : status === "PAUSED" ? (
                <svg
                  className="h-3.5 w-3.5 fill-current"
                  viewBox="0 0 24 24"
                >
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg
                  className="h-3.5 w-3.5 fill-none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4M12 16h.01" />
                </svg>
              )}
            </div>

            <div>
              <h3 className="text-xs font-bold leading-tight text-[var(--looply-color-text-primary)]">
                {title}
              </h3>
              <p className="mt-0.5 text-[11px] leading-snug text-[var(--looply-color-text-secondary)]">
                {subtitle}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
            {status === "ACTIVE" && (
              <>
                <button
                  type="button"
                  onClick={() => handleSetStatus("PAUSED")}
                  disabled={setAiStatusMutation.isPending}
                  className="cursor-pointer rounded-[10px] border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--looply-color-text-primary)] transition-colors hover:bg-[var(--looply-color-coral-100)] disabled:opacity-50"
                >
                  Pausar IA
                </button>
                <button
                  type="button"
                  onClick={() => handleSetStatus("NEEDS_ATTENTION")}
                  disabled={setAiStatusMutation.isPending}
                  className="cursor-pointer rounded-[10px] border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--looply-color-status-danger)] transition-colors hover:bg-[var(--looply-color-coral-100)] disabled:opacity-50"
                >
                  Sinalizar Atenção
                </button>
              </>
            )}

            {status === "PAUSED" && (
              <>
                <button
                  type="button"
                  onClick={() => handleSetStatus("ACTIVE")}
                  disabled={setAiStatusMutation.isPending}
                  className="cursor-pointer rounded-[10px] bg-[var(--looply-color-action-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--looply-color-text-on-brand)] transition-colors hover:bg-[var(--looply-color-action-primary-hover)] disabled:opacity-50"
                >
                  Devolver à IA
                </button>
                <button
                  type="button"
                  onClick={() => handleSetStatus("NEEDS_ATTENTION")}
                  disabled={setAiStatusMutation.isPending}
                  className="cursor-pointer rounded-[10px] border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--looply-color-status-danger)] transition-colors hover:bg-[var(--looply-color-coral-100)] disabled:opacity-50"
                >
                  Sinalizar Atenção
                </button>
              </>
            )}

            {status === "NEEDS_ATTENTION" && (
              <>
                <button
                  type="button"
                  onClick={() => handleSetStatus("ACTIVE")}
                  disabled={setAiStatusMutation.isPending}
                  className="cursor-pointer rounded-[10px] bg-[var(--looply-color-action-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--looply-color-text-on-brand)] transition-colors hover:bg-[var(--looply-color-action-primary-hover)] disabled:opacity-50"
                >
                  Resolver e Retomar IA
                </button>
                <button
                  type="button"
                  onClick={() => handleSetStatus("PAUSED")}
                  disabled={setAiStatusMutation.isPending}
                  className="cursor-pointer rounded-[10px] border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--looply-color-text-primary)] transition-colors hover:bg-[var(--looply-color-coral-100)] disabled:opacity-50"
                >
                  Pausar IA
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
