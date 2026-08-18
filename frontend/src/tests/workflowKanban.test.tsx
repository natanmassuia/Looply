import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import ContentsList, { autoScrollDelta } from "../features/ContentsList";
import * as apiModule from "../lib/api";
import type { ContentListItem, Client, WorkflowDefinition } from "../lib/types";

const clients: Client[] = [
  { id: "cli-1", name: "Restaurante Aurora", brandColor: "#e11d48", status: "ACTIVE", channels: ["Instagram"], createdAt: "" },
];

const scrambledStages = [
  { id: "sA", workflowId: "w1", name: "Etapa Omega", position: 2, terminal: false, active: true, semanticKey: null },
  { id: "sB", workflowId: "w1", name: "Etapa Alfa", position: 0, terminal: false, active: true, semanticKey: null },
  { id: "sC", workflowId: "w1", name: "Etapa Beta", position: 1, terminal: false, active: true, semanticKey: null },
];

const kanbanStages = [
  { id: "s1", workflowId: "w1", name: "Etapa Alfa", position: 0, terminal: false, active: true, semanticKey: null },
  { id: "s2", workflowId: "w1", name: "Etapa Beta", position: 1, terminal: false, active: true, semanticKey: null },
  { id: "s3", workflowId: "w1", name: "Etapa Gama", position: 2, terminal: true, active: true, semanticKey: "COMPLETED" },
  { id: "s4", workflowId: "w1", name: "Aprovado", position: 3, terminal: false, active: true, semanticKey: "APPROVED" },
  { id: "s5", workflowId: "w1", name: "Agendado", position: 4, terminal: false, active: true, semanticKey: "SCHEDULED" },
];

function workflow(stages: WorkflowDefinition["stages"]): WorkflowDefinition {
  return { id: "w1", companyId: "c1", name: "Workflow", template: "MARKETING_AGENCY", active: true, stages };
}

function makeItem(partial: Partial<ContentListItem> & { id: string; title: string }): ContentListItem {
  return {
    clientId: "cli-1",
    format: "POST",
    status: "DRAFT",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    client: clients[0],
    versions: [],
    ...partial,
  };
}

function renderBoard(items: ContentListItem[], stages: WorkflowDefinition["stages"], appointmentMutateAsync?: typeof vi.fn) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  vi.spyOn(apiModule, "useContents").mockReturnValue({
    data: items,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as any);
  vi.spyOn(apiModule, "useClients").mockReturnValue({ data: clients } as any);
  vi.spyOn(apiModule, "useWorkflow").mockReturnValue({
    data: workflow(stages),
    isLoading: false,
    isError: false,
  } as any);
  vi.spyOn(apiModule, "useGroupContent").mockReturnValue({ mutate: vi.fn() } as any);
  vi.spyOn(apiModule, "useUngroupContent").mockReturnValue({ mutateAsync: vi.fn() } as any);
  vi.spyOn(apiModule, "useCreateAppointment").mockReturnValue({
    mutateAsync: appointmentMutateAsync ?? vi.fn().mockResolvedValue({ id: "apt-1" }),
    isPending: false,
  } as any);
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{<ContentsList />}</MemoryRouter>
    </QueryClientProvider>,
  );
}

function columnOf(text: string): string | null {
  return screen.getByText(text).closest("[data-stage-id]")?.getAttribute("data-stage-id") ?? null;
}

function dragCardToStage(cardTitle: string, id: string, stageId: string) {
  fireEvent.dragStart(screen.getByText(cardTitle), { dataTransfer: { setData: vi.fn(), effectAllowed: "move" } });
  const col = document.querySelector(`[data-stage-id="${stageId}"]`);
  fireEvent.dragOver(col!, { dataTransfer: { getData: vi.fn() } });
  fireEvent.drop(col!, { dataTransfer: { getData: vi.fn().mockReturnValue(id) } });
  fireEvent.dragEnd(screen.getByText(cardTitle));
}

describe("Workflow Kanban (R1.3)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("board columns render from WorkflowStage (not hardcoded statuses)", () => {
    renderBoard([makeItem({ id: "job-alpha", title: "Card Alfa", currentStageId: "s1" })], kanbanStages);
    expect(screen.getByText("Etapa Alfa")).toBeInTheDocument();
    expect(screen.getByText("Etapa Beta")).toBeInTheDocument();
    expect(screen.getByText("Etapa Gama")).toBeInTheDocument();
    // ContentStatus labels no longer appear as columns.
    expect(screen.queryByText("Rascunho")).not.toBeInTheDocument();
    expect(screen.queryByText("Em revisão")).not.toBeInTheDocument();
  });

  it("column order follows workflow position, not array order", () => {
    renderBoard([makeItem({ id: "job-alpha", title: "Card Alfa", currentStageId: "sB" })], scrambledStages);
    const cols = Array.from(document.querySelectorAll("[data-stage-id]")).map((el) => el.getAttribute("data-stage-id"));
    expect(cols).toEqual(["sB", "sC", "sA"]);
  });

  it("card placement follows currentStageId", () => {
    renderBoard(
      [
        makeItem({ id: "job-alpha", title: "Card Alfa", currentStageId: "s1" }),
        makeItem({ id: "job-beta", title: "Card Beta", currentStageId: "s2" }),
      ],
      kanbanStages,
    );
    expect(columnOf("Card Alfa")).toBe("s1");
    expect(columnOf("Card Beta")).toBe("s2");
  });

  it("regular drag uses the stage transition path, not PATCH status", async () => {
    const transition = vi.spyOn(apiModule, "apiFetch").mockResolvedValue({} as never);
    renderBoard([makeItem({ id: "job-beta", title: "Card Beta", currentStageId: "s1" })], kanbanStages);

    dragCardToStage("Card Beta", "job-beta", "s3");

    await waitFor(() => {
      expect(transition).toHaveBeenCalledWith("/api/jobs/job-beta/transition", {
        method: "POST",
        body: { stageId: "s3" },
      });
    });
    const statusCalls = transition.mock.calls.filter((c) => String(c[0]).includes("/status"));
    expect(statusCalls).toHaveLength(0);
  });

  it("APPROVED protected destination does not optimistically approve", async () => {
    const transition = vi
      .spyOn(apiModule, "apiFetch")
      .mockRejectedValue(new apiModule.ApiError(409, "Movimento direto para a etapa de aprovação não é permitido"));
    renderBoard([makeItem({ id: "job-draft", title: "Card DRAFT", currentStageId: "s1" })], kanbanStages);

    dragCardToStage("Card DRAFT", "job-draft", "s4");

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("não é permitido");
    });
    expect(columnOf("Card DRAFT")).toBe("s1"); // never left the source
    const statusCalls = transition.mock.calls.filter((c) => String(c[0]).includes("/status"));
    expect(statusCalls).toHaveLength(0);
  });

  it("SCHEDULED destination opens the canonical scheduling interaction (no transition call)", async () => {
    const transition = vi.spyOn(apiModule, "apiFetch");
    renderBoard(
      [makeItem({ id: "job-approved", title: "Post Aprovado", currentStageId: "s4", status: "APPROVED" })],
      kanbanStages,
    );

    dragCardToStage("Post Aprovado", "job-approved", "s5");

    expect(await screen.findByRole("heading", { name: "Agendar conteúdo" })).toBeInTheDocument();
    expect(transition).not.toHaveBeenCalled();
  });

  it("scheduling cancel leaves the card in the source column", async () => {
    renderBoard(
      [makeItem({ id: "job-approved", title: "Post Aprovado", currentStageId: "s4", status: "APPROVED" })],
      kanbanStages,
    );

    dragCardToStage("Post Aprovado", "job-approved", "s5");
    await screen.findByRole("heading", { name: "Agendar conteúdo" });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("heading", { name: "Agendar conteúdo" })).not.toBeInTheDocument();
    expect(columnOf("Post Aprovado")).toBe("s4");
  });

  it("scheduling failure surfaces the error and restores the source", async () => {
    renderBoard(
      [makeItem({ id: "job-approved", title: "Post Aprovado", currentStageId: "s4", status: "APPROVED" })],
      kanbanStages,
      vi.fn().mockRejectedValue(new apiModule.ApiError(400, "Falha ao agendar")),
    );

    dragCardToStage("Post Aprovado", "job-approved", "s5");
    await screen.findByRole("heading", { name: "Agendar conteúdo" });
    fireEvent.change(screen.getByLabelText("Data"), { target: { value: "2026-09-01" } });
    fireEvent.change(screen.getByLabelText("Horário"), { target: { value: "10:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Agendar conteúdo" }));

    await waitFor(() => expect(screen.getByText("Falha ao agendar")).toBeInTheDocument());
    expect(columnOf("Post Aprovado")).toBe("s4");
  });

  it("auto-scroll delta drives the board left/right while dragging", () => {
    const rect = { left: 0, right: 800 };
    // Near the right edge → scroll right.
    expect(autoScrollDelta(760, rect)).toBeGreaterThan(0);
    // Near the left edge → scroll left.
    expect(autoScrollDelta(20, rect)).toBeLessThan(0);
    // Middle of the board → no scroll.
    expect(autoScrollDelta(400, rect)).toBe(0);
  });

  it("destination column receives active feedback and clears it after drop", async () => {
    const transition = vi.spyOn(apiModule, "apiFetch").mockResolvedValue({} as never);
    renderBoard([makeItem({ id: "job-alpha", title: "Card Alfa", currentStageId: "s1" })], kanbanStages);

    const col = document.querySelector('[data-stage-id="s3"]')!;
    fireEvent.dragOver(col, { dataTransfer: { getData: vi.fn() } });
    expect(col.className).toContain("border-brand-400");

    fireEvent.drop(col, { dataTransfer: { getData: vi.fn().mockReturnValue("job-alpha") } });
    await waitFor(() => expect(transition).toHaveBeenCalled());
    expect(col.className).not.toContain("border-brand-400");
  });
});
