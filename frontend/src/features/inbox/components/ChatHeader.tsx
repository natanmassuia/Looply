import { useState } from "react";
import type { ConversationSummaryDto, ConversationAiStatus } from "../../../lib/types";
import { useClients, useBindConversationClient, useSetConversationAiStatus } from "../../../lib/api";
import { formatPhone } from "../../../lib/format";

interface Props {
  conversation: ConversationSummaryDto;
  isMobile?: boolean;
  onBack?: () => void;
  onToggleSearch: () => void;
  isSearchOpen: boolean;
  onToggleInfo?: () => void;
  isInfoOpen?: boolean;
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

export default function ChatHeader({
  conversation,
  isMobile = false,
  onBack,
  onToggleSearch,
  isSearchOpen,
  onToggleInfo,
  isInfoOpen = false,
}: Props) {
  const { data: clients } = useClients();
  const bindClientMutation = useBindConversationClient();
  const setAiStatusMutation = useSetConversationAiStatus();

  const [clientMenuOpen, setClientMenuOpen] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);

  const displayName =
    conversation.contactName || formatPhone(conversation.remotePhone);
  const phoneLabel = formatPhone(conversation.remotePhone);

  const handleSelectClient = (clientId: string | null) => {
    bindClientMutation.mutate({ id: conversation.id, clientId });
    setClientMenuOpen(false);
  };

  const handleSelectAiStatus = (aiStatus: ConversationAiStatus) => {
    setAiStatusMutation.mutate({ id: conversation.id, aiStatus });
    setStatusMenuOpen(false);
  };

  const aiStatus = conversation.aiStatus;

  return (
    <header className="relative z-10 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] px-4">
      {/* Left section: Mobile Back + Contact Info */}
      <div className="flex min-w-0 items-center gap-3">
        {isMobile && onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Voltar para lista de conversas"
            className="-ml-1 cursor-pointer rounded-[10px] border-none bg-transparent p-1.5 text-[var(--looply-color-text-muted)] transition-colors hover:bg-[var(--looply-color-bg-subtle)] hover:text-[var(--looply-color-text-primary)]"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
        )}

        {/* Contact Avatar (Figma 16 — 40×40 coral-100 circle) */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--looply-color-action-primary)_14%,transparent)] text-xs font-bold text-[var(--looply-color-text-primary)]">
          {conversation.contactAvatarUrl ? (
            <img
              src={conversation.contactAvatarUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <span>{initials(displayName)}</span>
          )}
        </div>

        {/* Contact Name & Details */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-sm font-bold text-[var(--looply-color-text-primary)]">
              {displayName}
            </h2>
            {conversation.client && (
              <span className="hidden items-center rounded-full bg-[color-mix(in_srgb,var(--looply-color-action-primary)_14%,transparent)] px-2 py-0.5 text-[10.5px] font-semibold text-[var(--looply-color-text-primary)] sm:inline-flex">
                {conversation.client.name}
              </span>
            )}
          </div>
          <p className="flex items-center gap-1.5 truncate text-[11px] tabular-nums text-[var(--looply-color-text-muted)]">
            <span>{phoneLabel}</span>
            <span aria-hidden="true">·</span>
            <span>WhatsApp Cloud API</span>
          </p>
        </div>
      </div>

      {/* Right section: AI Status Badge + Client Picker + Search Toggle */}
      <div className="flex shrink-0 items-center gap-2">
        {/* AI Status Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setStatusMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={statusMenuOpen}
            aria-label="Alterar status da IA"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-subtle)] px-3 py-1.5 text-[11px] font-semibold text-[var(--looply-color-text-primary)] transition-colors hover:opacity-90"
          >
            <span
              className={`h-2 w-2 rounded-full ${
                aiStatus === "ACTIVE"
                  ? "bg-[var(--looply-color-status-success)]"
                  : aiStatus === "PAUSED"
                  ? "bg-[var(--looply-color-status-warning)]"
                  : "bg-[var(--looply-color-status-danger)]"
              }`}
            />
            <span>
              {aiStatus === "ACTIVE"
                ? "IA Ativa"
                : aiStatus === "PAUSED"
                ? "IA Pausada"
                : "Atenção"}
            </span>
            <svg
              className="ml-0.5 h-3.5 w-3.5 text-[var(--looply-color-text-muted)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {statusMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-20"
                onClick={() => setStatusMenuOpen(false)}
              />
              <div
                role="menu"
                aria-label="Opções de status da IA"
                className="absolute right-0 z-30 mt-1.5 w-44 space-y-0.5 rounded-[10px] border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] p-1 shadow-lg"
              >
                <button
                  type="button"
                  onClick={() => handleSelectAiStatus("ACTIVE")}
                  className={`flex w-full items-center gap-2 rounded-[8px] px-2.5 py-1.5 text-left text-xs font-medium text-[var(--looply-color-text-primary)] hover:bg-[var(--looply-color-bg-subtle)] ${
                    aiStatus === "ACTIVE" ? "bg-[var(--looply-color-bg-subtle)] font-bold" : ""
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-[var(--looply-color-status-success)]" />
                  Ativar IA
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectAiStatus("PAUSED")}
                  className={`flex w-full items-center gap-2 rounded-[8px] px-2.5 py-1.5 text-left text-xs font-medium text-[var(--looply-color-text-primary)] hover:bg-[var(--looply-color-bg-subtle)] ${
                    aiStatus === "PAUSED" ? "bg-[var(--looply-color-bg-subtle)] font-bold" : ""
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-[var(--looply-color-status-warning)]" />
                  Pausar IA
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectAiStatus("NEEDS_ATTENTION")}
                  className={`flex w-full items-center gap-2 rounded-[8px] px-2.5 py-1.5 text-left text-xs font-medium text-[var(--looply-color-text-primary)] hover:bg-[var(--looply-color-bg-subtle)] ${
                    aiStatus === "NEEDS_ATTENTION" ? "bg-[var(--looply-color-bg-subtle)] font-bold" : ""
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-[var(--looply-color-status-danger)]" />
                  Requer Atenção
                </button>
              </div>
            </>
          )}
        </div>

        {/* Client Binding Dropdown */}
        <div className="relative hidden md:block">
          <button
            type="button"
            onClick={() => setClientMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={clientMenuOpen}
            aria-label="Vincular cliente"
            className="flex cursor-pointer items-center gap-1.5 rounded-[10px] border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--looply-color-text-secondary)] transition-colors hover:bg-[var(--looply-color-bg-subtle)] hover:text-[var(--looply-color-text-primary)]"
            title="Vincular ou alterar cliente"
          >
            <svg
              className="h-3.5 w-3.5 text-[var(--looply-color-text-muted)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
              />
              <circle cx="9" cy="7" r="4" />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11"
              />
            </svg>
            <span className="max-w-[100px] truncate">
              {conversation.client?.name || "Vincular"}
            </span>
          </button>

          {clientMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-20"
                onClick={() => setClientMenuOpen(false)}
              />
              <div
                role="menu"
                aria-label="Selecionar cliente"
                className="absolute right-0 z-30 mt-1.5 max-h-60 w-56 overflow-y-auto rounded-[10px] border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] p-1.5 shadow-lg"
              >
                <div className="px-2 py-1 text-[10.5px] font-bold uppercase tracking-wider text-[var(--looply-color-text-muted)]">
                  Vincular a um cliente
                </div>
                {conversation.client && (
                  <button
                    type="button"
                    onClick={() => handleSelectClient(null)}
                    className="mb-1 w-full rounded-[8px] px-2.5 py-1.5 text-left text-xs font-medium text-[var(--looply-color-status-danger)] hover:bg-[var(--looply-color-bg-subtle)]"
                  >
                    Desvincular cliente
                  </button>
                )}
                {clients && clients.length > 0 ? (
                  clients.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelectClient(c.id)}
                      className={`flex w-full items-center justify-between truncate rounded-[8px] px-2.5 py-1.5 text-left text-xs font-medium text-[var(--looply-color-text-primary)] hover:bg-[var(--looply-color-bg-subtle)] ${
                        conversation.client?.id === c.id
                          ? "bg-[var(--looply-color-coral-100)] font-bold"
                          : ""
                      }`}
                    >
                      <span className="truncate">{c.name}</span>
                      {conversation.client?.id === c.id && (
                        <svg
                          className="h-3.5 w-3.5 shrink-0 text-[var(--looply-color-action-primary)]"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </button>
                  ))
                ) : (
                  <div className="px-2.5 py-2 text-xs italic text-[var(--looply-color-text-muted)]">
                    Nenhum cliente cadastrado
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Search Toggle */}
        <button
          type="button"
          onClick={onToggleSearch}
          aria-label={isSearchOpen ? "Fechar busca" : "Buscar na conversa"}
          aria-pressed={isSearchOpen}
          className={`cursor-pointer rounded-[10px] border-none p-2 transition-colors ${
            isSearchOpen
              ? "bg-[var(--looply-color-coral-100)] text-[var(--looply-color-text-primary)]"
              : "bg-transparent text-[var(--looply-color-text-muted)] hover:bg-[var(--looply-color-bg-subtle)] hover:text-[var(--looply-color-text-primary)]"
          }`}
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        </button>

        {/* Info/Context Panel Toggle */}
        {onToggleInfo && (
          <button
            type="button"
            onClick={onToggleInfo}
            aria-label={isInfoOpen ? "Ocultar detalhes" : "Ver detalhes do contato"}
            aria-pressed={isInfoOpen}
            className={`cursor-pointer rounded-[10px] border-none p-2 transition-colors ${
              isInfoOpen
                ? "bg-[var(--looply-color-coral-100)] text-[var(--looply-color-text-primary)]"
                : "bg-transparent text-[var(--looply-color-text-muted)] hover:bg-[var(--looply-color-bg-subtle)] hover:text-[var(--looply-color-text-primary)]"
            }`}
            title="Detalhes do contato e contexto da IA"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
          </button>
        )}
      </div>
    </header>
  );
}
