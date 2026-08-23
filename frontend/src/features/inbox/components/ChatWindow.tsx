import { useState, useMemo, useRef } from "react";
import type { ConversationSummaryDto } from "../../../lib/types";
import { useConversationMessages } from "../../../lib/api";
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

export default function ChatWindow({ conversation, isMobile = false, onBack }: Props) {
  const messageListRef = useRef<MessageListHandle>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const [isInfoOpen, setIsInfoOpen] = useState(false);

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
      <div className="flex-1 flex flex-col items-center justify-center h-full bg-[var(--looply-color-bg-canvas,#f8fafc)] dark:bg-zinc-950 text-center p-8 text-[var(--looply-color-text-muted,#71717a)]">
        <div className="w-16 h-16 rounded-2xl bg-[var(--looply-color-bg-subtle,#f4f4f5)] flex items-center justify-center mb-4 text-[var(--looply-color-text-brand,#2563eb)]">
          <svg
            className="w-8 h-8"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
        </div>
        <h3 className="text-base font-bold text-[var(--looply-color-text-primary,#18181b)] mb-1">
          Nenhuma conversa selecionada
        </h3>
        <p className="text-sm max-w-sm">
          Selecione um contato na lista ao lado para acompanhar o atendimento e as respostas do assistente de IA.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex min-w-0 min-h-0 h-full overflow-hidden">
      {/* Central Thread View */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 h-full overflow-hidden relative bg-[var(--looply-color-bg-canvas,#f8fafc)] dark:bg-zinc-950">
        {/* Header */}
        <ChatHeader
          conversation={conversation}
          isMobile={isMobile}
          onBack={onBack}
          onToggleSearch={handleToggleSearch}
          isSearchOpen={isSearchOpen}
          onToggleInfo={() => setIsInfoOpen((o) => !o)}
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

        {/* Autonomous AI Status Footer */}
        <AIStatusFooter conversation={conversation} />
      </div>

      {/* Right Desktop Context Panel */}
      {isInfoOpen && (
        <ContextPanel
          conversation={conversation}
          messages={messages}
          onClose={() => setIsInfoOpen(false)}
        />
      )}
    </div>
  );
}
