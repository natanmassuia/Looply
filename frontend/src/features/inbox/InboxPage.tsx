import { useState, useEffect, useRef, useMemo } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { ConversationAiStatus } from "../../lib/types";
import { useConversation, useConversations, useMarkConversationRead } from "../../lib/api";
import ConversationList from "./components/ConversationList";
import ChatWindow from "./components/ChatWindow";

export default function InboxPage() {
  const navigate = useNavigate();
  const params = useParams<{ id?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  // Selected conversation ID from search query param (priority) or route param
  const routeId = params.id;
  const queryId = searchParams.get("id") || searchParams.get("conversationId");
  const activeConversationId = queryId || routeId || null;

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

  const { data: activeConversationDetail } = useConversation(activeConversationId);

  const conversations = useMemo(
    () => conversationsData?.items ?? [],
    [conversationsData],
  );

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) ?? activeConversationDetail ?? null,
    [conversations, activeConversationId, activeConversationDetail],
  );

  // Mark conversation read mutation
  const markReadMutation = useMarkConversationRead();

  const handleSelectConversation = (id: string) => {
    if (routeId) {
      navigate(`/conversations?id=${encodeURIComponent(id)}`, { replace: true });
    } else {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("id", id);
        return next;
      });
    }

    const target = conversations.find((c) => c.id === id);
    if (target && target.unreadCount > 0) {
      markReadMutation.mutate(id);
    }
  };

  const handleBackToConversations = () => {
    if (routeId) {
      navigate("/conversations", { replace: true });
      return;
    }
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("id");
      next.delete("conversationId");
      return next;
    });
  };

  // Mobile / Landscape phone detection (portrait <768px or landscape height <=500px on <1024px)
  const checkIsMobile = () => {
    if (typeof window === "undefined") return false;
    if (window.innerWidth < 768) return true;
    if (window.innerHeight <= 500 && window.innerWidth < 1024) return true;
    if (typeof window.matchMedia === "function") {
      return window.matchMedia("(max-width: 767px), ((max-height: 500px) and (max-width: 1024px))").matches;
    }
    return false;
  };

  const [isMobile, setIsMobile] = useState(checkIsMobile);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = typeof window.matchMedia === "function"
      ? window.matchMedia("(max-width: 767px), ((max-height: 500px) and (max-width: 1024px))")
      : null;
    const handleChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches || checkIsMobile());
    };
    const handleResize = () => {
      setIsMobile(checkIsMobile());
    };
    handleResize();
    mql?.addEventListener("change", handleChange);
    window.addEventListener("resize", handleResize);
    return () => {
      mql?.removeEventListener("change", handleChange);
      window.removeEventListener("resize", handleResize);
    };
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
      className="flex flex-col w-full h-[calc(100dvh-theme(spacing.28))] md:h-[calc(100dvh-theme(spacing.12))] max-h-full overflow-hidden font-sans relative"
    >
      {/* Figma 16 — Inbox / Heading (Desktop) */}
      <div className="mb-4 hidden shrink-0 items-center justify-between gap-4 md:flex">
        <div className="min-w-0">
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-[var(--looply-color-text-primary)]">
            Conversas
          </h1>
          <p className="mt-0.5 text-[14px] text-[var(--looply-color-text-secondary)]">
            Acompanhe o que a IA recebeu, entendeu e transformou em ação.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-[10px] bg-[var(--looply-color-bg-subtle)] px-3.5 py-2.5 text-[13px] font-semibold text-[var(--looply-color-text-primary)]">
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full bg-[var(--looply-color-action-primary)]"
            />
            <span>WhatsApp · conectado</span>
          </div>
          <Link
            to="/whatsapp"
            className="btn-primary rounded-[10px] px-4 py-2.5 text-[13px] font-semibold"
          >
            Configurar canal
          </Link>
        </div>
      </div>

      {/* Figma 16 — Inbox / Multi-Panel Cards over Canvas */}
      <div className="flex min-h-0 flex-1 w-full overflow-hidden gap-0 md:gap-2">
        {/* Pillar 1: Conversation List Card (Master) */}
        {(!isMobile || !activeConversationId) && (
          <div
            ref={listRef}
            style={{ width: isMobile ? "100%" : `${listWidth}px` }}
            className="shrink-0 flex flex-col min-h-0 h-full overflow-hidden rounded-[10px] border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)]"
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
            className="hidden md:flex w-1.5 h-full cursor-col-resize items-center justify-center rounded-full bg-transparent hover:bg-[var(--looply-color-action-primary)]/30 active:bg-[var(--looply-color-action-primary)] transition-all shrink-0 z-30 relative select-none"
          />
        )}

        {/* Pillar 2 & 3: Chat Window + Context Panel Cards */}
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
    </div>
  );
}
