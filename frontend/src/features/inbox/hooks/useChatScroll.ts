import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { ConversationMessageDto } from "../../../lib/types";

interface UseChatScrollProps {
  messages: ConversationMessageDto[];
  selectedConversationId: string | null;
  scrollRef: RefObject<HTMLDivElement | null>;
}

export function useChatScroll({
  messages,
  selectedConversationId,
  scrollRef,
}: UseChatScrollProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const shouldStickToBottomRef = useRef(true);
  const lastConversationId = useRef<string | null>(null);
  const lastMessageCountRef = useRef(0);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const getDistanceFromBottom = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return 0;
    return Math.max(
      0,
      container.scrollHeight - container.clientHeight - container.scrollTop,
    );
  }, [scrollRef]);

  const scrollToBottom = useCallback(
    (smooth = true) => {
      const container = scrollRef.current;
      if (!container) return;

      shouldStickToBottomRef.current = true;
      setShowScrollBottom(false);

      if (smooth) {
        if (bottomRef.current) {
          bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
        } else {
          container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
        }
      } else {
        container.scrollTop = container.scrollHeight;
      }
    },
    [scrollRef],
  );

  const handleScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;

    const dist = getDistanceFromBottom();
    const isNearBottom = dist < 80;
    shouldStickToBottomRef.current = isNearBottom;
    setShowScrollBottom(!isNearBottom);
  }, [getDistanceFromBottom, scrollRef]);

  // When conversation ID changes, jump to bottom immediately
  useEffect(() => {
    if (selectedConversationId !== lastConversationId.current) {
      lastConversationId.current = selectedConversationId;
      lastMessageCountRef.current = messages.length;
      shouldStickToBottomRef.current = true;
      setShowScrollBottom(false);
      requestAnimationFrame(() => {
        scrollToBottom(false);
      });
    }
  }, [selectedConversationId, messages.length, scrollToBottom]);

  // When new messages arrive, scroll if shouldStickToBottom is true
  useEffect(() => {
    if (messages.length > lastMessageCountRef.current) {
      lastMessageCountRef.current = messages.length;
      if (shouldStickToBottomRef.current) {
        requestAnimationFrame(() => {
          scrollToBottom(true);
        });
      }
    }
  }, [messages.length, scrollToBottom]);

  return {
    bottomRef,
    scrollToBottom,
    handleScroll,
    showScrollBottom,
  };
}
