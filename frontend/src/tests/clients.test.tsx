import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
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
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
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
    expect(screen.getByLabelText("Editar Café Solar")).toBeInTheDocument();
    expect(screen.getByLabelText("Mais ações para Restaurante Aurora")).toBeInTheDocument();
    expect(screen.getByLabelText("Mais ações para Café Solar")).toBeInTheDocument();

    // "Excluir" now lives inside the overflow menu, not on the card surface.
    fireEvent.click(screen.getByLabelText("Mais ações para Café Solar"));
    expect(screen.getByRole("menuitem", { name: "Excluir" })).toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: /^Instagram$/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /^Facebook$/ })).toHaveAttribute("aria-pressed", "true");

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

    // Open the overflow menu, then click Excluir on Café Solar
    fireEvent.click(screen.getByLabelText("Mais ações para Café Solar"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Excluir" }));

    // Verify modal content
    expect(screen.getByText(/Confirma a exclusão de/i)).toBeInTheDocument();
    expect(screen.getAllByText("Café Solar").length).toBeGreaterThanOrEqual(1);

    // Confirm deletion
    const confirmBtn = screen.getByRole("button", { name: "Confirmar exclusão" });
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

    fireEvent.click(screen.getByLabelText("Mais ações para Restaurante Aurora"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Excluir" }));
    const confirmBtn = screen.getByRole("button", { name: "Confirmar exclusão" });
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

    const searchInput = screen.getByPlaceholderText(/Buscar cliente por nome/i);
    fireEvent.change(searchInput, { target: { value: "Solar" } });

    expect(screen.getByText("Café Solar")).toBeInTheDocument();
    expect(screen.queryByText("Restaurante Aurora")).not.toBeInTheDocument();
  });

  it("renders interactive Demandas ativas counter and opens ClientDemandsModal on click", async () => {
    vi.spyOn(apiModule, "useClients").mockReturnValue({
      data: mockClients,
      isLoading: false,
    } as any);

    vi.spyOn(apiModule, "useContents").mockReturnValue({
      data: [
        {
          id: "cnt-1",
          clientId: "cli-1",
          title: "Post Promoção de Verão",
          format: "POST",
          status: "IN_REVIEW",
          updatedAt: new Date().toISOString(),
        },
      ],
      isLoading: false,
    } as any);

    renderWithClient(<Clients />);

    const countBtn = screen.getByLabelText("3 demandas ativas de Restaurante Aurora");
    expect(countBtn).toBeInTheDocument();
    fireEvent.click(countBtn);

    expect(screen.getByText("Demandas — Restaurante Aurora")).toBeInTheDocument();
    expect(screen.getByText("Post Promoção de Verão")).toBeInTheDocument();
  });

  it("renders 'Abrir' action linking directly to /clients/:id and not dashboard", async () => {
    vi.spyOn(apiModule, "useClients").mockReturnValue({
      data: mockClients,
      isLoading: false,
    } as any);

    renderWithClient(<Clients />);

    const openLinks = screen.getAllByRole("link", { name: "Abrir" });
    expect(openLinks.length).toBe(2);
    // Order is name-sorted (Café Solar before Restaurante Aurora); assert by href set.
    const hrefs = openLinks.map((l) => l.getAttribute("href"));
    expect(hrefs).toContain("/clients/cli-1");
    expect(hrefs).toContain("/clients/cli-2");
  });

  it("create form uses structured channel picker with Outro custom channel", async () => {
    vi.spyOn(apiModule, "useClients").mockReturnValue({
      data: mockClients,
      isLoading: false,
      isError: false,
    } as any);

    const createMutate = vi.fn().mockResolvedValue({ id: "cli-new" });
    vi.spyOn(apiModule, "useCreateClient").mockReturnValue({
      mutateAsync: createMutate,
      isPending: false,
    } as any);

    renderWithClient(<Clients />);

    fireEvent.click(screen.getByRole("button", { name: /Novo cliente/i }));

    // Default blank form ships Instagram selected; toggle it off, TikTok on
    fireEvent.click(screen.getByRole("button", { name: /^Instagram$/ }));
    fireEvent.click(screen.getByRole("button", { name: /^TikTok$/ }));

    // Outro reveals the custom channel input; add Pinterest
    fireEvent.click(screen.getByRole("button", { name: /^Outro$/ }));
    const customInput = screen.getByLabelText("Qual canal?");
    fireEvent.change(customInput, { target: { value: "Pinterest" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar canal personalizado" }));

    // Duplicate (case-insensitive) custom entry is dropped
    fireEvent.change(customInput, { target: { value: "pinterest" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar canal personalizado" }));
    expect(screen.getAllByText("Pinterest").length).toBe(1);

    fireEvent.change(screen.getByPlaceholderText("Ex.: Restaurante Aurora"), { target: { value: "Cliente Canais" } });
    fireEvent.click(screen.getByRole("button", { name: "Cadastrar" }));

    await waitFor(() => {
      expect(createMutate).toHaveBeenCalledWith(
        expect.objectContaining({ channels: ["TikTok", "Pinterest"] }),
      );
    });
  });

  it("unchecking Outro discards custom channels but keeps predefined ones", async () => {
    vi.spyOn(apiModule, "useClients").mockReturnValue({
      data: [
        { ...mockClients[0], channels: ["WhatsApp", "Telegram"] },
      ],
      isLoading: false,
      isError: false,
    } as any);

    const updateMutate = vi.fn().mockResolvedValue(null);
    vi.spyOn(apiModule, "useUpdateClient").mockReturnValue({
      mutateAsync: updateMutate,
      isPending: false,
    } as any);

    renderWithClient(<Clients />);

    fireEvent.click(screen.getByLabelText("Editar Restaurante Aurora"));
    // Edit form opens with WhatsApp (predefined) + Telegram (custom, so Outro is open)
    expect(screen.getByLabelText("Qual canal?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Outro$/ }));

    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => {
      expect(updateMutate).toHaveBeenCalledWith(
        expect.objectContaining({ body: expect.objectContaining({ channels: ["WhatsApp"] }) }),
      );
    });
  });

  // F14.1.1 — unified client editor contract.
  it("renders client logo on list cards when logoUrl is present", () => {
    vi.spyOn(apiModule, "useClients").mockReturnValue({
      data: [
        { ...mockClients[0], logoUrl: "/api/media/file?key=company%2Fc%2Fclients%2Fcli-1%2Flogo%2F1.png" },
      ],
      isLoading: false,
      isError: false,
    } as any);

    renderWithClient(<Clients />);

    const logo = screen.getByAltText("Restaurante Aurora");
    expect(logo.tagName).toBe("IMG");
    expect(logo).toHaveAttribute(
      "src",
      "/api/media/file?key=company%2Fc%2Fclients%2Fcli-1%2Flogo%2F1.png",
    );
  });

  it("opens the canonical editor with image upload from the list", () => {
    vi.spyOn(apiModule, "useClients").mockReturnValue({
      data: mockClients,
      isLoading: false,
    } as any);
    vi.spyOn(apiModule, "useUpdateClient").mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({}),
      isPending: false,
    } as any);

    renderWithClient(<Clients />);
    fireEvent.click(screen.getByLabelText("Editar Restaurante Aurora"));

    // Canonical editor exposes photo upload + channel picker + all fields.
    expect(screen.getByText("Logo do cliente")).toBeInTheDocument();
    expect(screen.getByLabelText("Canais")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Instagram$/ })).toHaveAttribute("aria-pressed", "true");
  });

  // F14.3 — operational filters.
  it("status filter: only ACTIVE clients shown when 'Ativos' selected", () => {
    vi.spyOn(apiModule, "useClients").mockReturnValue({
      data: mockClients,
      isLoading: false,
    } as any);

    renderWithClient(<Clients />);
    fireEvent.click(screen.getByRole("button", { name: "Ativos" }));

    expect(screen.getByText("Restaurante Aurora")).toBeInTheDocument(); // ACTIVE
    expect(screen.queryByText("Café Solar")).not.toBeInTheDocument(); // PROSPECT
  });

  it("pending-demand filter: only clients with activeContents > 0 shown", () => {
    vi.spyOn(apiModule, "useClients").mockReturnValue({
      data: [
        { ...mockClients[0], activeContents: 3 },
        { ...mockClients[1], activeContents: 0 },
      ],
      isLoading: false,
    } as any);

    renderWithClient(<Clients />);
    fireEvent.click(screen.getByRole("button", { name: "Com demandas pendentes" }));

    expect(screen.getByText("Restaurante Aurora")).toBeInTheDocument();
    expect(screen.queryByText("Café Solar")).not.toBeInTheDocument();
  });

  it("channel filter via 'Mais filtros' sheet narrows results", () => {
    vi.spyOn(apiModule, "useClients").mockReturnValue({
      data: mockClients,
      isLoading: false,
    } as any);

    renderWithClient(<Clients />);
    fireEvent.click(screen.getByRole("button", { name: /Mais filtros/ }));
    fireEvent.change(screen.getByLabelText("Filtrar por canal"), { target: { value: "Facebook" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));

    // Only Restaurante Aurora has Facebook in channels.
    expect(screen.getByText("Restaurante Aurora")).toBeInTheDocument();
    expect(screen.queryByText("Café Solar")).not.toBeInTheDocument();
  });

  it("sort by demand count puts the busiest client first", () => {
    vi.spyOn(apiModule, "useClients").mockReturnValue({
      data: [
        { ...mockClients[0], activeContents: 1 },
        { ...mockClients[1], activeContents: 5 },
      ],
      isLoading: false,
    } as any);

    renderWithClient(<Clients />);
    fireEvent.change(screen.getByLabelText("Ordenar clientes"), { target: { value: "demand-desc" } });

    const cards = screen.getAllByRole("link", { name: "Abrir" });
    expect(cards[0]).toHaveAttribute("href", "/clients/cli-2"); // Café Solar (5 demands)
    expect(cards[1]).toHaveAttribute("href", "/clients/cli-1");
  });

  it("clear filters resets to all clients", () => {
    vi.spyOn(apiModule, "useClients").mockReturnValue({
      data: mockClients,
      isLoading: false,
    } as any);

    renderWithClient(<Clients />);
    fireEvent.click(screen.getByRole("button", { name: "Ativos" }));
    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));

    expect(screen.getByText("Restaurante Aurora")).toBeInTheDocument();
    expect(screen.getByText("Café Solar")).toBeInTheDocument();
  });
});
