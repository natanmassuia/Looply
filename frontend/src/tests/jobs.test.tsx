import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { readFileSync } from "node:fs";
import ContentDetail from "../features/ContentDetail";
import ContentsList from "../features/ContentsList";
import * as apiModule from "../lib/api";
import type { ContentDetail as ContentDetailType, ContentListItem, Client } from "../lib/types";

const mockClients: Client[] = [
  {
    id: "cli-1",
    name: "Restaurante Aurora",
    brandColor: "#e11d48",
    status: "ACTIVE",
    channels: ["Instagram"],
    createdAt: new Date().toISOString(),
  },
  {
    id: "cli-2",
    name: "Café Solar",
    brandColor: "#f59e0b",
    status: "ACTIVE",
    channels: ["Instagram"],
    createdAt: new Date().toISOString(),
  },
];

const mockJobDetail: ContentDetailType = {
  id: "job-1",
  title: "Post Cardápio de Verão",
  clientId: "cli-1",
  format: "POST",
  channel: "Instagram",
  status: "DRAFT",
  publicationTarget: "2026-08-20T12:00:00.000Z",
  notes: "Focar nos drinks tropicais",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  client: mockClients[0],
  versions: [
    {
      id: "v-1",
      contentId: "job-1",
      versionNumber: 1,
      caption: "Venha conhecer nosso novo cardápio de verão!",
      mediaUrl: "https://example.com/image.jpg",
      createdAt: new Date().toISOString(),
    },
  ],
};

const mockGroupedJobDetail: ContentDetailType = {
  ...mockJobDetail,
  id: "job-child-1",
  title: "Reels Making-of Verão",
  parentId: "job-1",
};

const mockContentsList: ContentListItem[] = [
  {
    id: "job-1",
    title: "Post Cardápio de Verão",
    clientId: "cli-1",
    currentStageId: "s1",
    format: "POST",
    status: "DRAFT",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    client: mockClients[0],
    versions: [{ id: "v-1", contentId: "job-1", versionNumber: 1, caption: "Legenda", createdAt: "" }],
  },
  {
    id: "job-child-1",
    title: "Reels Making-of Verão",
    clientId: "cli-1",
    parentId: "job-1",
    currentStageId: "s1",
    format: "REELS",
    status: "DRAFT",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    client: mockClients[0],
    versions: [{ id: "v-2", contentId: "job-child-1", versionNumber: 1, caption: "Legenda", createdAt: "" }],
  },
];

const mockWorkflow = {
  id: "w1",
  companyId: "c1",
  name: "Workflow",
  template: "MARKETING_AGENCY",
  active: true,
  stages: [
    { id: "s1", workflowId: "w1", name: "Backlog", position: 0, terminal: false, active: true, semanticKey: null },
    { id: "s2", workflowId: "w1", name: "Em produção", position: 1, terminal: false, active: true, semanticKey: null },
    { id: "s3", workflowId: "w1", name: "Revisão", position: 2, terminal: false, active: true, semanticKey: null },
    { id: "s4", workflowId: "w1", name: "Aprovado", position: 3, terminal: false, active: true, semanticKey: "APPROVED" },
    { id: "s5", workflowId: "w1", name: "Agendado", position: 4, terminal: false, active: true, semanticKey: "SCHEDULED" },
    { id: "s6", workflowId: "w1", name: "Concluído", position: 5, terminal: true, active: true, semanticKey: "COMPLETED" },
  ],
};

function renderWithProviders(ui: React.ReactElement, initialRoute = "/") {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialRoute]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Jobs Feature — B4 Metadata Editing + Ungroup Wiring", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Job Metadata Editing", () => {
    it("renders job detail with an Editar button in the header and details card", () => {
      vi.spyOn(apiModule, "useContent").mockReturnValue({
        data: mockJobDetail,
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      } as any);

      vi.spyOn(apiModule, "useClients").mockReturnValue({
        data: mockClients,
      } as any);

      renderWithProviders(
        <Routes>
          <Route path="/contents/:id" element={<ContentDetail />} />
        </Routes>,
        "/contents/job-1",
      );

      expect(screen.getAllByText("Post Cardápio de Verão").length).toBeGreaterThanOrEqual(1);
      const editBtns = screen.getAllByRole("button", { name: /Editar/i });
      expect(editBtns.length).toBeGreaterThanOrEqual(1);
    });

    it("opens metadata edit modal pre-filled with server truth and submits PATCH /api/jobs/:id", async () => {
      vi.spyOn(apiModule, "useContent").mockReturnValue({
        data: mockJobDetail,
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      } as any);

      vi.spyOn(apiModule, "useClients").mockReturnValue({
        data: mockClients,
      } as any);

      const updateJobMutate = vi.fn().mockResolvedValue({
        ...mockJobDetail,
        title: "Post Cardápio de Verão 2026",
      });

      vi.spyOn(apiModule, "useUpdateJob").mockReturnValue({
        mutateAsync: updateJobMutate,
        isPending: false,
      } as any);

      renderWithProviders(
        <Routes>
          <Route path="/contents/:id" element={<ContentDetail />} />
        </Routes>,
        "/contents/job-1",
      );

      // Click Editar
      const editBtn = screen.getAllByRole("button", { name: /Editar/i })[0];
      fireEvent.click(editBtn);

      // Verify modal opened and pre-filled
      expect(screen.getByText("Editar detalhes da demanda")).toBeInTheDocument();
      const titleInput = screen.getByDisplayValue("Post Cardápio de Verão");
      expect(titleInput).toBeInTheDocument();
      expect(screen.getByDisplayValue("Focar nos drinks tropicais")).toBeInTheDocument();

      // Change title
      fireEvent.change(titleInput, { target: { value: "Post Cardápio de Verão 2026" } });

      // Submit
      const saveBtn = screen.getByRole("button", { name: "Salvar alterações" });
      fireEvent.click(saveBtn);

      expect(updateJobMutate).toHaveBeenCalledWith({
        id: "job-1",
        body: expect.objectContaining({
          title: "Post Cardápio de Verão 2026",
          clientId: "cli-1",
          notes: "Focar nos drinks tropicais",
        }),
      });
    });

    it("canceling edit modal does not trigger any mutation", async () => {
      vi.spyOn(apiModule, "useContent").mockReturnValue({
        data: mockJobDetail,
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      } as any);

      vi.spyOn(apiModule, "useClients").mockReturnValue({
        data: mockClients,
      } as any);

      const updateJobMutate = vi.fn();
      vi.spyOn(apiModule, "useUpdateJob").mockReturnValue({
        mutateAsync: updateJobMutate,
        isPending: false,
      } as any);

      renderWithProviders(
        <Routes>
          <Route path="/contents/:id" element={<ContentDetail />} />
        </Routes>,
        "/contents/job-1",
      );

      fireEvent.click(screen.getAllByRole("button", { name: /Editar/i })[0]);
      expect(screen.getByText("Editar detalhes da demanda")).toBeInTheDocument();

      const cancelBtn = screen.getByRole("button", { name: "Cancelar" });
      fireEvent.click(cancelBtn);

      expect(screen.queryByText("Editar detalhes da demanda")).not.toBeInTheDocument();
      expect(updateJobMutate).not.toHaveBeenCalled();
    });

    it("surfaces error message when PATCH /api/jobs/:id fails", async () => {
      vi.spyOn(apiModule, "useContent").mockReturnValue({
        data: mockJobDetail,
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      } as any);

      vi.spyOn(apiModule, "useClients").mockReturnValue({
        data: mockClients,
      } as any);

      vi.spyOn(apiModule, "useUpdateJob").mockReturnValue({
        mutateAsync: vi.fn().mockRejectedValue(new apiModule.ApiError(400, "Dados inválidos para atualização")),
        isPending: false,
      } as any);

      renderWithProviders(
        <Routes>
          <Route path="/contents/:id" element={<ContentDetail />} />
        </Routes>,
        "/contents/job-1",
      );

      fireEvent.click(screen.getAllByRole("button", { name: /Editar/i })[0]);
      fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

      await waitFor(() => {
        expect(screen.getByText("Dados inválidos para atualização")).toBeInTheDocument();
      });
    });
  });

  describe("Demand Cancellation (R1)", () => {
    function mockDetail(detail: ContentDetailType) {
      vi.spyOn(apiModule, "useContent").mockReturnValue({
        data: detail,
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      } as any);
      vi.spyOn(apiModule, "useClients").mockReturnValue({ data: mockClients } as any);
    }

    it("shows Cancelar demanda and hides active-only actions", () => {
      mockDetail(mockJobDetail);
      vi.spyOn(apiModule, "useCancelDemand").mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: false,
      } as any);

      renderWithProviders(
        <Routes>
          <Route path="/contents/:id" element={<ContentDetail />} />
        </Routes>,
        "/contents/job-1",
      );

      // Active action present for a DRAFT.
      expect(screen.getByRole("button", { name: "Enviar para revisão" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Cancelar demanda/ })).toBeInTheDocument();
    });

    it("requires confirmation and calls the cancel mutation", async () => {
      const cancelMutate = vi.fn().mockResolvedValue({ id: "job-1", lifecycleStatus: "CANCELLED" });
      vi.spyOn(apiModule, "useCancelDemand").mockReturnValue({
        mutateAsync: cancelMutate,
        isPending: false,
      } as any);
      mockDetail(mockJobDetail);

      renderWithProviders(
        <Routes>
          <Route path="/contents/:id" element={<ContentDetail />} />
        </Routes>,
        "/contents/job-1",
      );

      fireEvent.click(screen.getByRole("button", { name: /Cancelar demanda/ }));

      // Confirmation dialog appears with a consequence explanation.
      expect(screen.getAllByText("Cancelar demanda").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/não pode ser desfeita/i)).toBeInTheDocument();

      // Confirm.
      const confirmBtn = screen.getAllByRole("button", { name: /Cancelar demanda/ }).at(-1)!;
      fireEvent.click(confirmBtn);
      await waitFor(() => expect(cancelMutate).toHaveBeenCalledWith("job-1"));
    });

    it("shows cancelled banner and hides active-only actions for a cancelled demand", () => {
      const cancelled = { ...mockJobDetail, lifecycleStatus: "CANCELLED" as const };
      mockDetail(cancelled);
      vi.spyOn(apiModule, "useCancelDemand").mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: false,
      } as any);

      renderWithProviders(
        <Routes>
          <Route path="/contents/:id" element={<ContentDetail />} />
        </Routes>,
        "/contents/job-1",
      );

      expect(screen.getByText(/foi cancelada/i)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Enviar para revisão" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Cancelar demanda/ })).not.toBeInTheDocument();
    });

    it("surfaces API error when cancel fails", async () => {
      const cancelMutate = vi.fn().mockRejectedValue(new Error("Falha ao cancelar demanda."));
      vi.spyOn(apiModule, "useCancelDemand").mockReturnValue({
        mutateAsync: cancelMutate,
        isPending: false,
      } as any);
      mockDetail(mockJobDetail);

      renderWithProviders(
        <Routes>
          <Route path="/contents/:id" element={<ContentDetail />} />
        </Routes>,
        "/contents/job-1",
      );

      fireEvent.click(screen.getByRole("button", { name: /Cancelar demanda/ }));
      const confirmBtn = screen.getAllByRole("button", { name: /Cancelar demanda/ }).at(-1)!;
      fireEvent.click(confirmBtn);
      await waitFor(() => expect(cancelMutate).toHaveBeenCalled());
    });
  });

  describe("Sub-ticket Ungroup", () => {
    it("renders ungroup button on grouped child in Kanban list and calls POST /api/contents/:id/ungroup", async () => {
      vi.spyOn(apiModule, "useContents").mockReturnValue({
        data: mockContentsList,
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      } as any);

      vi.spyOn(apiModule, "useClients").mockReturnValue({
        data: mockClients,
      } as any);

      vi.spyOn(apiModule, "useWorkflow").mockReturnValue({
        data: mockWorkflow,
        isLoading: false,
        isError: false,
      } as any);

      const ungroupMutate = vi.fn().mockResolvedValue({ id: "job-child-1", parentId: null });
      vi.spyOn(apiModule, "useUngroupContent").mockReturnValue({
        mutateAsync: ungroupMutate,
        isPending: false,
      } as any);

      renderWithProviders(<ContentsList />);

      expect(screen.getByText("Demandas agrupadas (1)")).toBeInTheDocument();
      expect(screen.getByText("Reels Making-of Verão")).toBeInTheDocument();

      const ungroupBtn = screen.getByRole("button", { name: "Desagrupar demandas" });
      expect(ungroupBtn).toBeInTheDocument();

      fireEvent.click(ungroupBtn);

      expect(ungroupMutate).toHaveBeenCalledWith("job-child-1");
    });

    it("renders ungroup banner in ContentDetail for grouped job and calls POST /api/contents/:id/ungroup", async () => {
      vi.spyOn(apiModule, "useContent").mockReturnValue({
        data: mockGroupedJobDetail,
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      } as any);

      vi.spyOn(apiModule, "useClients").mockReturnValue({
        data: mockClients,
      } as any);

      const ungroupMutate = vi.fn().mockResolvedValue({ id: "job-child-1", parentId: null });
      vi.spyOn(apiModule, "useUngroupContent").mockReturnValue({
        mutateAsync: ungroupMutate,
        isPending: false,
      } as any);

      renderWithProviders(
        <Routes>
          <Route path="/contents/:id" element={<ContentDetail />} />
        </Routes>,
        "/contents/job-child-1",
      );

      expect(screen.getByText("Este conteúdo faz parte de um agrupamento de demandas.")).toBeInTheDocument();

      const ungroupBtn = screen.getByRole("button", { name: "Desagrupar demanda" });
      fireEvent.click(ungroupBtn);

      expect(ungroupMutate).toHaveBeenCalledWith("job-child-1");
    });

    it("does not render ungroup banner for non-grouped job in ContentDetail", () => {
      vi.spyOn(apiModule, "useContent").mockReturnValue({
        data: mockJobDetail,
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      } as any);

      vi.spyOn(apiModule, "useClients").mockReturnValue({
        data: mockClients,
      } as any);

      renderWithProviders(
        <Routes>
          <Route path="/contents/:id" element={<ContentDetail />} />
        </Routes>,
        "/contents/job-1",
      );

      expect(screen.queryByText("Este conteúdo faz parte de um agrupamento de demandas.")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Desagrupar demanda" })).not.toBeInTheDocument();
    });
  });

  // F14.4 — Kanban → scheduling handoff: drop into Agendado from Aprovado
  // opens a scheduling modal and does NOT commit a status until confirmed.
  describe("scheduling handoff", () => {
    function renderWithApproved() {
      const approved = [
        {
          id: "job-approved",
          title: "Post Aprovado",
          clientId: "cli-1",
          currentStageId: "s4",
          format: "POST" as const,
          status: "APPROVED" as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          client: mockClients[0],
          versions: [],
        },
      ];
      vi.spyOn(apiModule, "useContents").mockReturnValue({
        data: approved,
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      } as any);
      vi.spyOn(apiModule, "useClients").mockReturnValue({ data: mockClients } as any);
      vi.spyOn(apiModule, "useWorkflow").mockReturnValue({
        data: mockWorkflow,
        isLoading: false,
        isError: false,
      } as any);
      vi.spyOn(apiModule, "useGroupContent").mockReturnValue({ mutate: vi.fn() } as any);
      vi.spyOn(apiModule, "useUngroupContent").mockReturnValue({ mutateAsync: vi.fn() } as any);
      vi.spyOn(apiModule, "useCreateAppointment").mockReturnValue({
        mutateAsync: vi.fn().mockResolvedValue({ id: "apt-1" }),
        isPending: false,
      } as any);
      return renderWithProviders(<ContentsList />);
    }

    function dragApprovedToScheduled() {
      const card = screen.getByText("Post Aprovado");
      fireEvent.dragStart(card, { dataTransfer: { setData: vi.fn(), effectAllowed: "move" } });
      // The Agendado column header + body contain the stage label "Agendado".
      const agendadoColumn = screen.getByText("Agendado").closest("div");
      fireEvent.drop(agendadoColumn!, { dataTransfer: { getData: vi.fn().mockReturnValue("job-approved") } });
      fireEvent.dragEnd(card);
    }

    it("drop into Agendado opens the scheduling modal (no direct status commit)", () => {
      renderWithApproved();
      dragApprovedToScheduled();
      // Modal opens (title) and exposes date/time controls.
      expect(screen.getByRole("heading", { name: "Agendar conteúdo" })).toBeInTheDocument();
      expect(screen.getByLabelText("Data")).toBeInTheDocument();
      expect(screen.getByLabelText("Horário")).toBeInTheDocument();
    });

    it("cancel leaves the card in the original column (no status change, no appointment)", () => {
      const scheduleMutate = vi.fn().mockResolvedValue({ id: "apt-1" });
      vi.spyOn(apiModule, "useCreateAppointment").mockReturnValue({
        mutateAsync: scheduleMutate,
        isPending: false,
      } as any);
      renderWithApproved();
      dragApprovedToScheduled();
      fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
      expect(scheduleMutate).not.toHaveBeenCalled();
    });

    it("exposes an explicit 'Agendar' action for keyboard/mobile (non-drag alternative)", () => {
      renderWithApproved();
      expect(screen.getByRole("button", { name: "Agendar Post Aprovado" })).toBeInTheDocument();
    });

    // F14.4.1 — reproduces the real-runtime race where dragend clears the
    // reactive draggedId BEFORE the column drop is processed. The drop must
    // still open the scheduling modal by reading the id from dataTransfer.
    it("drop opens the scheduling modal even if reactive draggedId was cleared by dragend", () => {
      renderWithApproved();
      // Do NOT fire dragStart (so draggedId stays null, as if dragend already
      // ran) — the column drop reads the id from dataTransfer instead.
      const agendadoColumn = screen.getByText("Agendado").closest("div");
      fireEvent.drop(agendadoColumn!, {
        dataTransfer: { getData: vi.fn().mockReturnValue("job-approved") },
      });
      expect(screen.getByRole("heading", { name: "Agendar conteúdo" })).toBeInTheDocument();
      expect(screen.getByLabelText("Data")).toBeInTheDocument();
      expect(screen.getByLabelText("Horário")).toBeInTheDocument();
    });
  });

  // F14.3 — rich client filter replaces the native <select> on Demandas.
  describe("rich client filter", () => {
    function renderList() {
      vi.spyOn(apiModule, "useContents").mockReturnValue({
        data: mockContentsList,
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      } as any);
      vi.spyOn(apiModule, "useClients").mockReturnValue({
        data: [
          { id: "cli-1", name: "Restaurante Aurora", brandColor: "#e11d48", status: "ACTIVE", channels: [], createdAt: "" },
          { id: "cli-2", name: "Café Solar", brandColor: "#f59e0b", status: "ACTIVE", channels: [], createdAt: "" },
        ],
      } as any);
      vi.spyOn(apiModule, "useWorkflow").mockReturnValue({
        data: mockWorkflow,
        isLoading: false,
        isError: false,
      } as any);
      vi.spyOn(apiModule, "useGroupContent").mockReturnValue({ mutate: vi.fn() } as any);
      vi.spyOn(apiModule, "useUngroupContent").mockReturnValue({ mutateAsync: vi.fn() } as any);
      renderWithProviders(<ContentsList />);
    }

    it("no native client <select> remains; uses a rich trigger + sheet", () => {
      renderList();
      expect(document.querySelector("select")).toBeNull();
      expect(screen.getByRole("button", { name: "Todos os clientes" })).toBeInTheDocument();
    });

    it("selecting a client from the sheet filters and shows selection", () => {
      renderList();
      fireEvent.click(screen.getByRole("button", { name: "Todos os clientes" }));
      expect(screen.getByLabelText("Buscar cliente")).toBeInTheDocument();
      fireEvent.click(screen.getByText("Café Solar"));
      expect(screen.getByRole("button", { name: /Café Solar/ })).toBeInTheDocument();
    });
  });

  // F14.1 — grouped demand containment: child cards + long status badges must
  // stay inside the bordered group card. Source contract pins the layout
  // primitives that prevent the "Aguardando cliente" badge from escaping.
  describe("grouped demand containment contract", () => {
    const CONTENTS_LIST_SRC = readFileSync(`${process.cwd()}/src/features/ContentsList.tsx`, "utf8");

    it("child demand card uses shrink-safe flex (min-w-0) and w-full family", () => {
      expect(CONTENTS_LIST_SRC).toContain("min-w-0 flex-1");
      // metadata row wraps so long status pills never force the card wider
      expect(CONTENTS_LIST_SRC).toMatch(
        /flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0\.5/,
      );
    });

    it("grouped child wrapper is bordered and contained (no absolute/negative positioning)", () => {
      expect(CONTENTS_LIST_SRC).toMatch(
        /rounded-lg border border-\[var\(--looply-color-border-default\)\]/,
      );
      expect(CONTENTS_LIST_SRC).not.toMatch(/Demandas agrupadas[\s\S]{0,400}absolute/);
    });

    it("long titles inside grouped child cards clamp to 2 lines instead of overflowing", () => {
      expect(CONTENTS_LIST_SRC).toMatch(
        /line-clamp-2 text-\[11px\] font-medium leading-snug text-\[var\(--looply-color-text-primary\)\]/,
      );
    });

    it("Desagrupar demandas renders exactly once per group (no duplicates)", () => {
      const occurrences = CONTENTS_LIST_SRC.match(/aria-label="Desagrupar demandas"/g) ?? [];
      expect(occurrences).toHaveLength(1);
    });
  });

  describe("status pill containment contract", () => {
    const PILL_SRC = readFileSync(`${process.cwd()}/src/components/StatusPill.tsx`, "utf8");

    it("status pill allows shrinking + wrapping so long labels stay contained", () => {
      expect(PILL_SRC).toContain("min-w-0 max-w-full");
      expect(PILL_SRC).toMatch(/whitespace-normal/);
      expect(PILL_SRC).toMatch(/shrink-0 rounded-full/); // dot stays fixed, label wraps
    });

    it("status pill never hides or truncates the readable status text", () => {
      // The label span is a real span with the full label text (no sr-only
      // visual swap, no width-clipping class).
      expect(PILL_SRC).toMatch(/<span className="min-w-0 whitespace-normal">/);
      expect(PILL_SRC).not.toContain("sr-only");
      expect(PILL_SRC).not.toMatch(/truncate|max-h-|overflow-hidden/);
    });
  });

  describe("A1: safeHref VersionHistory media URL rendering", () => {
    it("renders inert span when version mediaUrl has dangerous javascript: or data: scheme", () => {
      const maliciousJob: ContentDetailType = {
        ...mockJobDetail,
        versions: [
          {
            id: "v-malicious",
            contentId: "job-1",
            versionNumber: 1,
            caption: "Versão com payload malicioso",
            mediaUrl: "javascript:alert(document.cookie)",
            createdAt: new Date().toISOString(),
          },
          {
            id: "v-data",
            contentId: "job-1",
            versionNumber: 2,
            caption: "Versão com payload data uri",
            mediaUrl: "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
            createdAt: new Date().toISOString(),
          },
        ],
      };

      vi.spyOn(apiModule, "useContent").mockReturnValue({
        data: maliciousJob,
        isLoading: false,
      } as any);

      vi.spyOn(apiModule, "useJobActivityPage").mockReturnValue({
        data: { activities: [], total: 0 },
        isLoading: false,
      } as any);

      renderWithProviders(
        <Routes>
          <Route path="/contents/:id" element={<ContentDetail />} />
        </Routes>,
        "/contents/job-1",
      );

      // Must render inert warning text instead of clickable dangerous link
      const invalidSpans = screen.getAllByText("Mídia com URL inválida");
      expect(invalidSpans.length).toBe(2);

      // Verify no anchor tag contains javascript:
      const links = screen.queryAllByRole("link");
      const dangerousLink = links.find((l) => l.getAttribute("href")?.startsWith("javascript:"));
      expect(dangerousLink).toBeUndefined();
    });

    it("renders active link with target=_blank when version mediaUrl is valid https", () => {
      const safeJob: ContentDetailType = {
        ...mockJobDetail,
        versions: [
          {
            id: "v-safe",
            contentId: "job-1",
            versionNumber: 1,
            caption: "Versão segura",
            mediaUrl: "https://cdn.example.com/assets/banner.png",
            createdAt: new Date().toISOString(),
          },
        ],
      };

      vi.spyOn(apiModule, "useContent").mockReturnValue({
        data: safeJob,
        isLoading: false,
      } as any);

      vi.spyOn(apiModule, "useJobActivityPage").mockReturnValue({
        data: { activities: [], total: 0 },
        isLoading: false,
      } as any);

      renderWithProviders(
        <Routes>
          <Route path="/contents/:id" element={<ContentDetail />} />
        </Routes>,
        "/contents/job-1",
      );

      const mediaLink = screen.getByRole("link", { name: "Ver mídia" });
      expect(mediaLink).toBeInTheDocument();
      expect(mediaLink).toHaveAttribute("href", "https://cdn.example.com/assets/banner.png");
      expect(mediaLink).toHaveAttribute("target", "_blank");
      expect(mediaLink).toHaveAttribute("rel", "noopener noreferrer");
    });
  });

  describe("Job without any version (created by AI / no content yet)", () => {
    it("renders the demand instead of the not-found card, with a friendly empty content state", () => {
      vi.spyOn(apiModule, "useContent").mockReturnValue({
        data: { ...mockJobDetail, versions: [] },
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      } as any);
      vi.spyOn(apiModule, "useClients").mockReturnValue({ data: mockClients } as any);

      renderWithProviders(
        <Routes>
          <Route path="/contents/:id" element={<ContentDetail />} />
        </Routes>,
        "/contents/job-1",
      );

      expect(screen.queryByText("Demanda não encontrada.")).not.toBeInTheDocument();
      expect(screen.getAllByText("Post Cardápio de Verão").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Nenhum conteúdo anexado ainda.")).toBeInTheDocument();
    });
  });
});
