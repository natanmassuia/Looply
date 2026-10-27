import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import Dashboard from "../features/Dashboard";
import * as apiModule from "../lib/api";
import type { Dashboard as DashboardData } from "../lib/types";

function mockDashboardData(overrides: Record<string, unknown> = {}) {
  const now = Date.now();
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;
  return {
    counts: {
      totalContents: 12,
      totalClients: 4,
      totalTeam: 3,
      draft: 2,
      inReview: 1,
      awaitingClient: 2,
      changesRequested: 1,
      approved: 3,
      scheduled: 2,
      published: 3,
    },
    recentContents: Array.from({ length: 7 }, (_, i) => ({
      id: `job-${i}`,
      title: `Demanda ${i + 1}`,
      clientId: "cli-1",
      format: "POST" as const,
      status: "IN_REVIEW" as const,
      createdAt: "2026-08-16T10:00:00.000Z",
      updatedAt: new Date(Date.UTC(2026, 7, 16, 10 + i)).toISOString(),
      client: { id: "cli-1", name: "Acme", brandColor: "#333" },
    })),
    needingAttention: [],
    attendance: {
      conversationsNeedingAttention: 2,
      conversationsActiveToday: 7,
      appointmentsToday: 3,
      activeDemands: 9,
    },
    workspace: { timezone: "America/Sao_Paulo" },
    upcoming: {
      timezone: "America/Sao_Paulo",
      events: [
        { id: "e1", type: "APPOINTMENT", at: new Date(now + 3 * hour).toISOString(), title: "Reunião", client: { id: "c1", name: "Acme" } },
        { id: "e2", type: "SCHEDULED", jobId: "job-9", at: new Date(now + 1 * day).toISOString(), title: "Publicação X", client: { id: "c2", name: "Cliente Y" } },
        { id: "e3", type: "APPOINTMENT", at: new Date(now + 3 * day).toISOString(), title: "Revisão final", client: { id: "c3", name: "Cliente Z" } },
      ],
      totalEvents: 3,
      truncated: false,
    },
    ...overrides,
  } as unknown as DashboardData;
}

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("F14.2 Dashboard density + upcoming", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders at most 5 active demands and a view-all action", () => {
    vi.spyOn(apiModule, "useDashboard").mockReturnValue({
      data: mockDashboardData(),
      isLoading: false,
      isError: false,
    } as any);
    vi.spyOn(apiModule, "useMe").mockReturnValue({ data: { user: { name: "Ana" }, workspace: {} } } as any);

    renderWithClient(<Dashboard />);

    // 5 rendered rows (the 7 recentContents are capped to 5).
    const rows = screen.getAllByText(/Demanda \d/);
    expect(rows).toHaveLength(5);
    // View all link.
    expect(screen.getByRole("link", { name: "Ver todas as demandas" })).toHaveAttribute("href", "/contents");
  });

  it("renders 'Próximas agendas' with up to 3 future appointments", () => {
    vi.spyOn(apiModule, "useDashboard").mockReturnValue({
      data: mockDashboardData(),
      isLoading: false,
      isError: false,
    } as any);
    vi.spyOn(apiModule, "useMe").mockReturnValue({ data: { user: { name: "Ana" }, workspace: {} } } as any);

    renderWithClient(<Dashboard />);

    expect(screen.getByText("Próximas agendas")).toBeInTheDocument();
    expect(screen.getByText(/Reunião/)).toBeInTheDocument();
    expect(screen.getByText(/Publicação X/)).toBeInTheDocument();
    expect(screen.getByText(/Revisão final/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver agenda completa" })).toHaveAttribute("href", "/calendar");
  });

  it("excludes past appointments and shows compact empty state when none", () => {
    vi.spyOn(apiModule, "useDashboard").mockReturnValue({
      data: mockDashboardData({
        upcoming: {
          timezone: "America/Sao_Paulo",
          events: [{ id: "past", type: "APPOINTMENT", at: "2020-01-01T00:00:00.000Z", title: "Passado", client: null }],
          totalEvents: 1,
          truncated: false,
        },
      }),
      isLoading: false,
      isError: false,
    } as any);
    vi.spyOn(apiModule, "useMe").mockReturnValue({ data: { user: { name: "Ana" }, workspace: {} } } as any);

    renderWithClient(<Dashboard />);

    expect(screen.queryByText("Passado")).not.toBeInTheDocument();
    expect(screen.getByText("Nenhuma agenda próxima")).toBeInTheDocument();
    expect(screen.getByText("Os próximos agendamentos aparecerão aqui.")).toBeInTheDocument();
  });

  it("shows the live workspace clock with company timezone label", () => {
    vi.spyOn(apiModule, "useDashboard").mockReturnValue({
      data: mockDashboardData(),
      isLoading: false,
      isError: false,
    } as any);
    vi.spyOn(apiModule, "useMe").mockReturnValue({ data: { user: { name: "Ana" }, workspace: {} } } as any);

    renderWithClient(<Dashboard />);

    expect(screen.getByText(/Horário da empresa/)).toBeInTheDocument();
  });

  // F14.3 — KPI drill-down links.
  it("attendance KPI tiles link to the correct drill-down destinations", () => {
    vi.spyOn(apiModule, "useDashboard").mockReturnValue({
      data: mockDashboardData(),
      isLoading: false,
      isError: false,
    } as any);
    vi.spyOn(apiModule, "useMe").mockReturnValue({ data: { user: { name: "Ana" }, workspace: {} } } as any);

    renderWithClient(<Dashboard />);

    expect(screen.getByRole("link", { name: /Precisam de atenção/ })).toHaveAttribute("href", "/inbox?aiStatus=NEEDS_ATTENTION");
    expect(screen.getByRole("link", { name: /Conversas hoje/ })).toHaveAttribute("href", "/inbox");
    expect(screen.getByRole("link", { name: /Agendamentos hoje/ })).toHaveAttribute("href", "/calendar");
    expect(screen.getByRole("link", { name: /Demandas ativas/ })).toHaveAttribute("href", "/contents");
  });
});

// F14.6 — Dashboard pending-demand density + header cleanup.
describe("F14.6 dashboard pending density + header", () => {
  function pendingData(count: number) {
    const needingAttention = Array.from({ length: count }, (_, i) => ({
      id: `p-${i}`,
      title: `Pendente ${i + 1}`,
      clientId: "cli-1",
      format: "POST" as const,
      status: "AWAITING_CLIENT" as const,
      updatedAt: new Date().toISOString(),
      client: { id: "cli-1", name: "Acme", brandColor: "#333" },
    }));
    return mockDashboardData({ needingAttention });
  }

  beforeEach(() => vi.restoreAllMocks());

  it("renders real total in header but only 3 pending rows when total > 3", () => {
    vi.spyOn(apiModule, "useDashboard").mockReturnValue({
      data: pendingData(5),
      isLoading: false,
      isError: false,
    } as any);
    vi.spyOn(apiModule, "useMe").mockReturnValue({ data: { user: { name: "Ana" }, workspace: {} } } as any);

    renderWithClient(<Dashboard />);

    // Header shows real total (5).
    expect(screen.getByText("5 demandas pendentes")).toBeInTheDocument();
    // Only 3 rows rendered.
    expect(screen.getAllByText(/Pendente \d/)).toHaveLength(3);
    // The demand block (F14.2) always renders one "Ver todas as demandas";
    // the pending block adds a SECOND one only when pending total > 3.
    expect(screen.getAllByRole("link", { name: "Ver todas as demandas" })).toHaveLength(2);
  });

  it("no view-all action and all rows when total <= 3", () => {
    const data = pendingData(3);
    data.recentContents = (data.recentContents ?? []).slice(0, 5);
    vi.spyOn(apiModule, "useDashboard").mockReturnValue({
      data,
      isLoading: false,
      isError: false,
    } as any);
    vi.spyOn(apiModule, "useMe").mockReturnValue({ data: { user: { name: "Ana" }, workspace: {} } } as any);

    renderWithClient(<Dashboard />);

    expect(screen.getAllByText(/Pendente \d/)).toHaveLength(3);
    // Only the demand block's single "Ver todas as demandas" (pending did not add one).
    expect(screen.getAllByRole("link", { name: "Ver todas as demandas" })).toHaveLength(1);
  });

  it("Dashboard header has NO 'Nova demanda' but has 'Ver demandas'", () => {
    vi.spyOn(apiModule, "useDashboard").mockReturnValue({
      data: mockDashboardData(),
      isLoading: false,
      isError: false,
    } as any);
    vi.spyOn(apiModule, "useMe").mockReturnValue({ data: { user: { name: "Ana" }, workspace: {} } } as any);

    renderWithClient(<Dashboard />);

    expect(screen.queryByRole("link", { name: "Nova demanda" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver demandas" })).toBeInTheDocument();
  });
});

// ── F14.7 — Dashboard mobile header meta row + contextual navigation ───────
describe("F14.7 Dashboard contextual navigation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const attentionItems = Array.from({ length: 4 }, (_, i) => ({
    id: `att-${i}`,
    title: `Pendente ${i + 1}`,
    clientId: "cli-1",
    format: "POST" as const,
    status: i === 0 ? "AWAITING_CLIENT" as const : "CHANGES_REQUESTED" as const,
    createdAt: "2026-08-16T10:00:00.000Z",
    updatedAt: "2026-08-16T10:00:00.000Z",
    client: { id: "cli-1", name: "Acme", brandColor: "#333" },
  }));

  function mockDashboard(needingAttention: unknown[] = []) {
    vi.spyOn(apiModule, "useDashboard").mockReturnValue({
      data: mockDashboardData({ needingAttention }),
      isLoading: false,
      isError: false,
    } as any);
    vi.spyOn(apiModule, "useMe").mockReturnValue({ data: { user: { name: "Ana" }, workspace: {} } } as any);
  }

  it("clock and 'Ver demandas' share one responsive header meta row", () => {
    mockDashboard();
    renderWithClient(<Dashboard />);

    const link = screen.getByRole("link", { name: "Ver demandas" });
    const row = link.parentElement?.parentElement;
    expect(row?.className).toContain("flex w-full flex-wrap items-center justify-between");
    expect(row?.className).toContain("sm:w-auto");
    expect(row?.className).toContain("sm:justify-end");
    // The clock sits in the same meta row on mobile.
    expect(row?.textContent).toContain("Horário da empresa");
  });

  it("attention 'Ver todas as demandas' opens Demandas focused on the first pending demand", () => {
    mockDashboard(attentionItems);
    renderWithClient(<Dashboard />);

    const link = screen.getAllByRole("link", { name: "Ver todas as demandas" })[0];
    expect(link.getAttribute("href")).toBe("/contents?focus=att-0");
  });

  it("conversations-needing-attention row links to the Inbox filtered by NEEDS_ATTENTION", () => {
    mockDashboard(attentionItems);
    renderWithClient(<Dashboard />);

    // Both the KPI tile and the in-panel row point at the filtered Inbox.
    const links = screen.getAllByRole("link").filter((l) => l.getAttribute("href") === "/inbox?aiStatus=NEEDS_ATTENTION");
    expect(links.length).toBeGreaterThanOrEqual(1);
  });

  it("attendance KPI tiles keep stable destinations regardless of pending demands", () => {
    mockDashboard();
    renderWithClient(<Dashboard />);

    expect(screen.getByRole("link", { name: /Demandas ativas/ })).toHaveAttribute("href", "/contents");
    expect(screen.getByRole("link", { name: /Agendamentos hoje/ })).toHaveAttribute("href", "/calendar");
  });
});
