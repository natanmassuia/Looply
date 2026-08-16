import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import Calendar from "../features/Calendar";
import * as apiModule from "../lib/api";
import type { ContentListItem, Appointment, Client } from "../lib/types";

const mockClients: Client[] = [
  { id: "cli-1", name: "Restaurante Aurora", brandColor: "#e11d48", status: "ACTIVE", channels: [], createdAt: "" },
];

const mockPublications: ContentListItem[] = [
  {
    id: "job-1",
    title: "Post Cardápio de Verão",
    clientId: "cli-1",
    format: "POST",
    status: "SCHEDULED",
    scheduledAt: "2026-08-20T12:00:00.000Z",
    createdAt: "2026-08-16T12:00:00.000Z",
    updatedAt: "2026-08-16T12:00:00.000Z",
    client: mockClients[0],
  },
];

const mockAppointments: Appointment[] = [
  {
    id: "app-1",
    companyId: "comp-1",
    title: "Reunião de Planejamento",
    description: "Alinhamento mensal",
    clientId: "cli-1",
    startsAt: "2026-08-20T14:00:00.000Z",
    endsAt: "2026-08-20T15:00:00.000Z",
    status: "SCHEDULED",
    createdAt: "2026-08-16T12:00:00.000Z",
    updatedAt: "2026-08-16T12:00:00.000Z",
  },
];

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Calendar & Appointments — B7 CRUD Wiring", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders both scheduled publications and appointments on calendar grid", () => {
    vi.spyOn(apiModule, "usePublications").mockReturnValue({
      data: mockPublications,
      isLoading: false,
      isError: false,
    } as any);

    vi.spyOn(apiModule, "useAppointments").mockReturnValue({
      data: { appointments: mockAppointments },
      isLoading: false,
      isError: false,
    } as any);

    vi.spyOn(apiModule, "useClients").mockReturnValue({ data: mockClients } as any);

    renderWithProviders(<Calendar />);

    expect(screen.getByText("Agenda")).toBeInTheDocument();
    expect(screen.getByText(/Restaurante Aurora · Post/i)).toBeInTheDocument();
    expect(screen.getByText(/📅 Reunião de Planejamento/i)).toBeInTheDocument();
  });

  it("opens create modal and submits POST /api/appointments on valid input", async () => {
    vi.spyOn(apiModule, "usePublications").mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as any);

    vi.spyOn(apiModule, "useAppointments").mockReturnValue({
      data: { appointments: [] },
      isLoading: false,
      isError: false,
    } as any);

    vi.spyOn(apiModule, "useClients").mockReturnValue({ data: mockClients } as any);

    const createMutate = vi.fn().mockResolvedValue({
      id: "app-new",
      title: "Gravação de Reels",
      startsAt: "2026-08-25T10:00:00.000Z",
      status: "SCHEDULED",
    });

    vi.spyOn(apiModule, "useCreateAppointment").mockReturnValue({
      mutateAsync: createMutate,
      isPending: false,
    } as any);

    renderWithProviders(<Calendar />);

    const newBtn = screen.getByRole("button", { name: /Novo compromisso/i });
    fireEvent.click(newBtn);

    expect(screen.getByRole("heading", { name: "Novo compromisso" })).toBeInTheDocument();

    const titleInput = screen.getByPlaceholderText(/Reunião de alinhamento com cliente/i);
    fireEvent.change(titleInput, { target: { value: "Gravação de Reels" } });

    const submitBtn = screen.getByRole("button", { name: "Criar compromisso" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Gravação de Reels",
          startsAt: expect.any(String),
        }),
      );
    });
  });

  it("blocks submission when end time is before start time", async () => {
    vi.spyOn(apiModule, "usePublications").mockReturnValue({ data: [], isLoading: false } as any);
    vi.spyOn(apiModule, "useAppointments").mockReturnValue({ data: { appointments: [] }, isLoading: false } as any);
    vi.spyOn(apiModule, "useClients").mockReturnValue({ data: mockClients } as any);

    const createMutate = vi.fn();
    vi.spyOn(apiModule, "useCreateAppointment").mockReturnValue({
      mutateAsync: createMutate,
      isPending: false,
    } as any);

    renderWithProviders(<Calendar />);

    fireEvent.click(screen.getByRole("button", { name: /Novo compromisso/i }));

    const titleInput = screen.getByPlaceholderText(/Reunião de alinhamento com cliente/i);
    fireEvent.change(titleInput, { target: { value: "Workshop" } });

    // Set invalid end date/time
    const inputs = document.querySelectorAll('input[type="date"]');
    const timeInputs = document.querySelectorAll('input[type="time"]');

    fireEvent.change(inputs[0], { target: { value: "2026-08-25" } });
    fireEvent.change(timeInputs[0], { target: { value: "14:00" } });

    fireEvent.change(inputs[1], { target: { value: "2026-08-25" } });
    fireEvent.change(timeInputs[1], { target: { value: "12:00" } }); // earlier!

    fireEvent.click(screen.getByRole("button", { name: "Criar compromisso" }));

    await waitFor(() => {
      expect(screen.getByText(/deve ser posterior ao início/i)).toBeInTheDocument();
      expect(createMutate).not.toHaveBeenCalled();
    });
  });

  it("opens edit modal and submits PATCH /api/appointments/:id", async () => {
    vi.spyOn(apiModule, "usePublications").mockReturnValue({ data: [], isLoading: false } as any);
    vi.spyOn(apiModule, "useAppointments").mockReturnValue({
      data: { appointments: mockAppointments },
      isLoading: false,
    } as any);
    vi.spyOn(apiModule, "useClients").mockReturnValue({ data: mockClients } as any);

    const updateMutate = vi.fn().mockResolvedValue({
      ...mockAppointments[0],
      title: "Reunião de Planejamento Q3",
    });

    vi.spyOn(apiModule, "useUpdateAppointment").mockReturnValue({
      mutateAsync: updateMutate,
      isPending: false,
    } as any);

    renderWithProviders(<Calendar />);

    const appBtn = screen.getByRole("button", { name: /📅 Reunião de Planejamento/i });
    fireEvent.click(appBtn);

    expect(screen.getByText("Detalhes do compromisso")).toBeInTheDocument();
    const titleInput = screen.getByDisplayValue("Reunião de Planejamento");
    fireEvent.change(titleInput, { target: { value: "Reunião de Planejamento Q3" } });

    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => {
      expect(updateMutate).toHaveBeenCalledWith({
        id: "app-1",
        body: expect.objectContaining({
          title: "Reunião de Planejamento Q3",
        }),
      });
    });
  });

  it("triggers cancel confirmation and submits POST /api/appointments/:id/cancel", async () => {
    vi.spyOn(apiModule, "usePublications").mockReturnValue({ data: [], isLoading: false } as any);
    vi.spyOn(apiModule, "useAppointments").mockReturnValue({
      data: { appointments: mockAppointments },
      isLoading: false,
    } as any);
    vi.spyOn(apiModule, "useClients").mockReturnValue({ data: mockClients } as any);

    const cancelMutate = vi.fn().mockResolvedValue({
      ...mockAppointments[0],
      status: "CANCELLED",
    });

    vi.spyOn(apiModule, "useCancelAppointment").mockReturnValue({
      mutateAsync: cancelMutate,
      isPending: false,
    } as any);

    renderWithProviders(<Calendar />);

    const appBtn = screen.getByRole("button", { name: /📅 Reunião de Planejamento/i });
    fireEvent.click(appBtn);

    const cancelBtn = screen.getByRole("button", { name: "Cancelar compromisso" });
    fireEvent.click(cancelBtn);

    expect(screen.getByText("Confirmar cancelamento?")).toBeInTheDocument();
    const confirmBtn = screen.getByRole("button", { name: "Sim, cancelar" });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(cancelMutate).toHaveBeenCalledWith("app-1");
    });
  });
});
