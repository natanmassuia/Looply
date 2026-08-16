import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Onboarding, { AccessGate, ChangePassword } from "../features/Onboarding";
import { ApiError } from "../lib/api";
import type { OnboardingStatus } from "../lib/types";

// ── Mocks ─────────────────────────────────────────────────────────────────
const meMock = vi.hoisted(() => ({
  data: undefined as
    | {
        mustChangePassword: boolean;
        workspace: { status: "ACTIVE" | "UNCONFIGURED" } | null;
      }
    | undefined,
  isPending: false,
  isError: false,
}));

const statusMock = vi.hoisted(() => ({
  data: undefined as OnboardingStatus | undefined,
  isPending: false,
  isError: false,
}));

const mutations = vi.hoisted(() => ({
  changePassword: { mutateAsync: vi.fn(), isPending: false },
  updateCompany: { mutateAsync: vi.fn(), isPending: false },
  selectTemplate: { mutateAsync: vi.fn(), isPending: false },
  complete: { mutateAsync: vi.fn(), isPending: false },
}));

vi.mock("../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/api")>();
  return {
    ...actual,
    useMe: () => meMock,
    useOnboardingStatus: () => statusMock,
    useChangePassword: () => mutations.changePassword,
    useUpdateOnboardingCompany: () => mutations.updateCompany,
    useSelectTemplate: () => mutations.selectTemplate,
    useCompleteOnboarding: () => mutations.complete,
  };
});

function makeStatus(overrides: Partial<OnboardingStatus> = {}): OnboardingStatus {
  return {
    mustChangePassword: false,
    company: {
      name: "Studio Aurora",
      timezone: "America/Sao_Paulo",
      locale: "pt-BR",
      template: null,
      onboardedAt: null,
    },
    readyToComplete: false,
    status: "ONBOARDING_REQUIRED",
    ...overrides,
  };
}

function renderGate(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AccessGate />}>
          <Route path="/change-password" element={<div>tela de senha</div>} />
          <Route path="/onboarding" element={<div>tela de onboarding</div>} />
          <Route path="/dashboard" element={<div>tela inicial</div>} />
          <Route path="/contents" element={<div>tela de conteúdos</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

// ── AccessGate: the canonical first-access routing authority ──────────────
describe("AccessGate", () => {
  beforeEach(() => {
    meMock.data = undefined;
    meMock.isPending = false;
    meMock.isError = false;
  });

  it("sends a temp-password user to the password screen from any app route", () => {
    meMock.data = { mustChangePassword: true, workspace: { status: "UNCONFIGURED" } };
    renderGate("/dashboard");
    expect(screen.getByText("tela de senha")).toBeTruthy();
  });

  it("keeps a temp-password user on the password screen (no loop)", () => {
    meMock.data = { mustChangePassword: true, workspace: { status: "UNCONFIGURED" } };
    renderGate("/change-password");
    expect(screen.getByText("tela de senha")).toBeTruthy();
  });

  it("sends an un-onboarded user to onboarding from any app route (no bypass)", () => {
    meMock.data = { mustChangePassword: false, workspace: { status: "UNCONFIGURED" } };
    renderGate("/contents");
    expect(screen.getByText("tela de onboarding")).toBeTruthy();
  });

  it("keeps an un-onboarded user on the onboarding screen (no loop)", () => {
    meMock.data = { mustChangePassword: false, workspace: { status: "UNCONFIGURED" } };
    renderGate("/onboarding");
    expect(screen.getByText("tela de onboarding")).toBeTruthy();
  });

  it("an active workspace never sees the onboarding screens again", () => {
    meMock.data = { mustChangePassword: false, workspace: { status: "ACTIVE" } };
    renderGate("/onboarding");
    expect(screen.getByText("tela inicial")).toBeTruthy();
  });

  it("an active workspace renders the app", () => {
    meMock.data = { mustChangePassword: false, workspace: { status: "ACTIVE" } };
    renderGate("/dashboard");
    expect(screen.getByText("tela inicial")).toBeTruthy();
  });
});

// ── ChangePassword ────────────────────────────────────────────────────────
describe("ChangePassword", () => {
  beforeEach(() => {
    mutations.changePassword.mutateAsync.mockReset();
    mutations.changePassword.isPending = false;
  });

  it("renders accessible labeled fields with new-password autocomplete", () => {
    render(<ChangePassword />);
    const password = screen.getByLabelText("Nova senha");
    const confirm = screen.getByLabelText("Confirmar nova senha");
    expect(password).toHaveAttribute("type", "password");
    expect(password).toHaveAttribute("autocomplete", "new-password");
    expect(confirm).toHaveAttribute("autocomplete", "new-password");
  });

  it("rejects a password shorter than the backend minimum without calling the API", async () => {
    const user = userEvent.setup();
    render(<ChangePassword />);
    await user.type(screen.getByLabelText("Nova senha"), "curta");
    await user.type(screen.getByLabelText("Confirmar nova senha"), "curta");
    await user.click(screen.getByRole("button", { name: "Salvar nova senha" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "A senha deve ter entre 10 e 200 caracteres",
    );
    expect(mutations.changePassword.mutateAsync).not.toHaveBeenCalled();
  });

  it("rejects mismatched confirmation without calling the API", async () => {
    const user = userEvent.setup();
    render(<ChangePassword />);
    await user.type(screen.getByLabelText("Nova senha"), "senhaforte123");
    await user.type(screen.getByLabelText("Confirmar nova senha"), "senhadiferente");
    await user.click(screen.getByRole("button", { name: "Salvar nova senha" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("As senhas não coincidem");
    expect(mutations.changePassword.mutateAsync).not.toHaveBeenCalled();
  });

  it("submits only the newPassword contract", async () => {
    const user = userEvent.setup();
    mutations.changePassword.mutateAsync.mockResolvedValue({ ok: true });
    render(<ChangePassword />);
    await user.type(screen.getByLabelText("Nova senha"), "senhaforte123");
    await user.type(screen.getByLabelText("Confirmar nova senha"), "senhaforte123");
    await user.click(screen.getByRole("button", { name: "Salvar nova senha" }));

    await waitFor(() => {
      expect(mutations.changePassword.mutateAsync).toHaveBeenCalledWith({
        newPassword: "senhaforte123",
      });
    });
  });

  it("shows a neutral message on network failure, never a raw error", async () => {
    const user = userEvent.setup();
    mutations.changePassword.mutateAsync.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<ChangePassword />);
    await user.type(screen.getByLabelText("Nova senha"), "senhaforte123");
    await user.type(screen.getByLabelText("Confirmar nova senha"), "senhaforte123");
    await user.click(screen.getByRole("button", { name: "Salvar nova senha" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível conectar. Tente novamente.",
    );
  });

  it("shows the server message on a rejected password", async () => {
    const user = userEvent.setup();
    mutations.changePassword.mutateAsync.mockRejectedValue(
      new ApiError(400, "Senha deve ter entre 10 e 200 caracteres"),
    );
    render(<ChangePassword />);
    await user.type(screen.getByLabelText("Nova senha"), "senhaforte123");
    await user.type(screen.getByLabelText("Confirmar nova senha"), "senhaforte123");
    await user.click(screen.getByRole("button", { name: "Salvar nova senha" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Senha deve ter entre 10 e 200 caracteres",
    );
  });
});

// ── Onboarding wizard ─────────────────────────────────────────────────────
describe("Onboarding", () => {
  beforeEach(() => {
    statusMock.data = makeStatus();
    statusMock.isPending = false;
    statusMock.isError = false;
    mutations.updateCompany.mutateAsync.mockReset();
    mutations.selectTemplate.mutateAsync.mockReset();
    mutations.complete.mutateAsync.mockReset();
    mutations.updateCompany.mutateAsync.mockResolvedValue({});
    mutations.selectTemplate.mutateAsync.mockResolvedValue({});
    mutations.complete.mutateAsync.mockResolvedValue({});
  });

  it("prefills step 1 from the server status and submits the company contract", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText("Nome do workspace")).toHaveValue("Studio Aurora");
    expect(screen.getByLabelText("Fuso horário")).toHaveValue("America/Sao_Paulo");
    expect(screen.getByLabelText("Idioma")).toHaveValue("pt-BR");

    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await waitFor(() => {
      expect(mutations.updateCompany.mutateAsync).toHaveBeenCalledWith({
        name: "Studio Aurora",
        timezone: "America/Sao_Paulo",
        locale: "pt-BR",
      });
    });
  });

  it("requires a company name before advancing", async () => {
    const user = userEvent.setup();
    statusMock.data = makeStatus({
      company: { name: "", timezone: "America/Sao_Paulo", locale: "pt-BR", template: null, onboardedAt: null },
    });
    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Informe o nome do workspace");
    expect(mutations.updateCompany.mutateAsync).not.toHaveBeenCalled();
  });

  it("step 2 requires a template before completing", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(await screen.findByRole("button", { name: "Concluir" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Escolha um modelo de trabalho");
    expect(mutations.selectTemplate.mutateAsync).not.toHaveBeenCalled();
    expect(mutations.complete.mutateAsync).not.toHaveBeenCalled();
  });

  it("selects the template, completes onboarding and prefills an existing choice", async () => {
    const user = userEvent.setup();
    statusMock.data = makeStatus({
      company: {
        name: "Studio Aurora",
        timezone: "America/Sao_Paulo",
        locale: "pt-BR",
        template: "HIGH_TICKET",
        onboardedAt: null,
      },
    });
    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    const radio = await screen.findByLabelText(/Alto ticket/);
    expect(radio).toBeChecked();

    await user.click(screen.getByRole("button", { name: "Concluir" }));
    await waitFor(() => {
      expect(mutations.selectTemplate.mutateAsync).toHaveBeenCalledWith("HIGH_TICKET");
      expect(mutations.complete.mutateAsync).toHaveBeenCalled();
    });
  });

  it("shows a neutral message when the company save fails", async () => {
    const user = userEvent.setup();
    mutations.updateCompany.mutateAsync.mockRejectedValue(new TypeError("Failed to fetch"));
    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível conectar. Tente novamente.",
    );
    expect(screen.queryByLabelText("Modelo de trabalho")).toBeNull();
  });
});
