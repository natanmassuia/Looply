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
    <div className="relative flex-1 min-w-0 min-h-0 h-full bg-[var(--looply-color-bg-canvas,#f8fafc)] dark:bg-zinc-950">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-full w-full min-w-0 overflow-y-auto overflow-x-hidden px-3 sm:px-4 md:px-6 py-4 space-y-1"
      >
        {isLoading && messages.length === 0 ? (
          <div className="flex justify-center items-center h-full text-xs text-[var(--looply-color-text-muted,#71717a)]">
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
          <div className="flex flex-col items-center justify-center h-full text-center p-6 text-[var(--looply-color-text-muted,#71717a)]">
            <div className="w-12 h-12 rounded-full bg-[var(--looply-color-bg-subtle,#f4f4f5)] flex items-center justify-center mb-2">
              <svg
                className="w-6 h-6 text-[var(--looply-color-text-muted,#71717a)]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </div>
            <p className="text-sm font-medium">Nenhuma mensagem nesta conversa</p>
            <p className="text-xs opacity-75 mt-1">
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
                  <div className="flex justify-center my-3">
                    <span className="text-[10.5px] font-semibold tracking-wide uppercase px-3 py-1 rounded-full bg-[var(--looply-color-bg-subtle,#f4f4f5)] border border-[var(--looply-color-border-default,#e4e4e7)] text-[var(--looply-color-text-muted,#71717a)] select-none shadow-xs">
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
          className="absolute bottom-4 right-6 w-10 h-10 rounded-full bg-[var(--looply-color-bg-surface,#ffffff)] border border-[var(--looply-color-border-default,#e4e4e7)] text-[var(--looply-color-text-primary,#18181b)] shadow-lg hover:shadow-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 z-10 cursor-pointer"
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
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        </button>
      )}
    </div>
  );
});

export default MessageList;
