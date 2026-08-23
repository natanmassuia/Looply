import { useState } from "react";
import { Link } from "react-router-dom";
import type { ConversationSummaryDto, ConversationMessageDto, ConversationAiStatus } from "../../../lib/types";
import { useClients, useBindConversationClient, useSetConversationAiStatus } from "../../../lib/api";
import { formatDateHeader, formatMessageTime } from "../utils/time";

interface Props {
  conversation: ConversationSummaryDto;
  messages: ConversationMessageDto[];
  onClose?: () => void;
}

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0] ?? "")
      .join("")
      .toUpperCase() || "C"
  );
}

function formatPhone(phone: string): string {
  if (phone.startsWith("+55") && phone.length === 14) {
    return phone.replace(/(\+55)(\d{2})(\d{5})(\d{4})/, "$1 ($2) $3-$4");
  }
  if (phone.startsWith("+55") && phone.length === 13) {
    return phone.replace(/(\+55)(\d{2})(\d{4})(\d{4})/, "$1 ($2) $3-$4");
  }
  return phone;
}

export default function ContextPanel({ conversation, messages, onClose }: Props) {
  const { data: clients } = useClients();
  const bindClientMutation = useBindConversationClient();
  const setAiStatusMutation = useSetConversationAiStatus();

  const [isChangingClient, setIsChangingClient] = useState(false);

  const displayName = conversation.contactName || formatPhone(conversation.remotePhone);
  const phoneLabel = formatPhone(conversation.remotePhone);
  const aiStatus = conversation.aiStatus;

  // Filter messages with structured actions
  const recentActions = messages
    .filter((m) => m.action != null)
    .slice(-10)
    .reverse();

  const handleBind = (clientId: string | null) => {
    bindClientMutation.mutate({ id: conversation.id, clientId });
    setIsChangingClient(false);
  };

  const handleSetStatus = (status: ConversationAiStatus) => {
    setAiStatusMutation.mutate({ id: conversation.id, aiStatus: status });
  };

  return (
    <aside
      data-testid="inbox-context-panel"
      aria-label="Painel de contexto da conversa"
      className="w-80 h-full border-l border-[var(--looply-color-border-default,#e4e4e7)] bg-[var(--looply-color-bg-surface,#ffffff)] flex flex-col shrink-0 overflow-y-auto"
    >
      {/* Header */}
      <div className="p-4 border-b border-[var(--looply-color-border-default,#e4e4e7)] flex items-center justify-between shrink-0">
        <h3 className="text-sm font-bold text-[var(--looply-color-text-primary,#18181b)]">
          Detalhes do Contato
        </h3>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar painel de detalhes"
            className="p-1.5 text-[var(--looply-color-text-muted,#71717a)] hover:text-[var(--looply-color-text-primary,#18181b)] hover:bg-[var(--looply-color-bg-subtle,#f4f4f5)] rounded-lg transition-colors cursor-pointer border-none bg-transparent"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="p-4 space-y-6 flex-1">
        {/* Contact Overview */}
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-[var(--looply-color-bg-subtle,#f4f4f5)] text-[var(--looply-color-text-brand,#2563eb)] font-bold text-lg flex items-center justify-center border border-[var(--looply-color-border-default,#e4e4e7)] overflow-hidden mb-3">
            {conversation.contactAvatarUrl ? (
              <img src={conversation.contactAvatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span>{initials(displayName)}</span>
            )}
          </div>
          <h4 className="text-base font-bold text-[var(--looply-color-text-primary,#18181b)]">
            {displayName}
          </h4>
          <p className="text-xs text-[var(--looply-color-text-muted,#71717a)] tabular-nums mt-0.5">
            {phoneLabel}
          </p>
          <span className="mt-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            WhatsApp
          </span>
        </div>

        {/* Client Association */}
        <div className="rounded-xl border border-[var(--looply-color-border-default,#e4e4e7)] p-3.5 bg-[var(--looply-color-bg-subtle,#f4f4f5)]/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11.5px] font-bold text-[var(--looply-color-text-muted,#71717a)] uppercase tracking-wider">
              Cliente Vinculado
            </span>
            <button
              type="button"
              onClick={() => setIsChangingClient((o) => !o)}
              className="text-xs font-semibold text-[var(--looply-color-text-brand,#2563eb)] hover:underline cursor-pointer border-none bg-transparent p-0"
            >
              {isChangingClient ? "Cancelar" : conversation.client ? "Alterar" : "Vincular"}
            </button>
          </div>

          {isChangingClient ? (
            <div className="space-y-1.5 mt-2">
              {conversation.client && (
                <button
                  type="button"
                  onClick={() => handleBind(null)}
                  disabled={bindClientMutation.isPending}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 rounded-lg transition-colors font-semibold"
                >
                  Desvincular cliente
                </button>
              )}
              {clients?.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleBind(c.id)}
                  disabled={bindClientMutation.isPending}
                  className={`w-full text-left px-2.5 py-1.5 text-xs rounded-lg truncate transition-colors flex items-center justify-between ${
                    conversation.client?.id === c.id
                      ? "bg-[var(--looply-color-text-brand,#2563eb)] text-white font-bold"
                      : "bg-white dark:bg-zinc-800 text-[var(--looply-color-text-primary,#18181b)] hover:bg-[var(--looply-color-bg-subtle,#f4f4f5)] border border-[var(--looply-color-border-default,#e4e4e7)]"
                  }`}
                >
                  <span className="truncate">{c.name}</span>
                  {conversation.client?.id === c.id && <span>✓</span>}
                </button>
              ))}
            </div>
          ) : conversation.client ? (
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[var(--looply-color-text-primary,#18181b)] truncate">
                {conversation.client.name}
              </span>
              <Link
                to={`/clients/${conversation.client.id}`}
                className="text-xs font-semibold text-[var(--looply-color-text-brand,#2563eb)] hover:underline shrink-0"
              >
                Abrir perfil →
              </Link>
            </div>
          ) : (
            <p className="text-xs text-[var(--looply-color-text-muted,#71717a)] italic">
              Nenhum cliente vinculado a esta conversa.
            </p>
          )}
        </div>

        {/* AI Governance */}
        <div className="rounded-xl border border-[var(--looply-color-border-default,#e4e4e7)] p-3.5 space-y-2.5">
          <span className="text-[11.5px] font-bold text-[var(--looply-color-text-muted,#71717a)] uppercase tracking-wider block">
            Status da IA
          </span>
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                aiStatus === "ACTIVE"
                  ? "bg-emerald-500 animate-pulse"
                  : aiStatus === "PAUSED"
                  ? "bg-amber-500"
                  : "bg-rose-500"
              }`}
            />
            <span className="text-xs font-bold">
              {aiStatus === "ACTIVE"
                ? "Assistente Ativo no WhatsApp"
                : aiStatus === "PAUSED"
                ? "Assistente Pausado"
                : "Requer Atenção"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 pt-1">
            {aiStatus !== "ACTIVE" && (
              <button
                type="button"
                onClick={() => handleSetStatus("ACTIVE")}
                disabled={setAiStatusMutation.isPending}
                className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors cursor-pointer"
              >
                Ativar
              </button>
            )}
            {aiStatus !== "PAUSED" && (
              <button
                type="button"
                onClick={() => handleSetStatus("PAUSED")}
                disabled={setAiStatusMutation.isPending}
                className="px-2.5 py-1 text-[11px] font-semibold bg-[var(--looply-color-bg-subtle,#f4f4f5)] text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
              >
                Pausar
              </button>
            )}
            {aiStatus !== "NEEDS_ATTENTION" && (
              <button
                type="button"
                onClick={() => handleSetStatus("NEEDS_ATTENTION")}
                disabled={setAiStatusMutation.isPending}
                className="px-2.5 py-1 text-[11px] font-semibold bg-[var(--looply-color-bg-subtle,#f4f4f5)] text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              >
                Sinalizar Atenção
              </button>
            )}
          </div>
        </div>

        {/* Recent AI Structured Actions */}
        <div className="space-y-3">
          <span className="text-[11.5px] font-bold text-[var(--looply-color-text-muted,#71717a)] uppercase tracking-wider block">
            Ações Recentes da IA
          </span>

          {recentActions.length === 0 ? (
            <p className="text-xs text-[var(--looply-color-text-muted,#71717a)] italic">
              Nenhuma ação estruturada executada nesta conversa ainda.
            </p>
          ) : (
            <div className="space-y-2">
              {recentActions.map((m) => {
                const action = m.action!;
                return (
                  <div
                    key={m.id}
                    className="p-2.5 rounded-lg border border-[var(--looply-color-border-default,#e4e4e7)] bg-[var(--looply-color-bg-subtle,#f4f4f5)]/40 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between text-[10.5px] text-[var(--looply-color-text-muted,#71717a)]">
                      <span className="font-semibold">
                        {action.type === "APPOINTMENT_CREATED"
                          ? "📅 Agendamento"
                          : action.type === "JOB_CREATED"
                          ? "📋 Demanda"
                          : action.type.startsWith("CONFIRMATION")
                          ? "⏳ Confirmação"
                          : "⚠️ Ação IA"}
                      </span>
                      <span>{formatMessageTime(m.createdAt)}</span>
                    </div>
                    {Boolean(action.metadata?.title) && (
                      <p className="font-medium text-[var(--looply-color-text-primary,#18181b)] truncate">
                        {String(action.metadata?.title)}
                      </p>
                    )}
                    {Boolean(action.metadata?.startsAt) && (
                      <p className="text-[11px] text-[var(--looply-color-text-muted,#71717a)]">
                        {formatDateHeader(String(action.metadata?.startsAt))} às{" "}
                        {formatMessageTime(String(action.metadata?.startsAt))}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
