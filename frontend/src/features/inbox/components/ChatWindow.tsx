import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import type { ConversationSummaryDto } from "../../../lib/types";
import {
  useConversationMessages,
  useSendConversationMessage,
  useWhatsAppTemplates,
  useSendWhatsAppTemplate,
  type WhatsAppMessageTemplate,
} from "../../../lib/api";
import ChatHeader from "./ChatHeader";
import MessageList, { type MessageListHandle } from "./MessageList";
import AIStatusFooter from "./AIStatusFooter";
import ConversationSearchBar from "./ConversationSearchBar";
import ContextPanel from "./ContextPanel";
import ModalOrSheet from "../../../components/ModalOrSheet";
import { IconAlertCircle, IconWhatsApp } from "../../../components/Icons";
import { formatPhone } from "../../../lib/format";

interface Props {
  conversation: ConversationSummaryDto | null;
  isMobile?: boolean;
  onBack?: () => void;
}

function QuickTemplateModal({
  isOpen,
  onClose,
  remotePhone,
}: {
  isOpen: boolean;
  onClose: () => void;
  remotePhone: string;
}) {
  const { data, isLoading } = useWhatsAppTemplates();
  const sendMutation = useSendWhatsAppTemplate();
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppMessageTemplate | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const templates = data?.templates ?? [];
  const approved = templates.filter((t) => t.status === "APPROVED");

  const handleSend = () => {
    if (!selectedTemplate) return;
    setSendError(null);
    sendMutation.mutate(
      {
        to: remotePhone,
        templateName: selectedTemplate.name,
        languageCode: selectedTemplate.language,
      },
      {
        onSuccess: () => {
          onClose();
        },
        onError: (err: any) => {
          setSendError(err?.message || "Falha ao enviar modelo de mensagem.");
        },
      },
    );
  };

  return (
    <ModalOrSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Enviar Modelo de WhatsApp"
      subtitle={`Destinatário: ${formatPhone(remotePhone)}`}
      maxWidth="max-w-xl"
    >
      <div className="space-y-4 p-5">
        <div className="flex items-start gap-2.5 rounded-[10px] border border-[var(--looply-color-border-default)] bg-[var(--looply-color-coral-100)] p-3 text-xs text-[var(--looply-color-text-primary)]">
          <IconAlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--looply-color-action-primary)]" />
          <p className="leading-relaxed">
            <strong>Reabertura tarifada:</strong> Fora da janela de 24 horas, o envio de um modelo de mensagem iniciará uma nova conversa tarifada de acordo com as taxas da Meta (WhatsApp Business).
          </p>
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-xs text-[var(--looply-color-text-muted)]">
            Carregando modelos aprovados...
          </div>
        ) : approved.length === 0 ? (
          <div className="py-8 text-center text-xs text-[var(--looply-color-text-muted)]">
            Nenhum modelo aprovado encontrado na sua conta do WhatsApp Business. Cadastre modelos no menu WhatsApp para iniciar conversas.
          </div>
        ) : (
          <div className="max-h-[300px] space-y-2 overflow-y-auto pr-1">
            {approved.map((tpl) => {
              const isSelected = selectedTemplate?.name === tpl.name && selectedTemplate?.language === tpl.language;
              const bodyComponent = tpl.components?.find((c: any) => c.type === "BODY") as { text?: string } | undefined;
              return (
                <div
                  key={`${tpl.name}-${tpl.language}`}
                  onClick={() => setSelectedTemplate(tpl)}
                  className={`cursor-pointer rounded-[10px] border p-3.5 transition-all ${
                    isSelected
                      ? "border-[var(--looply-color-action-primary)] bg-[var(--looply-color-coral-100)]/40 ring-2 ring-[var(--looply-color-action-primary)]"
                      : "border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] hover:bg-[var(--looply-color-bg-subtle)]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs text-[var(--looply-color-text-primary)]">
                      {tpl.name}
                    </span>
                    <span className="rounded-full bg-[var(--looply-color-bg-subtle)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--looply-color-text-muted)]">
                      {tpl.category || tpl.language}
                    </span>
                  </div>
                  {bodyComponent?.text && (
                    <p className="mt-1.5 text-xs text-[var(--looply-color-text-secondary)] line-clamp-2">
                      {bodyComponent.text}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {sendError && (
          <p className="text-xs text-[var(--looply-color-status-danger)]">
            {sendError}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-[var(--looply-color-border-default)] pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[8px] px-3.5 py-2 text-xs font-semibold text-[var(--looply-color-text-secondary)] hover:bg-[var(--looply-color-bg-subtle)]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={!selectedTemplate || sendMutation.isPending}
            className="rounded-[8px] bg-[var(--looply-color-action-primary)] px-4 py-2 text-xs font-semibold text-[var(--looply-color-text-on-brand)] transition-colors hover:bg-[var(--looply-color-action-primary-hover)] disabled:opacity-40"
          >
            {sendMutation.isPending ? "Enviando..." : "Enviar Modelo"}
          </button>
        </div>
      </div>
    </ModalOrSheet>
  );
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
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

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

  // Detect 24h customer service window expiration
  const lastInboundMessage = useMemo(() => {
    return [...messages].reverse().find((m) => m.direction === "INBOUND");
  }, [messages]);

  const is24hWindowClosed = useMemo(() => {
    if (isLoading || !conversation) return false;
    if (!lastInboundMessage) {
      return messages.length > 0;
    }
    const lastTime = new Date(lastInboundMessage.createdAt).getTime();
    if (isNaN(lastTime)) return false;
    return Date.now() - lastTime > 24 * 60 * 60 * 1000;
  }, [conversation, isLoading, messages.length, lastInboundMessage]);

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

        {/* 24-hour WhatsApp customer service window alert (desktop & mobile) */}
        {is24hWindowClosed && (
          <div
            role="alert"
            className="shrink-0 border-t border-[var(--looply-color-border-default)] bg-[var(--looply-color-coral-100)]/60 px-4 py-2.5 text-xs text-[var(--looply-color-text-primary)]"
          >
            <div className="flex items-start gap-2.5">
              <IconAlertCircle
                className="mt-0.5 h-4 w-4 shrink-0 text-[var(--looply-color-action-primary)]"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-[var(--looply-color-text-primary)]">
                    Janela de 24 horas encerrada
                  </span>
                  <span className="rounded-full border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] px-2 py-0.5 text-[10px] font-bold text-[var(--looply-color-text-brand)]">
                    Tarifada
                  </span>
                </div>
                <p className="mt-0.5 leading-relaxed text-[var(--looply-color-text-secondary)]">
                  A última mensagem do cliente foi há mais de 24 horas. Mensagens de texto livre não serão entregues pelo WhatsApp (Meta). Para reiniciar o contato, envie um <strong>Modelo (Template)</strong>. O envio iniciará uma nova janela tarifada pela Meta.
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsTemplateModalOpen(true)}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] bg-[var(--looply-color-action-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--looply-color-text-on-brand)] transition-colors hover:bg-[var(--looply-color-action-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--looply-color-focus)]"
                  >
                    <IconWhatsApp className="h-3.5 w-3.5" aria-hidden="true" />
                    Enviar Modelo de WhatsApp
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

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
              placeholder={is24hWindowClosed ? "Janela de 24h encerrada (use o Modelo acima)..." : "Responder como humano..."}
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
        <AIStatusFooter conversation={conversation} messages={messages} />
      </div>

      {/* Right Desktop Context Panel (Figma 16 — 490:7 Contact Context) */}
      {isInfoOpen && (
        <ContextPanel
          conversation={conversation}
          messages={messages}
          onClose={() => setInfoOverride(false)}
        />
      )}

      {isTemplateModalOpen && (
        <QuickTemplateModal
          isOpen={isTemplateModalOpen}
          onClose={() => setIsTemplateModalOpen(false)}
          remotePhone={conversation.remotePhone}
        />
      )}
    </div>
  );
}
