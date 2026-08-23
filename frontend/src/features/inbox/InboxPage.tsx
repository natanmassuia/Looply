import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import type { ConversationAiStatus } from "../../lib/types";
import { useConversations, useMarkConversationRead } from "../../lib/api";
import ConversationList from "./components/ConversationList";
import ChatWindow from "./components/ChatWindow";

export default function InboxPage() {
  const params = useParams<{ id?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  // Selected conversation ID from route param or search query param
  const routeId = params.id;
  const queryId = searchParams.get("id") || searchParams.get("conversationId");
  const activeConversationId = routeId || queryId || null;

  // Filter state
  const [aiStatusFilter, setAiStatusFilter] = useState<ConversationAiStatus | "ALL">("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  // Debounced search for API
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch conversations
  const { data: conversationsData, isLoading } = useConversations({
    search: debouncedSearch || undefined,
    aiStatus: aiStatusFilter === "ALL" ? undefined : aiStatusFilter,
  });

  const conversations = useMemo(
    () => conversationsData?.items ?? [],
    [conversationsData],
  );

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) || null,
    [conversations, activeConversationId],
  );

  // Mark conversation read mutation
  const markReadMutation = useMarkConversationRead();

  const handleSelectConversation = (id: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("id", id);
      return next;
    });

    const target = conversations.find((c) => c.id === id);
    if (target && target.unreadCount > 0) {
      markReadMutation.mutate(id);
    }
  };

  const handleBackToConversations = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("id");
      next.delete("conversationId");
      return next;
    });
  };

  // Mobile detection
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false,
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Resizable sidebar on desktop (clamped between 320px and 460px)
  const [listWidth, setListWidth] = useState(() => {
    try {
      const saved = localStorage.getItem("looply:inbox-width");
      return saved ? Math.min(Math.max(parseInt(saved, 10), 320), 460) : 380;
    } catch {
      return 380;
    }
  });

  const listRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current || !listRef.current) return;
      const rect = listRef.current.getBoundingClientRect();
      const newWidth = moveEvent.clientX - rect.left;
      const clamped = Math.min(Math.max(newWidth, 320), 460);
      setListWidth(clamped);
      try {
        localStorage.setItem("looply:inbox-width", String(clamped));
      } catch {
        // Ignore
      }
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleDoubleClick = () => {
    setListWidth(380);
    try {
      localStorage.setItem("looply:inbox-width", "380");
    } catch {
      // Ignore
    }
  };

  return (
    <div
      data-testid="inbox-page"
      className="flex w-full h-[calc(100vh-theme(spacing.16))] md:h-[calc(100vh-theme(spacing.6))] max-h-full overflow-hidden rounded-xl border border-[var(--looply-color-border-default,#e4e4e7)] bg-[var(--looply-color-bg-surface,#ffffff)] shadow-sm font-sans relative"
    >
      {/* Pillar 1: Conversation List (Master) */}
      {(!isMobile || !activeConversationId) && (
        <div
          ref={listRef}
          style={{ width: isMobile ? "100%" : `${listWidth}px` }}
          className="shrink-0 flex flex-col min-h-0 h-full"
        >
          <ConversationList
            conversations={conversations}
            selectedId={activeConversationId}
            onSelect={handleSelectConversation}
            isLoading={isLoading}
            selectedAiStatus={aiStatusFilter}
            onSelectAiStatus={setAiStatusFilter}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
          />
        </div>
      )}

      {/* Resize Handle (Desktop only) */}
      {!isMobile && (
        <div
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
          role="separator"
          aria-label="Redimensionar lista de conversas"
          className="hidden md:flex w-1 hover:w-1.5 active:w-1.5 h-full cursor-col-resize bg-[var(--looply-color-border-default,#e4e4e7)] hover:bg-[var(--looply-color-text-brand,#2563eb)] active:bg-[var(--looply-color-text-brand,#2563eb)] transition-all shrink-0 z-30 relative select-none"
        />
      )}

      {/* Pillar 2: Chat Window (Detail) */}
      {(!isMobile || Boolean(activeConversationId)) && (
        <div className="flex-1 min-w-0 min-h-0 h-full flex flex-col">
          <ChatWindow
            conversation={selectedConversation}
            isMobile={isMobile}
            onBack={handleBackToConversations}
          />
        </div>
      )}
    </div>
  );
}
