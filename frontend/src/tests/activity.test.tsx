import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ContentDetail from "../features/ContentDetail";
import * as apiModule from "../lib/api";
import type { ContentDetail as ContentDetailType, JobActivity } from "../lib/types";

const mockJobDetail: ContentDetailType = {
  id: "job-1",
  title: "Post Campanha de Inverno",
  clientId: "cli-1",
  format: "POST",
  channel: "Instagram",
  status: "DRAFT",
  createdAt: "2026-08-16T18:00:00.000Z",
  updatedAt: "2026-08-16T18:30:00.000Z",
  client: { id: "cli-1", name: "Restaurante Aurora", brandColor: "#e11d48", status: "ACTIVE", channels: [], createdAt: "" },
  responsible: { id: "user-1", name: "Lucas Designer", role: "DESIGNER" },
  versions: [
    {
      id: "v-1",
      contentId: "job-1",
      versionNumber: 1,
      caption: "Legenda da campanha",
      createdAt: "2026-08-16T18:00:00.000Z",
    },
  ],
};

const mockActivities: JobActivity[] = [
  {
    id: "act-1",
    jobId: "job-1",
    actorUserId: "user-1",
    type: "JOB_CREATED",
    metadata: { stageId: "stage-1" },
    createdAt: "2026-08-16T18:00:00.000Z",
  },
  {
    id: "act-2",
    jobId: "job-1",
    actorUserId: "user-1",
    type: "JOB_UPDATED",
    metadata: { patch: { title: "Post Campanha de Inverno" } },
    createdAt: "2026-08-16T18:30:00.000Z",
  },
  {
    id: "act-3",
    jobId: "job-1",
    actorUserId: null,
    type: "APPROVAL_REQUESTED",
    metadata: {},
    createdAt: "2026-08-16T19:00:00.000Z",
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

describe("Job Activity Feed — B6 Wiring", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders activity feed with real server activities and friendly copy", () => {
    vi.spyOn(apiModule, "useContent").mockReturnValue({
      data: mockJobDetail,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    vi.spyOn(apiModule, "useClients").mockReturnValue({ data: [] } as any);
    vi.spyOn(apiModule, "useJobFiles").mockReturnValue({ data: { files: [] }, isLoading: false } as any);

    vi.spyOn(apiModule, "useJobActivity").mockReturnValue({
      data: { activities: mockActivities },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    renderWithProviders(
      <Routes>
        <Route path="/contents/:id" element={<ContentDetail />} />
      </Routes>,
      "/contents/job-1",
    );

    expect(screen.getByText(/Histórico de atividades \(3\)/i)).toBeInTheDocument();
    expect(screen.getByText(/criou esta demanda/i)).toBeInTheDocument();
    expect(screen.getByText(/atualizou os detalhes da demanda/i)).toBeInTheDocument();
    expect(screen.getByText(/enviou a demanda para aprovação do cliente/i)).toBeInTheDocument();

    // Verify technical enums are NOT leaked
    expect(screen.queryByText("JOB_CREATED")).not.toBeInTheDocument();
    expect(screen.queryByText("JOB_UPDATED")).not.toBeInTheDocument();
    expect(screen.queryByText("APPROVAL_REQUESTED")).not.toBeInTheDocument();
    expect(screen.queryByText("stage-1")).not.toBeInTheDocument();
  });

  it("renders empty state when no activities are returned", () => {
    vi.spyOn(apiModule, "useContent").mockReturnValue({
      data: mockJobDetail,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    vi.spyOn(apiModule, "useClients").mockReturnValue({ data: [] } as any);
    vi.spyOn(apiModule, "useJobFiles").mockReturnValue({ data: { files: [] }, isLoading: false } as any);

    vi.spyOn(apiModule, "useJobActivity").mockReturnValue({
      data: { activities: [] },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    renderWithProviders(
      <Routes>
        <Route path="/contents/:id" element={<ContentDetail />} />
      </Routes>,
      "/contents/job-1",
    );

    expect(screen.getByText(/Nenhuma atividade registrada neste job ainda\./i)).toBeInTheDocument();
  });

  it("renders isolated error state and retry button without breaking job detail", () => {
    const refetchMock = vi.fn();
    vi.spyOn(apiModule, "useContent").mockReturnValue({
      data: mockJobDetail,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    vi.spyOn(apiModule, "useClients").mockReturnValue({ data: [] } as any);
    vi.spyOn(apiModule, "useJobFiles").mockReturnValue({ data: { files: [] }, isLoading: false } as any);

    vi.spyOn(apiModule, "useJobActivity").mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      refetch: refetchMock,
    } as any);

    renderWithProviders(
      <Routes>
        <Route path="/contents/:id" element={<ContentDetail />} />
      </Routes>,
      "/contents/job-1",
    );

    expect(screen.getByText(/Falha ao carregar histórico de atividades\./i)).toBeInTheDocument();
    const retryBtn = screen.getByRole("button", { name: "Tentar novamente" });
    expect(retryBtn).toBeInTheDocument();

    fireEvent.click(retryBtn);
    expect(refetchMock).toHaveBeenCalled();
  });

  // F14.2 — summary shows only the 5 most recent activities + total count,
  // and the full history opens in a scrollable modal with pagination.
  it("renders only the 5 latest activities and shows total count", () => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      id: `act-${i}`,
      jobId: "job-1",
      actorUserId: null,
      type: "JOB_UPDATED" as const,
      metadata: {},
      createdAt: new Date(Date.UTC(2026, 7, 16, 18 + i)).toISOString(),
    }));
    vi.spyOn(apiModule, "useContent").mockReturnValue({
      data: mockJobDetail,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);
    vi.spyOn(apiModule, "useClients").mockReturnValue({ data: [] } as any);
    vi.spyOn(apiModule, "useJobFiles").mockReturnValue({ data: { files: [] }, isLoading: false } as any);
    vi.spyOn(apiModule, "useJobActivity").mockReturnValue({
      data: { activities: many.slice(0, 5), total: 8, limit: 5, offset: 0 },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    renderWithProviders(
      <Routes>
        <Route path="/contents/:id" element={<ContentDetail />} />
      </Routes>,
      "/contents/job-1",
    );

    // Total count preserved in the heading.
    expect(screen.getByText(/Histórico de atividades \(8\)/i)).toBeInTheDocument();
    // Only 5 activity rows rendered (5 × "atualizou os detalhes" text).
    expect(screen.getAllByText(/atualizou os detalhes da demanda/i)).toHaveLength(5);
    // View-all action present when total > 5.
    expect(screen.getByRole("button", { name: "Ver todo o histórico" })).toBeInTheDocument();
  });

  it("hides 'Ver todo o histórico' when total <= 5", () => {
    vi.spyOn(apiModule, "useContent").mockReturnValue({
      data: mockJobDetail,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);
    vi.spyOn(apiModule, "useClients").mockReturnValue({ data: [] } as any);
    vi.spyOn(apiModule, "useJobFiles").mockReturnValue({ data: { files: [] }, isLoading: false } as any);
    vi.spyOn(apiModule, "useJobActivity").mockReturnValue({
      data: { activities: mockActivities, total: 3, limit: 5, offset: 0 },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    renderWithProviders(
      <Routes>
        <Route path="/contents/:id" element={<ContentDetail />} />
      </Routes>,
      "/contents/job-1",
    );

    expect(screen.getByText(/Histórico de atividades \(3\)/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ver todo o histórico" })).not.toBeInTheDocument();
  });

  it("opens full activity history modal with internal scroll and pagination", async () => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      id: `act-${i}`,
      jobId: "job-1",
      actorUserId: null,
      type: "JOB_UPDATED" as const,
      metadata: {},
      createdAt: new Date(Date.UTC(2026, 7, 16, 18 + i)).toISOString(),
    }));
    vi.spyOn(apiModule, "useContent").mockReturnValue({
      data: mockJobDetail,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);
    vi.spyOn(apiModule, "useClients").mockReturnValue({ data: [] } as any);
    vi.spyOn(apiModule, "useJobFiles").mockReturnValue({ data: { files: [] }, isLoading: false } as any);
    vi.spyOn(apiModule, "useJobActivity").mockReturnValue({
      data: { activities: many.slice(0, 5), total: 8, limit: 5, offset: 0 },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);
    vi.spyOn(apiModule, "useJobActivityPage").mockReturnValue({
      data: { activities: many.slice(0, 5), total: 8, limit: 5, offset: 0 },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    renderWithProviders(
      <Routes>
        <Route path="/contents/:id" element={<ContentDetail />} />
      </Routes>,
      "/contents/job-1",
    );

    fireEvent.click(screen.getByRole("button", { name: "Ver todo o histórico" }));

    // Modal opens with the full total + internal scrollable container.
    expect(screen.getAllByText(/Histórico de atividades \(8\)/i).length).toBeGreaterThanOrEqual(1);
    // Pagination control present because there are more items to load.
    expect(screen.getByRole("button", { name: "Carregar mais" })).toBeInTheDocument();
  });
});
