import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import WorkflowSettings from "../features/WorkflowSettings";
import * as apiModule from "../lib/api";
import type { WorkflowDefinition } from "../lib/types";

const mockWorkflow: WorkflowDefinition = {
  id: "w1",
  companyId: "c1",
  name: "Operação de agência",
  template: "MARKETING_AGENCY",
  active: true,
  stages: [
    { id: "s1", workflowId: "w1", name: "Backlog", position: 0, terminal: false, active: true },
    { id: "s2", workflowId: "w1", name: "Em produção", position: 1, terminal: false, active: true },
    { id: "s3", workflowId: "w1", name: "Revisão", position: 2, terminal: false, active: true },
    { id: "s4", workflowId: "w1", name: "Concluído", position: 3, terminal: true, active: true },
  ],
};

function renderWithProviders() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={qc}>
      <WorkflowSettings />
    </QueryClientProvider>,
  );
}

describe("Workflow Settings (R1)", () => {
  it("renders the current ordered workflow stages", () => {
    vi.spyOn(apiModule, "useWorkflow").mockReturnValue({
      data: mockWorkflow,
      isLoading: false,
      isError: false,
    } as any);

    renderWithProviders();
    expect(screen.getByText("Operação de agência")).toBeInTheDocument();
    expect(screen.getByText("Backlog")).toBeInTheDocument();
    expect(screen.getByText("Em produção")).toBeInTheDocument();
    expect(screen.getByText("Concluído")).toBeInTheDocument();
    // Terminal stage flagged.
    expect(screen.getAllByText("Final").length).toBeGreaterThanOrEqual(1);
  });

  it("adds a custom stage", async () => {
    vi.spyOn(apiModule, "useWorkflow").mockReturnValue({
      data: mockWorkflow,
      isLoading: false,
      isError: false,
    } as any);
    const addMutate = vi.fn().mockResolvedValue({ id: "s5", name: "Publicação" });
    vi.spyOn(apiModule, "useAddWorkflowStage").mockReturnValue({
      mutateAsync: addMutate,
      isPending: false,
    } as any);

    renderWithProviders();
    fireEvent.change(screen.getByLabelText("Nova etapa"), { target: { value: "Publicação" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    await waitFor(() => expect(addMutate).toHaveBeenCalledWith("Publicação"));
  });

  it("renames an editable (non-terminal) stage", async () => {
    vi.spyOn(apiModule, "useWorkflow").mockReturnValue({
      data: mockWorkflow,
      isLoading: false,
      isError: false,
    } as any);
    const renameMutate = vi.fn().mockResolvedValue({ id: "s2", name: "Em produção final" });
    vi.spyOn(apiModule, "useRenameWorkflowStage").mockReturnValue({
      mutateAsync: renameMutate,
      isPending: false,
    } as any);

    renderWithProviders();
    fireEvent.click(screen.getByRole("button", { name: /Renomear Em produção/ }));
    fireEvent.change(screen.getByLabelText("Nome da etapa"), { target: { value: "Em produção final" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(renameMutate).toHaveBeenCalledWith({ stageId: "s2", name: "Em produção final" }),
    );
  });

  it("reorders via move controls", async () => {
    vi.spyOn(apiModule, "useWorkflow").mockReturnValue({
      data: mockWorkflow,
      isLoading: false,
      isError: false,
    } as any);
    const reorderMutate = vi.fn().mockResolvedValue(mockWorkflow);
    vi.spyOn(apiModule, "useReorderWorkflowStages").mockReturnValue({
      mutateAsync: reorderMutate,
      isPending: false,
    } as any);

    renderWithProviders();
    fireEvent.click(screen.getByRole("button", { name: /Mover para cima Em produção/ }));
    await waitFor(() => expect(reorderMutate).toHaveBeenCalled());
  });

  it("does not allow mutating the protected terminal stage", async () => {
    vi.spyOn(apiModule, "useWorkflow").mockReturnValue({
      data: mockWorkflow,
      isLoading: false,
      isError: false,
    } as any);

    renderWithProviders();
    // Terminal stage reorder/rename/remove controls are disabled.
    const removeBtn = screen.getByRole("button", { name: /Remover Concluído/ });
    expect(removeBtn).toBeDisabled();
    const renameBtn = screen.getByRole("button", { name: /Renomear Concluído/ });
    expect(renameBtn).toBeDisabled();
  });

  it("surfaces a removal error (e.g. stage in use)", async () => {
    vi.spyOn(apiModule, "useWorkflow").mockReturnValue({
      data: mockWorkflow,
      isLoading: false,
      isError: false,
    } as any);
    const removeMutate = vi.fn().mockRejectedValue(new Error("Não é possível remover uma etapa que contém demandas"));
    vi.spyOn(apiModule, "useRemoveWorkflowStage").mockReturnValue({
      mutateAsync: removeMutate,
      isPending: false,
    } as any);

    renderWithProviders();
    fireEvent.click(screen.getByRole("button", { name: /Remover Em produção/ }));
    await waitFor(() => expect(screen.getByText(/Falha ao remover etapa/i)).toBeInTheDocument());
  });
});
