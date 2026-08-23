import type { ConversationSummaryDto, ConversationAiStatus } from "../../../lib/types";
import { useSetConversationAiStatus } from "../../../lib/api";

interface Props {
  conversation: ConversationSummaryDto;
}

export default function AIStatusFooter({ conversation }: Props) {
  const setAiStatusMutation = useSetConversationAiStatus();
  const status = conversation.aiStatus;

  const handleSetStatus = (newStatus: ConversationAiStatus) => {
    setAiStatusMutation.mutate({ id: conversation.id, aiStatus: newStatus });
  };

  return (
    <footer
      data-testid="ai-status-footer"
      className="border-t border-[var(--looply-color-border-default,#e4e4e7)] bg-[var(--looply-color-bg-surface,#ffffff)] px-4 py-3 shrink-0"
    >
      <div
        className={`rounded-xl p-3.5 border transition-all ${
          status === "ACTIVE"
            ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-500/20 text-emerald-900 dark:text-emerald-200"
            : status === "PAUSED"
            ? "bg-amber-50/60 dark:bg-amber-950/20 border-amber-500/20 text-amber-900 dark:text-amber-200"
            : "bg-rose-50/60 dark:bg-rose-950/20 border-rose-500/20 text-rose-900 dark:text-rose-200"
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Status info */}
          <div className="flex items-start gap-2.5">
            <div
              className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center ${
                status === "ACTIVE"
                  ? "bg-emerald-500 text-white shadow-xs"
                  : status === "PAUSED"
                  ? "bg-amber-500 text-white shadow-xs"
                  : "bg-rose-500 text-white shadow-xs"
              }`}
            >
              {status === "ACTIVE" ? (
                <svg
                  className="w-4 h-4 fill-current"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
                  <path d="M18 14l.75 2.25L21 17l-2.25.75L18 20l-.75-2.25L15 17l2.25-.75L18 14z" />
                </svg>
              ) : status === "PAUSED" ? (
                <svg
                  className="w-4 h-4 fill-current"
                  viewBox="0 0 24 24"
                >
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg
                  className="w-4 h-4 fill-none"
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
              <h3 className="text-[13px] font-bold leading-tight">
                {status === "ACTIVE"
                  ? "Assistente de IA em Operação"
                  : status === "PAUSED"
                  ? "Assistente de IA Pausado"
                  : "Conversa com Atenção Necessária"}
              </h3>
              <p className="text-[11.5px] opacity-80 mt-0.5 leading-snug">
                {status === "ACTIVE"
                  ? "O Looply AI atende e responde autonomamente a este contato no WhatsApp."
                  : status === "PAUSED"
                  ? "As respostas automáticas estão temporariamente pausadas para este número."
                  : "Esta conversa foi sinalizada para acompanhamento humano prioritário."}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            {status === "ACTIVE" && (
              <>
                <button
                  type="button"
                  onClick={() => handleSetStatus("PAUSED")}
                  disabled={setAiStatusMutation.isPending}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-zinc-800 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  Pausar IA
                </button>
                <button
                  type="button"
                  onClick={() => handleSetStatus("NEEDS_ATTENTION")}
                  disabled={setAiStatusMutation.isPending}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-zinc-800 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
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
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  Retomar IA
                </button>
                <button
                  type="button"
                  onClick={() => handleSetStatus("NEEDS_ATTENTION")}
                  disabled={setAiStatusMutation.isPending}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-zinc-800 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
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
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  Resolver e Retomar IA
                </button>
                <button
                  type="button"
                  onClick={() => handleSetStatus("PAUSED")}
                  disabled={setAiStatusMutation.isPending}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-zinc-800 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
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
