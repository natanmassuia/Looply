import { Fragment, useRef, useImperativeHandle, forwardRef } from "react";
import type { ConversationMessageDto } from "../../../lib/types";
import MessageBubble from "./MessageBubble";
import { formatDateHeader } from "../utils/time";
import { useChatScroll } from "../hooks/useChatScroll";

export interface MessageListHandle {
  scrollToBottom: (smooth?: boolean) => void;
  scrollToMessageId: (id: string) => void;
}

interface Props {
  messages: ConversationMessageDto[];
  selectedConversationId: string;
  searchQuery?: string;
  activeSearchMessageId?: string;
  isLoading?: boolean;
}

const MessageList = forwardRef<MessageListHandle, Props>(function MessageList(
  {
    messages,
    selectedConversationId,
    searchQuery = "",
    activeSearchMessageId,
    isLoading = false,
  },
  ref,
) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const { bottomRef, scrollToBottom, handleScroll, showScrollBottom } =
    useChatScroll({
      messages,
      selectedConversationId,
      scrollRef,
    });

  const scrollToMessageId = (id: string) => {
    const el = scrollRef.current?.querySelector(`[data-message-id="${id}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  useImperativeHandle(
    ref,
    () => ({
      scrollToBottom,
      scrollToMessageId,
    }),
    [scrollToBottom],
  );

  return (
    <div className="relative h-full min-h-0 min-w-0 flex-1 bg-[var(--looply-color-bg-canvas)]">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-full w-full min-w-0 space-y-2 overflow-x-hidden overflow-y-auto px-3 py-4 sm:px-4 md:px-5"
      >
        {isLoading && messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-[var(--looply-color-text-muted)]">
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
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              />
            </svg>
            Carregando mensagens...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center p-6 text-center text-[var(--looply-color-text-muted)]">
            <div className="mb-2.5 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--looply-color-coral-100)]">
              <svg
                className="h-6 w-6 text-[var(--looply-color-action-primary)]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.75}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </div>
            <p className="text-sm font-semibold text-[var(--looply-color-text-primary)]">
              Nenhuma mensagem nesta conversa
            </p>
            <p className="mt-1 text-xs text-[var(--looply-color-text-secondary)]">
              As mensagens trocadas no WhatsApp aparecerão aqui em tempo real.
            </p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const prevMsg = messages[index - 1];
            const isDifferentDay =
              !prevMsg ||
              new Date(msg.createdAt).toDateString() !==
                new Date(prevMsg.createdAt).toDateString();

            return (
              <Fragment key={msg.id}>
                {isDifferentDay && (
                  <div className="my-3 flex justify-center">
                    <span className="select-none rounded-full border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-subtle)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--looply-color-text-muted)]">
                      {formatDateHeader(msg.createdAt)}
                    </span>
                  </div>
                )}
                <MessageBubble
                  msg={msg}
                  searchQuery={searchQuery}
                  isSearchActive={Boolean(searchQuery)}
                  isHighlighted={activeSearchMessageId === msg.id}
                />
              </Fragment>
            );
          })
        )}

        <div ref={bottomRef} aria-hidden="true" className="h-px w-full" />
      </div>

      {/* Floating Scroll to Bottom Button */}
      {showScrollBottom && (
        <button
          type="button"
          onClick={() => scrollToBottom(true)}
          aria-label="Rolar para o final"
          className="absolute bottom-4 right-6 z-10 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] text-[var(--looply-color-text-primary)] shadow-md transition-all hover:scale-105 active:scale-95"
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
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        </button>
      )}
    </div>
  );
});

export default MessageList;
