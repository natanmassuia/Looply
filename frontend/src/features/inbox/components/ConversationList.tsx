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
    <div className="flex flex-col h-full bg-[var(--looply-color-bg-surface,#ffffff)] border-r border-[var(--looply-color-border-default,#e4e4e7)] overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-[var(--looply-color-border-default,#e4e4e7)] shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-[var(--looply-color-text-primary,#18181b)]">
              Inbox IA
            </h1>
            {totalUnread > 0 && (
              <span className="px-2 py-0.5 text-xs font-bold bg-[var(--looply-color-text-brand,#2563eb)] text-white rounded-full">
                {totalUnread}
              </span>
            )}
          </div>
        </div>

        {/* Search Input */}
        <div className="relative mb-3">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--looply-color-text-muted,#71717a)]"
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
            placeholder="Buscar por contato ou telefone..."
            aria-label="Buscar conversas"
            className="w-full pl-9 pr-8 py-1.5 text-xs bg-[var(--looply-color-bg-subtle,#f4f4f5)] border border-[var(--looply-color-border-default,#e4e4e7)] focus:border-[var(--looply-color-text-brand,#2563eb)] rounded-lg outline-none text-[var(--looply-color-text-primary,#18181b)] placeholder:text-[var(--looply-color-text-muted,#71717a)] transition-all"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              aria-label="Limpar busca"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[var(--looply-color-text-muted,#71717a)] hover:text-[var(--looply-color-text-primary,#18181b)] cursor-pointer border-none bg-transparent p-0"
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
            className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors border cursor-pointer ${
              selectedAiStatus === "ALL"
                ? "bg-[var(--looply-color-text-brand,#2563eb)] text-white border-[var(--looply-color-text-brand,#2563eb)] shadow-xs"
                : "bg-[var(--looply-color-bg-subtle,#f4f4f5)] text-[var(--looply-color-text-muted,#71717a)] border-[var(--looply-color-border-default,#e4e4e7)] hover:text-[var(--looply-color-text-primary,#18181b)]"
            }`}
          >
            Todas
          </button>
          <button
            type="button"
            onClick={() => onSelectAiStatus("ACTIVE")}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors border cursor-pointer flex items-center gap-1.5 ${
              selectedAiStatus === "ACTIVE"
                ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                : "bg-[var(--looply-color-bg-subtle,#f4f4f5)] text-[var(--looply-color-text-muted,#71717a)] border-[var(--looply-color-border-default,#e4e4e7)] hover:text-[var(--looply-color-text-primary,#18181b)]"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Ativas
          </button>
          <button
            type="button"
            onClick={() => onSelectAiStatus("NEEDS_ATTENTION")}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors border cursor-pointer flex items-center gap-1.5 ${
              selectedAiStatus === "NEEDS_ATTENTION"
                ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                : "bg-[var(--looply-color-bg-subtle,#f4f4f5)] text-[var(--looply-color-text-muted,#71717a)] border-[var(--looply-color-border-default,#e4e4e7)] hover:text-[var(--looply-color-text-primary,#18181b)]"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            Atenção
          </button>
          <button
            type="button"
            onClick={() => onSelectAiStatus("PAUSED")}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors border cursor-pointer flex items-center gap-1.5 ${
              selectedAiStatus === "PAUSED"
                ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                : "bg-[var(--looply-color-bg-subtle,#f4f4f5)] text-[var(--looply-color-text-muted,#71717a)] border-[var(--looply-color-border-default,#e4e4e7)] hover:text-[var(--looply-color-text-primary,#18181b)]"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Pausadas
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {isLoading && conversations.length === 0 ? (
          <div className="flex justify-center items-center h-48 text-xs text-[var(--looply-color-text-muted,#71717a)]">
            <svg
              className="w-5 h-5 animate-spin mr-2 text-[var(--looply-color-text-brand,#2563eb)]"
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
          <div className="flex flex-col items-center justify-center h-48 text-center p-4 text-[var(--looply-color-text-muted,#71717a)]">
            <p className="text-xs font-medium">Nenhuma conversa encontrada</p>
            <p className="text-[11px] opacity-75 mt-0.5">
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
