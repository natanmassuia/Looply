import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import InboxPage from "../features/inbox/InboxPage";
import { formatMessageText } from "../features/inbox/utils/formatMessageText";
import MessageBubble from "../features/inbox/components/MessageBubble";
import AIStatusFooter from "../features/inbox/components/AIStatusFooter";
import ChatHeader from "../features/inbox/components/ChatHeader";
import ConversationSearchBar from "../features/inbox/components/ConversationSearchBar";
import * as apiModule from "../lib/api";
import type {
  ConversationSummaryDto,
  ConversationMessageDto,
  ListConversationsResponse,
  ListMessagesResponse,
  Client,
} from "../lib/types";

const mockConversations: ConversationSummaryDto[] = [
  {
    id: "conv-1",
    companyId: "comp-1",
    provider: "whatsapp",
    remotePhone: "+5511999991111",
    contactName: "Mariana Costa",
    contactAvatarUrl: null,
    client: { id: "cli-1", name: "Estética Viva" },
    lastMessagePreview: "Gostaria de agendar para amanhã às 14h",
    lastMessageAt: "2026-08-23T15:30:00.000Z",
    unreadCount: 2,
    aiStatus: "ACTIVE",
    createdAt: "2026-08-20T10:00:00.000Z",
    updatedAt: "2026-08-23T15:30:00.000Z",
  },
  {
    id: "conv-2",
    companyId: "comp-1",
    provider: "whatsapp",
    remotePhone: "+5511988882222",
    contactName: "Lucas Mendes",
    contactAvatarUrl: null,
    client: null,
    lastMessagePreview: "Obrigado pelas informações!",
    lastMessageAt: "2026-08-23T14:00:00.000Z",
    unreadCount: 0,
    aiStatus: "PAUSED",
    createdAt: "2026-08-21T09:00:00.000Z",
    updatedAt: "2026-08-23T14:00:00.000Z",
  },
  {
    id: "conv-3",
    companyId: "comp-1",
    provider: "whatsapp",
    remotePhone: "+5511977773333",
    contactName: "Carla Silveira",
    contactAvatarUrl: null,
    client: { id: "cli-2", name: "Odonto Clean" },
    lastMessagePreview: "Tive um problema com o pagamento",
    lastMessageAt: "2026-08-23T16:00:00.000Z",
    unreadCount: 1,
    aiStatus: "NEEDS_ATTENTION",
    createdAt: "2026-08-22T11:00:00.000Z",
    updatedAt: "2026-08-23T16:00:00.000Z",
  },
];

const mockMessages: ConversationMessageDto[] = [
  {
    id: "msg-1",
    conversationId: "conv-1",
    companyId: "comp-1",
    provider: "whatsapp",
    direction: "INBOUND",
    senderType: "CONTACT",
    type: "TEXT",
    body: "Olá, gostaria de agendar uma consulta para *amanhã* às _14h_.",
    media: null,
    transcription: null,
    deliveryStatus: "DELIVERED",
    action: null,
    createdAt: "2026-08-23T15:28:00.000Z",
  },
  {
    id: "msg-2",
    conversationId: "conv-1",
    companyId: "comp-1",
    provider: "whatsapp",
    direction: "OUTBOUND",
    senderType: "AI",
    type: "TEXT",
    body: "Olá Mariana! Temos o horário das 14h disponível com a Dra. Ana.",
    media: null,
    transcription: null,
    deliveryStatus: "READ",
    action: {
      type: "APPOINTMENT_CREATED",
      metadata: {
        title: "Consulta Dra. Ana",
        startsAt: "2026-08-24T14:00:00.000Z",
      },
    },
    createdAt: "2026-08-23T15:29:00.000Z",
  },
  {
    id: "msg-3",
    conversationId: "conv-1",
    companyId: "comp-1",
    provider: "whatsapp",
    direction: "INBOUND",
    senderType: "CONTACT",
    type: "AUDIO",
    body: "https://example.com/audio.ogg",
    media: {
      filename: "audio-consulta.ogg",
      mimeType: "audio/ogg",
      sizeBytes: 45000,
    },
    transcription: "Perfeito, confirmo esse horário das 14 horas!",
    deliveryStatus: "DELIVERED",
    action: null,
    createdAt: "2026-08-23T15:30:00.000Z",
  },
];

const mockClients: Client[] = [
  {
    id: "cli-1",
    name: "Estética Viva",
    status: "ACTIVE",
    channels: ["INSTAGRAM", "WHATSAPP"],
    createdAt: "2026-08-01T00:00:00.000Z",
  },
  {
    id: "cli-2",
    name: "Odonto Clean",
    status: "ACTIVE",
    channels: ["WHATSAPP"],
    createdAt: "2026-08-01T00:00:00.000Z",
  },
];

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

function renderInbox(initialPath = "/inbox") {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/inbox" element={<InboxPage />} />
          <Route path="/inbox/:id" element={<InboxPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AI Inbox Feature (F15.3)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    window.HTMLMediaElement.prototype.pause = vi.fn();

    vi.spyOn(apiModule, "useConversations").mockImplementation(() => ({
      data: { items: mockConversations, nextCursor: null } as ListConversationsResponse,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any));

    vi.spyOn(apiModule, "useConversationMessages").mockImplementation((id) => ({
      data: id ? { items: mockMessages, nextCursor: null } as ListMessagesResponse : undefined,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any));

    vi.spyOn(apiModule, "useClients").mockImplementation(() => ({
      data: mockClients,
      isLoading: false,
      isError: false,
      error: null,
    } as any));
  });

  describe("WhatsApp text formatter (formatMessageText)", () => {
    it("formats bold, italic, strikethrough, and code correctly", () => {
      const { container } = render(
        <div>{formatMessageText("*negrito* _itálico_ ~riscado~ `código`")}</div>,
      );
      expect(container.querySelector("strong")?.textContent).toBe("negrito");
      expect(container.querySelector("em")?.textContent).toBe("itálico");
      expect(container.querySelector("del")?.textContent).toBe("riscado");
      expect(container.querySelector("code")?.textContent).toBe("código");
    });

    it("formats links as clickable anchors", () => {
      const { container } = render(
        <div>{formatMessageText("Acesse https://looply.app para mais")}</div>,
      );
      const link = container.querySelector("a");
      expect(link?.getAttribute("href")).toBe("https://looply.app");
      expect(link?.getAttribute("target")).toBe("_blank");
    });

    it("formats phone mentions and highlights search query matches", () => {
      const { container } = render(
        <div>
          {formatMessageText("Falar com @5511999991111 sobre agendamento", {
            searchQuery: "agendamento",
            isSearchActive: true,
          })}
        </div>,
      );
      expect(container.textContent).toContain("+55 11 99999-1111");
      const mark = container.querySelector("mark");
      expect(mark?.textContent).toBe("agendamento");
    });
  });

  describe("MessageBubble rendering & Senders", () => {
    it("renders inbound message on left without AI badge", () => {
      render(<MessageBubble msg={mockMessages[0]} />);
      expect(screen.getByText("amanhã")).toBeTruthy();
      expect(screen.queryByText("Looply AI")).toBeNull();
    });

    it("renders outbound message with 'Looply AI' badge and structured action card", () => {
      render(<MessageBubble msg={mockMessages[1]} />);
      expect(screen.getByText("Looply AI")).toBeTruthy();
      expect(screen.getByText("Compromisso Agendado pela IA")).toBeTruthy();
      expect(screen.getByText("Consulta Dra. Ana")).toBeTruthy();
    });

    it("renders audio message with AudioPlayer and AI transcription", () => {
      render(<MessageBubble msg={mockMessages[2]} />);
      expect(screen.getByRole("button", { name: "Reproduzir áudio" })).toBeTruthy();
      expect(screen.getByText("Transcrição por IA")).toBeTruthy();
      expect(
        screen.getByText('"Perfeito, confirmo esse horário das 14 horas!"'),
      ).toBeTruthy();
    });
  });

  describe("ConversationList & Filtering", () => {
    it("renders conversation items with names, previews, client badges, and unread counts", () => {
      renderInbox();
      expect(screen.getByText("Mariana Costa")).toBeTruthy();
      expect(screen.getByText("Lucas Mendes")).toBeTruthy();
      expect(screen.getByText("Carla Silveira")).toBeTruthy();
      expect(screen.getByText("Estética Viva")).toBeTruthy();
      expect(screen.getByText("Odonto Clean")).toBeTruthy();
      // Total unread count header
      expect(screen.getAllByText("3")[0]).toBeTruthy();
    });

    it("filters conversations by status pills (Todas / Ativas / Atenção / Pausadas)", async () => {
      const user = userEvent.setup();
      renderInbox();

      const activeFilterBtn = screen.getByRole("button", { name: /Ativas/i });
      await user.click(activeFilterBtn);
      expect(activeFilterBtn.className).toContain("bg-emerald-600");
    });

    it("filters conversations by search input", async () => {
      const user = userEvent.setup();
      renderInbox();

      const searchInput = screen.getByLabelText("Buscar conversas");
      await user.type(searchInput, "Mariana");
      expect(searchInput).toHaveValue("Mariana");
    });
  });

  describe("AIStatusFooter — Autonomous AI State (No Human Composer)", () => {
    it("never renders manual message input, textarea, or human send button", () => {
      renderWithClient(<AIStatusFooter conversation={mockConversations[0]} />);
      expect(screen.queryByRole("textbox")).toBeNull();
      expect(screen.queryByPlaceholderText(/digite/i)).toBeNull();
      expect(screen.queryByRole("button", { name: /enviar/i })).toBeNull();
    });

    it("displays Active AI state and allows pausing or flagging attention", async () => {
      const mockSetStatus = vi.fn();
      vi.spyOn(apiModule, "useSetConversationAiStatus").mockReturnValue({
        mutate: mockSetStatus,
        isPending: false,
      } as any);

      renderWithClient(<AIStatusFooter conversation={mockConversations[0]} />);
      expect(screen.getByText("Assistente de IA em Operação")).toBeTruthy();

      const pauseBtn = screen.getByRole("button", { name: "Pausar IA" });
      fireEvent.click(pauseBtn);
      expect(mockSetStatus).toHaveBeenCalledWith({
        id: "conv-1",
        aiStatus: "PAUSED",
      });
    });

    it("displays Paused AI state and allows resuming", async () => {
      const mockSetStatus = vi.fn();
      vi.spyOn(apiModule, "useSetConversationAiStatus").mockReturnValue({
        mutate: mockSetStatus,
        isPending: false,
      } as any);

      renderWithClient(<AIStatusFooter conversation={mockConversations[1]} />);
      expect(screen.getByText("Assistente de IA Pausado")).toBeTruthy();

      const resumeBtn = screen.getByRole("button", { name: "Devolver à IA" });
      fireEvent.click(resumeBtn);
      expect(mockSetStatus).toHaveBeenCalledWith({
        id: "conv-2",
        aiStatus: "ACTIVE",
      });
    });

    it("displays Needs Attention state and allows resolving", async () => {
      const mockSetStatus = vi.fn();
      vi.spyOn(apiModule, "useSetConversationAiStatus").mockReturnValue({
        mutate: mockSetStatus,
        isPending: false,
      } as any);

      renderWithClient(<AIStatusFooter conversation={mockConversations[2]} />);
      expect(screen.getByText("Conversa com Atenção Necessária")).toBeTruthy();

      const resolveBtn = screen.getByRole("button", { name: "Resolver e Retomar IA" });
      fireEvent.click(resolveBtn);
      expect(mockSetStatus).toHaveBeenCalledWith({
        id: "conv-3",
        aiStatus: "ACTIVE",
      });
    });
  });

  describe("ChatHeader & Client Binding", () => {
    it("renders contact info and bound client badge", () => {
      renderWithClient(
        <ChatHeader
          conversation={mockConversations[0]}
          isSearchOpen={false}
          onToggleSearch={vi.fn()}
        />,
      );
      expect(screen.getByText("Mariana Costa")).toBeTruthy();
      expect(screen.getByText("+55 (11) 99999-1111")).toBeTruthy();
      expect(screen.getByText("IA Ativa")).toBeTruthy();
    });

    it("allows binding and unbinding client via dropdown", async () => {
      const mockBind = vi.fn();
      vi.spyOn(apiModule, "useBindConversationClient").mockReturnValue({
        mutate: mockBind,
        isPending: false,
      } as any);

      const user = userEvent.setup();
      renderWithClient(
        <ChatHeader
          conversation={mockConversations[1]}
          isSearchOpen={false}
          onToggleSearch={vi.fn()}
        />,
      );

      const bindBtn = screen.getByRole("button", { name: "Vincular cliente" });
      await user.click(bindBtn);

      const clientOption = screen.getByRole("button", { name: "Estética Viva" });
      await user.click(clientOption);

      expect(mockBind).toHaveBeenCalledWith({
        id: "conv-2",
        clientId: "cli-1",
      });
    });
  });

  describe("ConversationSearchBar in chat", () => {
    it("searches and triggers previous/next match navigation", () => {
      const onNext = vi.fn();
      const onPrev = vi.fn();
      const onClose = vi.fn();
      const setQuery = vi.fn();

      render(
        <ConversationSearchBar
          query="consulta"
          setQuery={setQuery}
          matchesCount={2}
          activeIndex={0}
          onNext={onNext}
          onPrevious={onPrev}
          onClose={onClose}
        />,
      );

      expect(screen.getByText("1 / 2")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Próximo resultado" }));
      expect(onNext).toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: "Resultado anterior" }));
      expect(onPrev).toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: "Fechar busca" }));
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe("Master-Detail responsiveness & selection", () => {
    it("shows empty state when no conversation is selected on desktop", () => {
      renderInbox("/inbox");
      expect(screen.getByText("Nenhuma conversa selecionada")).toBeTruthy();
    });

    it("marks conversation as read and shows detail when conversation is selected", () => {
      const markReadMock = vi.fn();
      vi.spyOn(apiModule, "useMarkConversationRead").mockReturnValue({
        mutate: markReadMock,
        isPending: false,
      } as any);

      renderInbox("/inbox?id=conv-1");
      expect(screen.getAllByText("Mariana Costa").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Assistente de IA em Operação")).toBeTruthy();
    });

    it("handles mobile view navigation (shows back button and returns to list)", async () => {
      // Simulate mobile window width
      Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 500 });
      window.dispatchEvent(new Event("resize"));

      renderInbox("/inbox?id=conv-1");

      const backBtn = screen.getByRole("button", { name: "Voltar para lista de conversas" });
      expect(backBtn).toBeTruthy();

      fireEvent.click(backBtn);
      // Reset window width
      Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 1024 });
      window.dispatchEvent(new Event("resize"));
    });
  });

  describe("ContextPanel (Desktop Details & AI Context)", () => {
    it("toggles and renders ContextPanel with client link, AI status, and recent actions", async () => {
      const user = userEvent.setup();
      renderInbox("/inbox?id=conv-1");

      const infoBtn = screen.getByRole("button", { name: "Ver detalhes do contato" });
      await user.click(infoBtn);

      expect(screen.getByTestId("inbox-context-panel")).toBeTruthy();
      expect(screen.getByText("Detalhes do Contato")).toBeTruthy();
      expect(screen.getByText("Cliente Vinculado")).toBeTruthy();
      expect(screen.getByText("Ações Recentes da IA")).toBeTruthy();
      expect(screen.getByText("📅 Agendamento")).toBeTruthy();
    });
  });
});
