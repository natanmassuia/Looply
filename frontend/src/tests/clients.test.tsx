import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Clients from "../features/Clients";
import * as apiModule from "../lib/api";
import type { Client } from "../lib/types";

const mockClients: Client[] = [
  {
    id: "cli-1",
    name: "Restaurante Aurora",
    brandColor: "#e11d48",
    status: "ACTIVE",
    primaryContactName: "Ana Gerente",
    primaryContactEmail: "ana@aurora.com",
    primaryContactPhone: "11999999999",
    channels: ["Instagram", "Facebook"],
    activeContents: 3,
    createdAt: new Date().toISOString(),
  },
  {
    id: "cli-2",
    name: "Café Solar",
    brandColor: "#f59e0b",
    status: "PROSPECT",
    primaryContactName: "Carlos Dono",
    primaryContactEmail: "carlos@solar.com",
    primaryContactPhone: "11888888888",
    channels: ["Instagram"],
    activeContents: 0,
    createdAt: new Date().toISOString(),
  },
];

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("Clients Feature — B3 Functional Wiring", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders clients list with status and action buttons (Editar / Excluir)", async () => {
    vi.spyOn(apiModule, "useClients").mockReturnValue({
      data: mockClients,
      isLoading: false,
      isError: false,
    } as any);

    renderWithClient(<Clients />);

    expect(screen.getByText("Restaurante Aurora")).toBeInTheDocument();
    expect(screen.getByText("Café Solar")).toBeInTheDocument();

    expect(screen.getByLabelText("Editar Restaurante Aurora")).toBeInTheDocument();
    expect(screen.getByLabelText("Excluir Restaurante Aurora")).toBeInTheDocument();
    expect(screen.getByLabelText("Editar Café Solar")).toBeInTheDocument();
    expect(screen.getByLabelText("Excluir Café Solar")).toBeInTheDocument();
  });

  it("opens edit drawer pre-filled with client data and submits PATCH /api/clients/:id", async () => {
    vi.spyOn(apiModule, "useClients").mockReturnValue({
      data: mockClients,
      isLoading: false,
    } as any);

    const updateMutate = vi.fn().mockResolvedValue({
      id: "cli-1",
      name: "Restaurante Aurora Gourmet",
      status: "ACTIVE",
    });

    vi.spyOn(apiModule, "useUpdateClient").mockReturnValue({
      mutateAsync: updateMutate,
      isPending: false,
    } as any);

    renderWithClient(<Clients />);

    // Click Editar on Restaurante Aurora
    fireEvent.click(screen.getByLabelText("Editar Restaurante Aurora"));

    // Verify form pre-filled
    expect(screen.getByDisplayValue("Restaurante Aurora")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Ana Gerente")).toBeInTheDocument();
    expect(screen.getByDisplayValue("ana@aurora.com")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Instagram, Facebook")).toBeInTheDocument();

    // Edit Name and Status
    const nameInput = screen.getByDisplayValue("Restaurante Aurora");
    fireEvent.change(nameInput, { target: { value: "Restaurante Aurora Gourmet" } });

    const statusSelect = screen.getByDisplayValue("Ativo");
    fireEvent.change(statusSelect, { target: { value: "INACTIVE" } });

    // Submit
    const submitBtn = screen.getByRole("button", { name: "Salvar alterações" });
    fireEvent.click(submitBtn);

    expect(updateMutate).toHaveBeenCalledWith({
      id: "cli-1",
      body: {
        name: "Restaurante Aurora Gourmet",
        brandColor: "#e11d48",
        status: "INACTIVE",
        primaryContactName: "Ana Gerente",
        primaryContactEmail: "ana@aurora.com",
        primaryContactPhone: "11999999999",
        channels: ["Instagram", "Facebook"],
      },
    });
  });

  it("surfaces conflict error when updating with duplicate client name", async () => {
    vi.spyOn(apiModule, "useClients").mockReturnValue({
      data: mockClients,
      isLoading: false,
    } as any);

    vi.spyOn(apiModule, "useUpdateClient").mockReturnValue({
      mutateAsync: vi.fn().mockRejectedValue(new apiModule.ApiError(409, "Já existe um cliente com este nome no workspace")),
      isPending: false,
    } as any);

    renderWithClient(<Clients />);

    fireEvent.click(screen.getByLabelText("Editar Restaurante Aurora"));
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => {
      expect(screen.getByText("Já existe um cliente com este nome no workspace")).toBeInTheDocument();
    });
  });

  it("opens delete confirmation modal with client name and submits DELETE /api/clients/:id", async () => {
    vi.spyOn(apiModule, "useClients").mockReturnValue({
      data: mockClients,
      isLoading: false,
    } as any);

    const deleteMutate = vi.fn().mockResolvedValue(null);

    vi.spyOn(apiModule, "useDeleteClient").mockReturnValue({
      mutateAsync: deleteMutate,
      isPending: false,
    } as any);

    renderWithClient(<Clients />);

    // Click Excluir on Café Solar
    fireEvent.click(screen.getByLabelText("Excluir Café Solar"));

    // Verify modal content
    expect(screen.getByText(/Tem certeza que deseja excluir o cliente/i)).toBeInTheDocument();
    expect(screen.getAllByText("Café Solar").length).toBeGreaterThanOrEqual(1);

    // Confirm deletion
    const confirmBtn = screen.getByRole("button", { name: "Excluir cliente" });
    fireEvent.click(confirmBtn);

    expect(deleteMutate).toHaveBeenCalledWith("cli-2");
  });

  it("surfaces 409 conflict error when trying to delete client with linked jobs", async () => {
    vi.spyOn(apiModule, "useClients").mockReturnValue({
      data: mockClients,
      isLoading: false,
    } as any);

    vi.spyOn(apiModule, "useDeleteClient").mockReturnValue({
      mutateAsync: vi.fn().mockRejectedValue(
        new apiModule.ApiError(409, "Cliente possui conteúdos vinculados — desative-o em vez de excluir"),
      ),
      isPending: false,
    } as any);

    renderWithClient(<Clients />);

    fireEvent.click(screen.getByLabelText("Excluir Restaurante Aurora"));
    const confirmBtn = screen.getByRole("button", { name: "Excluir cliente" });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(
        screen.getByText("Cliente possui conteúdos vinculados — desative-o em vez de excluir"),
      ).toBeInTheDocument();
    });
  });

  it("filters clients list in memory using search input", async () => {
    vi.spyOn(apiModule, "useClients").mockReturnValue({
      data: mockClients,
      isLoading: false,
    } as any);

    renderWithClient(<Clients />);

    const searchInput = screen.getByPlaceholderText(/Buscar clientes por nome/i);
    fireEvent.change(searchInput, { target: { value: "Solar" } });

    expect(screen.getByText("Café Solar")).toBeInTheDocument();
    expect(screen.queryByText("Restaurante Aurora")).not.toBeInTheDocument();
  });
});
