import { useState } from "react";
import type { ConversationSummaryDto, ConversationAiStatus } from "../../../lib/types";
import { useClients, useBindConversationClient, useSetConversationAiStatus } from "../../../lib/api";

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

function formatPhone(phone: string): string {
  if (phone.startsWith("+55") && phone.length === 14) {
    return phone.replace(/(\+55)(\d{2})(\d{5})(\d{4})/, "$1 ($2) $3-$4");
  }
  if (phone.startsWith("+55") && phone.length === 13) {
    return phone.replace(/(\+55)(\d{2})(\d{4})(\d{4})/, "$1 ($2) $3-$4");
  }
  return phone;
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
    <header className="h-16 shrink-0 border-b border-[var(--looply-color-border-default,#e4e4e7)] bg-[var(--looply-color-bg-surface,#ffffff)] px-4 flex items-center justify-between gap-3 relative z-10">
      {/* Left section: Mobile Back + Contact Info */}
      <div className="flex items-center gap-3 min-w-0">
        {isMobile && onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Voltar para lista de conversas"
            className="p-1.5 -ml-1 text-[var(--looply-color-text-muted,#71717a)] hover:text-[var(--looply-color-text-primary,#18181b)] rounded-lg hover:bg-[var(--looply-color-bg-subtle,#f4f4f5)] transition-colors cursor-pointer border-none bg-transparent"
          >
            <svg
              className="w-5 h-5"
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

        {/* Contact Avatar */}
        <div className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center bg-[var(--looply-color-bg-subtle,#f4f4f5)] text-[var(--looply-color-text-brand,#2563eb)] font-bold text-sm border border-[var(--looply-color-border-default,#e4e4e7)] overflow-hidden">
          {conversation.contactAvatarUrl ? (
            <img
              src={conversation.contactAvatarUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <span>{initials(displayName)}</span>
          )}
        </div>

        {/* Contact Name & Details */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-[var(--looply-color-text-primary,#18181b)] truncate">
              {displayName}
            </h2>
            {conversation.client && (
              <span className="hidden sm:inline-flex items-center text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                {conversation.client.name}
              </span>
            )}
          </div>
          <p className="text-[11.5px] text-[var(--looply-color-text-muted,#71717a)] tabular-nums truncate">
            {phoneLabel}
          </p>
        </div>
      </div>

      {/* Right section: AI Status Badge + Client Picker + Search Toggle */}
      <div className="flex items-center gap-2 shrink-0">
        {/* AI Status Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setStatusMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={statusMenuOpen}
            aria-label="Alterar status da IA"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold border transition-all cursor-pointer ${
              aiStatus === "ACTIVE"
                ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                : aiStatus === "PAUSED"
                ? "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                : "bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                aiStatus === "ACTIVE"
                  ? "bg-emerald-500 animate-pulse"
                  : aiStatus === "PAUSED"
                  ? "bg-amber-500"
                  : "bg-rose-500"
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
              className="w-3.5 h-3.5 opacity-60 ml-0.5"
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
                className="absolute right-0 mt-1.5 w-44 rounded-xl bg-[var(--looply-color-bg-surface,#ffffff)] border border-[var(--looply-color-border-default,#e4e4e7)] shadow-lg p-1 z-30 space-y-0.5"
              >
                <button
                  type="button"
                  onClick={() => handleSelectAiStatus("ACTIVE")}
                  className={`w-full text-left px-2.5 py-1.5 text-xs font-medium rounded-lg flex items-center gap-2 hover:bg-[var(--looply-color-bg-subtle,#f4f4f5)] ${
                    aiStatus === "ACTIVE" ? "text-emerald-600 font-bold" : ""
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Ativar IA
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectAiStatus("PAUSED")}
                  className={`w-full text-left px-2.5 py-1.5 text-xs font-medium rounded-lg flex items-center gap-2 hover:bg-[var(--looply-color-bg-subtle,#f4f4f5)] ${
                    aiStatus === "PAUSED" ? "text-amber-600 font-bold" : ""
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Pausar IA
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectAiStatus("NEEDS_ATTENTION")}
                  className={`w-full text-left px-2.5 py-1.5 text-xs font-medium rounded-lg flex items-center gap-2 hover:bg-[var(--looply-color-bg-subtle,#f4f4f5)] ${
                    aiStatus === "NEEDS_ATTENTION" ? "text-rose-600 font-bold" : ""
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
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
            className="p-1.5 text-[var(--looply-color-text-muted,#71717a)] hover:text-[var(--looply-color-text-primary,#18181b)] hover:bg-[var(--looply-color-bg-subtle,#f4f4f5)] rounded-lg transition-colors cursor-pointer border border-[var(--looply-color-border-default,#e4e4e7)] flex items-center gap-1.5 text-xs font-medium"
            title="Vincular ou alterar cliente"
          >
            <svg
              className="w-4 h-4"
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
                className="absolute right-0 mt-1.5 w-56 rounded-xl bg-[var(--looply-color-bg-surface,#ffffff)] border border-[var(--looply-color-border-default,#e4e4e7)] shadow-lg p-1.5 z-30 max-h-60 overflow-y-auto"
              >
                <div className="px-2 py-1 text-[11px] font-bold text-[var(--looply-color-text-muted,#71717a)] uppercase tracking-wider">
                  Vincular a um cliente
                </div>
                {conversation.client && (
                  <button
                    type="button"
                    onClick={() => handleSelectClient(null)}
                    className="w-full text-left px-2.5 py-1.5 text-xs font-medium text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 mb-1"
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
                      className={`w-full text-left px-2.5 py-1.5 text-xs font-medium rounded-lg hover:bg-[var(--looply-color-bg-subtle,#f4f4f5)] truncate flex items-center justify-between ${
                        conversation.client?.id === c.id
                          ? "bg-[var(--looply-color-bg-subtle,#f4f4f5)] font-bold text-[var(--looply-color-text-brand,#2563eb)]"
                          : ""
                      }`}
                    >
                      <span className="truncate">{c.name}</span>
                      {conversation.client?.id === c.id && (
                        <svg
                          className="w-3.5 h-3.5 text-[var(--looply-color-text-brand,#2563eb)] shrink-0"
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
                  <div className="px-2.5 py-2 text-xs text-[var(--looply-color-text-muted,#71717a)] italic">
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
          className={`p-2 rounded-lg transition-colors cursor-pointer border-none ${
            isSearchOpen
              ? "bg-[var(--looply-color-text-brand,#2563eb)] text-white"
              : "text-[var(--looply-color-text-muted,#71717a)] hover:text-[var(--looply-color-text-primary,#18181b)] hover:bg-[var(--looply-color-bg-subtle,#f4f4f5)] bg-transparent"
          }`}
        >
          <svg
            className="w-4 h-4"
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
            className={`p-2 rounded-lg transition-colors cursor-pointer border-none ${
              isInfoOpen
                ? "bg-[var(--looply-color-text-brand,#2563eb)] text-white"
                : "text-[var(--looply-color-text-muted,#71717a)] hover:text-[var(--looply-color-text-primary,#18181b)] hover:bg-[var(--looply-color-bg-subtle,#f4f4f5)] bg-transparent"
            }`}
            title="Detalhes do contato e contexto da IA"
          >
            <svg
              className="w-4 h-4"
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
