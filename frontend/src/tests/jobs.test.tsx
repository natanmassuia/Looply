import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
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
    format: "REELS",
    status: "DRAFT",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    client: mockClients[0],
    versions: [{ id: "v-2", contentId: "job-child-1", versionNumber: 1, caption: "Legenda", createdAt: "" }],
  },
];

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
      expect(screen.getByText("Editar detalhes do job")).toBeInTheDocument();
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
      expect(screen.getByText("Editar detalhes do job")).toBeInTheDocument();

      const cancelBtn = screen.getByRole("button", { name: "Cancelar" });
      fireEvent.click(cancelBtn);

      expect(screen.queryByText("Editar detalhes do job")).not.toBeInTheDocument();
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

      const ungroupMutate = vi.fn().mockResolvedValue({ id: "job-child-1", parentId: null });
      vi.spyOn(apiModule, "useUngroupContent").mockReturnValue({
        mutateAsync: ungroupMutate,
        isPending: false,
      } as any);

      renderWithProviders(<ContentsList />);

      expect(screen.getByText("Agrupados (1)")).toBeInTheDocument();
      expect(screen.getByText("Reels Making-of Verão")).toBeInTheDocument();

      const ungroupBtn = screen.getByLabelText("Desagrupar Reels Making-of Verão");
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

      expect(screen.getByText("Este job faz parte de um agrupamento de conteúdos.")).toBeInTheDocument();

      const ungroupBtn = screen.getByRole("button", { name: "Desagrupar job" });
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

      expect(screen.queryByText("Este job faz parte de um agrupamento de conteúdos.")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Desagrupar job" })).not.toBeInTheDocument();
    });
  });
});
