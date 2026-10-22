import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import type { ConversationSummaryDto } from "../../../lib/types";
import { useConversationMessages, useSendConversationMessage } from "../../../lib/api";
import ChatHeader from "./ChatHeader";
import MessageList, { type MessageListHandle } from "./MessageList";
import AIStatusFooter from "./AIStatusFooter";
import ConversationSearchBar from "./ConversationSearchBar";
import ContextPanel from "./ContextPanel";

interface Props {
  conversation: ConversationSummaryDto | null;
  isMobile?: boolean;
  onBack?: () => void;
}

/** Tracks a CSS media query, SSR/jsdom-safe (returns false when unavailable). */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return false;
    }
    return window.matchMedia(query).matches;
  });
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);
  return matches;
}

export default function ChatWindow({ conversation, isMobile = false, onBack }: Props) {
  const messageListRef = useRef<MessageListHandle>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const [draft, setDraft] = useState("");

  // Context panel: a fixed 3rd column on wide screens, collapsible via the
  // header ⓘ. Default follows screen width; once the user toggles, their
  // choice sticks (override) even as the viewport changes.
  const isWide = useMediaQuery("(min-width: 1280px)");
  const [infoOverride, setInfoOverride] = useState<boolean | null>(null);
  const isInfoOpen = infoOverride ?? isWide;
  const toggleInfo = () => setInfoOverride((prev) => !(prev ?? isWide));
  const sendMutation = useSendConversationMessage();

  const handleSend = useCallback(() => {
    const text = draft.trim();
    if (!text || !conversation) return;
    sendMutation.mutate(
      { conversationId: conversation.id, body: text },
      { onSuccess: () => setDraft("") },
    );
  }, [draft, conversation, sendMutation]);

  const { data: messagesData, isLoading } = useConversationMessages(
    conversation?.id ?? null,
  );

  const messages = useMemo(() => messagesData?.items ?? [], [messagesData]);

  // Search matches
  const searchMatches = useMemo(() => {
    if (!searchQuery.trim() || messages.length === 0) return [];
    const q = searchQuery.toLowerCase();
    return messages.filter(
      (m) =>
        (m.body && m.body.toLowerCase().includes(q)) ||
        (m.transcription && m.transcription.toLowerCase().includes(q)),
    );
  }, [messages, searchQuery]);

  const activeSearchMessage = searchMatches[activeSearchIndex] || null;

  const handleNextSearch = () => {
    if (searchMatches.length === 0) return;
    const nextIdx = (activeSearchIndex + 1) % searchMatches.length;
    setActiveSearchIndex(nextIdx);
    if (searchMatches[nextIdx]) {
      messageListRef.current?.scrollToMessageId(searchMatches[nextIdx].id);
    }
  };

  const handlePrevSearch = () => {
    if (searchMatches.length === 0) return;
    const prevIdx =
      (activeSearchIndex - 1 + searchMatches.length) % searchMatches.length;
    setActiveSearchIndex(prevIdx);
    if (searchMatches[prevIdx]) {
      messageListRef.current?.scrollToMessageId(searchMatches[prevIdx].id);
    }
  };

  const handleToggleSearch = () => {
    if (isSearchOpen) {
      setIsSearchOpen(false);
      setSearchQuery("");
      setActiveSearchIndex(0);
    } else {
      setIsSearchOpen(true);
    }
  };

  if (!conversation) {
    return (
      <div className="flex h-full flex-1 flex-col items-center justify-center rounded-[10px] border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] p-8 text-center text-[var(--looply-color-text-muted)]">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[14px] bg-[var(--looply-color-coral-100)] text-[var(--looply-color-action-primary)]">
          <svg
            className="h-7 w-7"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.75}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
        </div>
        <h3 className="mb-1 text-base font-bold text-[var(--looply-color-text-primary)]">
          Nenhuma conversa selecionada
        </h3>
        <p className="max-w-sm text-xs leading-relaxed text-[var(--looply-color-text-secondary)]">
          Selecione um contato na lista ao lado para acompanhar o atendimento e as respostas do assistente de IA.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 gap-4 overflow-hidden">
      {/* Central Thread Card (Figma 16 — 490:7 Conversation Thread) */}
      <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[10px] border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)]">
        {/* Header */}
        <ChatHeader
          conversation={conversation}
          isMobile={isMobile}
          onBack={onBack}
          onToggleSearch={handleToggleSearch}
          isSearchOpen={isSearchOpen}
          onToggleInfo={toggleInfo}
          isInfoOpen={isInfoOpen}
        />

        {/* In-Chat Search Bar */}
        {isSearchOpen && (
          <ConversationSearchBar
            query={searchQuery}
            setQuery={(q) => {
              setSearchQuery(q);
              setActiveSearchIndex(0);
            }}
            matchesCount={searchMatches.length}
            activeIndex={activeSearchIndex}
            onNext={handleNextSearch}
            onPrevious={handlePrevSearch}
            onClose={() => {
              setIsSearchOpen(false);
              setSearchQuery("");
            }}
          />
        )}

        {/* Message List */}
        <MessageList
          ref={messageListRef}
          messages={messages}
          selectedConversationId={conversation.id}
          searchQuery={searchQuery}
          activeSearchMessageId={activeSearchMessage?.id}
          isLoading={isLoading}
        />

        {/* Human reply input (Figma 16 — Composer) */}
        <div className="shrink-0 border-t border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] px-4 py-3">
          <div className="flex items-end gap-2.5">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Responder como humano..."
              rows={1}
              className="
                flex-1 resize-none rounded-[10px] border
                border-[var(--looply-color-border-default)]
                bg-[var(--looply-color-bg-subtle)] px-3.5 py-2 text-xs
                text-[var(--looply-color-text-primary)]
                placeholder:text-[var(--looply-color-text-muted)]
                focus:border-[var(--looply-color-action-primary)]
                focus:bg-[var(--looply-color-bg-surface)]
                focus:outline-none focus:ring-2
                focus:ring-[var(--looply-color-focus)]
              "
              style={{ maxHeight: 120 }}
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!draft.trim() || sendMutation.isPending}
              className="
                shrink-0 cursor-pointer rounded-[10px]
                bg-[var(--looply-color-action-primary)] px-4 py-2 text-xs
                font-semibold text-[var(--looply-color-text-on-brand)]
                transition-colors
                hover:bg-[var(--looply-color-action-primary-hover)]
                disabled:cursor-not-allowed disabled:opacity-40
              "
            >
              {sendMutation.isPending ? "Enviando..." : "Enviar"}
            </button>
          </div>
          {sendMutation.isError && (
            <p className="mt-1 text-xs text-[var(--looply-color-status-danger)]">
              Falha ao enviar. Tente novamente.
            </p>
          )}
        </div>

        {/* Autonomous AI Status Footer */}
        <AIStatusFooter conversation={conversation} />
      </div>

      {/* Right Desktop Context Panel (Figma 16 — 490:7 Contact Context) */}
      {isInfoOpen && (
        <ContextPanel
          conversation={conversation}
          messages={messages}
          onClose={() => setInfoOverride(false)}
        />
      )}
    </div>
  );
}
