import { useState, useEffect } from "react";
import type { ConversationSummaryDto, ConversationAiStatus } from "../../../lib/types";
import ConversationItem from "./ConversationItem";

interface Props {
  conversations: ConversationSummaryDto[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isLoading?: boolean;
  selectedAiStatus?: ConversationAiStatus | "ALL";
  onSelectAiStatus: (status: ConversationAiStatus | "ALL") => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
}

export default function ConversationList({
  conversations,
  selectedId,
  onSelect,
  isLoading = false,
  selectedAiStatus = "ALL",
  onSelectAiStatus,
  searchTerm,
  onSearchChange,
}: Props) {
  // Tick every minute to refresh relative timestamps
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const totalUnread = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--looply-color-bg-surface)]">
      {/* Header + Search + Filters (Figma 16 — 490:7 Conversation List) */}
      <div className="shrink-0 space-y-2.5 border-b border-[var(--looply-color-border-default)] p-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold uppercase tracking-[0.06em] text-[var(--looply-color-text-muted)]">
              Inbox IA
            </h2>
            {totalUnread > 0 && (
              <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--looply-color-action-primary)] px-1.5 text-[11px] font-bold text-[var(--looply-color-text-on-brand)]">
                {totalUnread}
              </span>
            )}
          </div>
          <span className="text-[11px] font-medium text-[var(--looply-color-text-muted)]">
            {conversations.length} {conversations.length === 1 ? "conversa" : "conversas"}
          </span>
        </div>

        {/* Search Input */}
        <div className="relative">
          <svg
            className="
              pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5
              -translate-y-1/2 text-[var(--looply-color-text-muted)]
            "
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar contato ou mensagem…"
            aria-label="Buscar conversas"
            className="
              w-full rounded-[10px] border border-transparent
              bg-[var(--looply-color-bg-subtle)] py-2 pl-8 pr-7 text-xs
              text-[var(--looply-color-text-primary)]
              placeholder:text-[var(--looply-color-text-muted)]
              focus:border-[var(--looply-color-action-primary)]
              focus:bg-[var(--looply-color-bg-surface)] focus:outline-none
              transition-all
            "
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              aria-label="Limpar busca"
              className="
                absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer
                border-none bg-transparent p-0 text-xs
                text-[var(--looply-color-text-muted)]
                hover:text-[var(--looply-color-text-primary)]
              "
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 custom-scrollbar">
          <button
            type="button"
            onClick={() => onSelectAiStatus("ALL")}
            className={`cursor-pointer whitespace-nowrap rounded-[10px] border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
              selectedAiStatus === "ALL"
                ? "border-transparent bg-[var(--looply-color-bg-subtle)] font-bold text-[var(--looply-color-text-primary)]"
                : "border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] text-[var(--looply-color-text-muted)] hover:bg-[var(--looply-color-bg-subtle)] hover:text-[var(--looply-color-text-primary)]"
            }`}
          >
            Todas ({conversations.length})
          </button>
          <button
            type="button"
            onClick={() => onSelectAiStatus("ACTIVE")}
            className={`flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-[10px] border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
              selectedAiStatus === "ACTIVE"
                ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                : "border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] text-[var(--looply-color-text-muted)] hover:bg-[var(--looply-color-bg-subtle)] hover:text-[var(--looply-color-text-primary)]"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--looply-color-status-success)]" />
            Ativas
          </button>
          <button
            type="button"
            onClick={() => onSelectAiStatus("NEEDS_ATTENTION")}
            className={`flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-[10px] border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
              selectedAiStatus === "NEEDS_ATTENTION"
                ? "border-transparent bg-[var(--looply-color-coral-100)] font-bold text-[var(--looply-color-text-primary)]"
                : "border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] text-[var(--looply-color-text-muted)] hover:bg-[var(--looply-color-bg-subtle)] hover:text-[var(--looply-color-text-primary)]"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--looply-color-status-danger)]" />
            Atenção
          </button>
          <button
            type="button"
            onClick={() => onSelectAiStatus("PAUSED")}
            className={`flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-[10px] border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
              selectedAiStatus === "PAUSED"
                ? "border-transparent bg-[var(--looply-color-bg-subtle)] font-bold text-[var(--looply-color-text-primary)]"
                : "border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] text-[var(--looply-color-text-muted)] hover:bg-[var(--looply-color-bg-subtle)] hover:text-[var(--looply-color-text-primary)]"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--looply-color-status-warning)]" />
            Pausadas
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 space-y-1.5 overflow-y-auto p-3">
        {isLoading && conversations.length === 0 ? (
          <div className="flex h-48 items-center justify-center text-xs text-[var(--looply-color-text-muted)]">
            <svg
              className="mr-2 h-5 w-5 animate-spin text-[var(--looply-color-action-primary)]"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth={4}
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              />
            </svg>
            Carregando conversas...
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center p-4 text-center text-[var(--looply-color-text-muted)]">
            <p className="text-xs font-semibold text-[var(--looply-color-text-secondary)]">
              Nenhuma conversa encontrada
            </p>
            <p className="mt-1 text-[11px]">
              {searchTerm
                ? "Nenhum resultado para os termos pesquisados."
                : "Novas mensagens recebidas via WhatsApp aparecerão aqui."}
            </p>
          </div>
        ) : (
          conversations.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              isSelected={selectedId === conv.id}
              onClick={() => onSelect(conv.id)}
              now={now}
            />
          ))
        )}
      </div>
    </div>
  );
}
