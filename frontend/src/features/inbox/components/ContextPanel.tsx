import { useState } from "react";
import { Link } from "react-router-dom";
import type { ConversationSummaryDto, ConversationMessageDto, ConversationAiStatus } from "../../../lib/types";
import { useClients, useBindConversationClient, useSetConversationAiStatus } from "../../../lib/api";
import { formatDateHeader, formatMessageTime } from "../utils/time";
import { formatPhone } from "../../../lib/format";

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
      className="flex h-full w-72 shrink-0 flex-col overflow-y-auto rounded-[10px] border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)]"
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--looply-color-border-default)] px-4 py-3.5">
        <h3 className="text-xs font-bold uppercase tracking-[0.06em] text-[var(--looply-color-text-muted)]">
          Detalhes do Contato
        </h3>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar painel de detalhes"
            className="cursor-pointer rounded-[8px] border-none bg-transparent p-1.5 text-[var(--looply-color-text-muted)] transition-colors hover:bg-[var(--looply-color-bg-subtle)] hover:text-[var(--looply-color-text-primary)]"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="flex-1 space-y-4 p-4">
        {/* Contact Overview (Figma 16 — 490:7 Contact Context) */}
        <div className="flex flex-col items-center text-center">
          <div className="mb-2.5 flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-[var(--looply-color-coral-100)] text-sm font-bold text-[var(--looply-color-text-primary)]">
            {conversation.contactAvatarUrl ? (
              <img src={conversation.contactAvatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span>{initials(displayName)}</span>
            )}
          </div>
          <h4 className="text-[15px] font-bold text-[var(--looply-color-text-primary)]">
            {displayName}
          </h4>
          <p className="mt-0.5 text-[11px] tabular-nums text-[var(--looply-color-text-secondary)]">
            {phoneLabel}
          </p>
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[var(--looply-color-bg-subtle)] px-2.5 py-0.5 text-[10.5px] font-semibold text-[var(--looply-color-text-primary)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--looply-color-status-success)]" />
            WhatsApp Cloud API
          </span>
        </div>

        <div className="h-px w-full bg-[var(--looply-color-border-default)]" />

        {/* Client Association */}
        <div className="rounded-[10px] bg-[var(--looply-color-bg-subtle)] p-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--looply-color-text-muted)]">
              Cliente Vinculado
            </span>
            <button
              type="button"
              onClick={() => setIsChangingClient((o) => !o)}
              className="cursor-pointer border-none bg-transparent p-0 text-xs font-semibold text-[var(--looply-color-text-brand)] hover:underline"
            >
              {isChangingClient ? "Cancelar" : conversation.client ? "Alterar" : "Vincular"}
            </button>
          </div>

          {isChangingClient ? (
            <div className="mt-2 space-y-1.5">
              {conversation.client && (
                <button
                  type="button"
                  onClick={() => handleBind(null)}
                  disabled={bindClientMutation.isPending}
                  className="w-full rounded-[8px] bg-[var(--looply-color-bg-surface)] px-2.5 py-1.5 text-left text-xs font-semibold text-[var(--looply-color-status-danger)] transition-colors hover:bg-[var(--looply-color-coral-100)]"
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
                  className={`flex w-full items-center justify-between truncate rounded-[8px] px-2.5 py-1.5 text-left text-xs transition-colors ${
                    conversation.client?.id === c.id
                      ? "bg-[var(--looply-color-action-primary)] font-bold text-[var(--looply-color-text-on-brand)]"
                      : "border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] text-[var(--looply-color-text-primary)] hover:bg-[var(--looply-color-coral-100)]"
                  }`}
                >
                  <span className="truncate">{c.name}</span>
                  {conversation.client?.id === c.id && <span>✓</span>}
                </button>
              ))}
            </div>
          ) : conversation.client ? (
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-xs font-bold text-[var(--looply-color-text-primary)]">
                {conversation.client.name}
              </span>
              <Link
                to={`/clients/${conversation.client.id}`}
                className="shrink-0 text-xs font-semibold text-[var(--looply-color-text-brand)] hover:underline"
              >
                Abrir perfil →
              </Link>
            </div>
          ) : (
            <p className="text-[11px] italic text-[var(--looply-color-text-muted)]">
              Nenhum cliente vinculado a esta conversa.
            </p>
          )}
        </div>

        {/* AI Governance */}
        <div className="space-y-2 rounded-[10px] bg-[var(--looply-color-bg-subtle)] p-3">
          <span className="block text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--looply-color-text-muted)]">
            Governança da IA
          </span>
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                aiStatus === "ACTIVE"
                  ? "bg-[var(--looply-color-status-success)]"
                  : aiStatus === "PAUSED"
                  ? "bg-[var(--looply-color-status-warning)]"
                  : "bg-[var(--looply-color-status-danger)]"
              }`}
            />
            <span className="text-xs font-bold text-[var(--looply-color-text-primary)]">
              {aiStatus === "ACTIVE"
                ? "Assistente Ativo no WhatsApp"
                : aiStatus === "PAUSED"
                ? "Assistente Pausado"
                : "Requer Atenção"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {aiStatus !== "ACTIVE" && (
              <button
                type="button"
                onClick={() => handleSetStatus("ACTIVE")}
                disabled={setAiStatusMutation.isPending}
                className="cursor-pointer rounded-[8px] bg-[var(--looply-color-action-primary)] px-2.5 py-1 text-[11px] font-semibold text-[var(--looply-color-text-on-brand)] transition-colors hover:bg-[var(--looply-color-action-primary-hover)]"
              >
                Ativar
              </button>
            )}
            {aiStatus !== "PAUSED" && (
              <button
                type="button"
                onClick={() => handleSetStatus("PAUSED")}
                disabled={setAiStatusMutation.isPending}
                className="cursor-pointer rounded-[8px] border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--looply-color-text-primary)] transition-colors hover:bg-[var(--looply-color-coral-100)]"
              >
                Pausar
              </button>
            )}
            {aiStatus !== "NEEDS_ATTENTION" && (
              <button
                type="button"
                onClick={() => handleSetStatus("NEEDS_ATTENTION")}
                disabled={setAiStatusMutation.isPending}
                className="cursor-pointer rounded-[8px] border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--looply-color-status-danger)] transition-colors hover:bg-[var(--looply-color-coral-100)]"
              >
                Sinalizar Atenção
              </button>
            )}
          </div>
        </div>

        {/* Recent AI Structured Actions */}
        <div className="space-y-2.5">
          <span className="block text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--looply-color-text-muted)]">
            Ações Recentes da IA
          </span>

          {recentActions.length === 0 ? (
            <p className="text-[11px] italic text-[var(--looply-color-text-muted)]">
              Nenhuma ação estruturada executada nesta conversa ainda.
            </p>
          ) : (
            <div className="space-y-2">
              {recentActions.map((m) => {
                const action = m.action!;
                return (
                  <div
                    key={m.id}
                    className="space-y-1 rounded-[10px] bg-[var(--looply-color-bg-subtle)] p-2.5 text-xs"
                  >
                    <div className="flex items-center justify-between text-[10.5px] text-[var(--looply-color-text-secondary)]">
                      <span className="font-bold text-[var(--looply-color-text-primary)]">
                        {action.type === "APPOINTMENT_CREATED"
                          ? "📅 Agendamento"
                          : action.type === "JOB_CREATED"
                          ? "📋 Demanda"
                          : action.type.startsWith("CONFIRMATION")
                          ? "⏳ Confirmação"
                          : "⚠️ Ação IA"}
                      </span>
                      <span className="text-[var(--looply-color-text-muted)]">
                        {formatMessageTime(m.createdAt)}
                      </span>
                    </div>
                    {Boolean(action.metadata?.title) && (
                      <p className="truncate font-semibold text-[var(--looply-color-text-primary)]">
                        {String(action.metadata?.title)}
                      </p>
                    )}
                    {Boolean(action.metadata?.startsAt) && (
                      <p className="text-[11px] text-[var(--looply-color-text-secondary)]">
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
