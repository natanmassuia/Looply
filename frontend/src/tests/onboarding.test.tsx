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
        user: { id: string; name: string; email: string };
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
  updateAppearance: { mutateAsync: vi.fn(), isPending: false },
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
    useUpdateOnboardingAppearance: () => mutations.updateAppearance,
    useCompleteOnboarding: () => mutations.complete,
  };
});

function makeStatus(overrides: Partial<OnboardingStatus> = {}): OnboardingStatus {
  return {
    mustChangePassword: false,
    company: {
      name: "Studio Aurora",
      website: null,
      timezone: "America/Sao_Paulo",
      locale: "pt-BR",
      template: null,
      onboardedAt: null,
    },
    appearance: { preset: "AURA", mode: "LIGHT", customColors: null },
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

function renderOnboarding() {
  return render(
    <MemoryRouter>
      <Onboarding />
    </MemoryRouter>,
  );
}

// Clicks through the wizard up to (and excluding) `target`; selects the
// Negócio Local profile on the way when passing step 3.
async function advanceTo(user: ReturnType<typeof userEvent.setup>, target: number) {
  if (target >= 2) await user.click(screen.getByRole("button", { name: "Começar configuração" }));
  if (target >= 3) await user.click(screen.getByRole("button", { name: "Continuar" })); // company
  if (target >= 4) {
    await user.click(screen.getByLabelText(/Negócio Local/));
    await user.click(screen.getByRole("button", { name: "Continuar" })); // profile
  }
  if (target >= 5) await user.click(screen.getByRole("button", { name: "Continuar" })); // confirmation
  if (target >= 6) await user.click(screen.getByRole("button", { name: "Continuar sem conectar" })); // meta
  if (target >= 7) await user.click(screen.getByRole("button", { name: "Continuar" })); // appearance
}

// ── AccessGate: the canonical first-access routing authority ──────────────
describe("AccessGate", () => {
  beforeEach(() => {
    meMock.data = undefined;
    meMock.isPending = false;
    meMock.isError = false;
  });

  it("sends a temp-password user to the password screen from any app route", () => {
    meMock.data = {
      user: { id: "u1", name: "Ana", email: "a@b.c" },
      mustChangePassword: true,
      workspace: { status: "UNCONFIGURED" },
    };
    renderGate("/dashboard");
    expect(screen.getByText("tela de senha")).toBeTruthy();
  });

  it("keeps a temp-password user on the password screen (no loop)", () => {
    meMock.data = {
      user: { id: "u1", name: "Ana", email: "a@b.c" },
      mustChangePassword: true,
      workspace: { status: "UNCONFIGURED" },
    };
    renderGate("/change-password");
    expect(screen.getByText("tela de senha")).toBeTruthy();
  });

  it("sends an un-onboarded user to onboarding from any app route (no bypass)", () => {
    meMock.data = {
      user: { id: "u1", name: "Ana", email: "a@b.c" },
      mustChangePassword: false,
      workspace: { status: "UNCONFIGURED" },
    };
    renderGate("/contents");
    expect(screen.getByText("tela de onboarding")).toBeTruthy();
  });

  it("keeps an un-onboarded user on the onboarding screen (no loop)", () => {
    meMock.data = {
      user: { id: "u1", name: "Ana", email: "a@b.c" },
      mustChangePassword: false,
      workspace: { status: "UNCONFIGURED" },
    };
    renderGate("/onboarding");
    expect(screen.getByText("tela de onboarding")).toBeTruthy();
  });

  it("an active workspace never sees the onboarding screens again", () => {
    meMock.data = {
      user: { id: "u1", name: "Ana", email: "a@b.c" },
      mustChangePassword: false,
      workspace: { status: "ACTIVE" },
    };
    renderGate("/onboarding");
    expect(screen.getByText("tela inicial")).toBeTruthy();
  });

  it("an active workspace renders the app", () => {
    meMock.data = {
      user: { id: "u1", name: "Ana", email: "a@b.c" },
      mustChangePassword: false,
      workspace: { status: "ACTIVE" },
    };
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

// ── Onboarding wizard (F4C · Figma 05: 7 steps over real contracts) ───────
describe("Onboarding", () => {
  beforeEach(() => {
    meMock.data = {
      user: { id: "u1", name: "Ana Souza", email: "a@b.c" },
      mustChangePassword: false,
      workspace: { status: "UNCONFIGURED" },
    };
    statusMock.data = makeStatus();
    statusMock.isPending = false;
    statusMock.isError = false;
    mutations.updateCompany.mutateAsync.mockReset();
    mutations.selectTemplate.mutateAsync.mockReset();
    mutations.updateAppearance.mutateAsync.mockReset();
    mutations.complete.mutateAsync.mockReset();
    mutations.updateCompany.mutateAsync.mockResolvedValue({});
    mutations.selectTemplate.mutateAsync.mockResolvedValue({});
    mutations.updateAppearance.mutateAsync.mockResolvedValue({});
    mutations.complete.mutateAsync.mockResolvedValue({});
  });

  it("step 1 (welcome) is presentational and advances without any API call", async () => {
    const user = userEvent.setup();
    renderOnboarding();
    expect(screen.getByText(/Bem-vindo, Ana\./)).toBeTruthy();
    expect(screen.getByText("Etapa 1 de 7")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Começar configuração" }));
    expect(screen.getByText("Etapa 2 de 7")).toBeTruthy();
    expect(mutations.updateCompany.mutateAsync).not.toHaveBeenCalled();
  });

  it("step 2 prefills from server status and submits the company contract incl. site", async () => {
    const user = userEvent.setup();
    statusMock.data = makeStatus({
      company: {
        name: "Studio Aurora",
        website: "https://aurora.example",
        timezone: "America/Sao_Paulo",
        locale: "pt-BR",
        template: null,
        onboardedAt: null,
      },
    });
    renderOnboarding();
    await user.click(screen.getByRole("button", { name: "Começar configuração" }));

    expect(screen.getByLabelText("Nome da empresa")).toHaveValue("Studio Aurora");
    expect(screen.getByLabelText("Site")).toHaveValue("https://aurora.example");
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    await waitFor(() => {
      expect(mutations.updateCompany.mutateAsync).toHaveBeenCalledWith({
        name: "Studio Aurora",
        website: "https://aurora.example",
        timezone: "America/Sao_Paulo",
        locale: "pt-BR",
      });
    });
    expect(screen.getByText("Etapa 3 de 7")).toBeTruthy();
  });

  it("step 2 requires a company name before advancing", async () => {
    const user = userEvent.setup();
    statusMock.data = makeStatus({
      company: {
        name: "",
        website: null,
        timezone: "America/Sao_Paulo",
        locale: "pt-BR",
        template: null,
        onboardedAt: null,
      },
    });
    renderOnboarding();
    await user.click(screen.getByRole("button", { name: "Começar configuração" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Informe o nome da empresa");
    expect(mutations.updateCompany.mutateAsync).not.toHaveBeenCalled();
  });

  it("step 3 (profile) requires a choice and persists the template", async () => {
    const user = userEvent.setup();
    renderOnboarding();
    await user.click(screen.getByRole("button", { name: "Começar configuração" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Escolha um perfil de operação");
    expect(mutations.selectTemplate.mutateAsync).not.toHaveBeenCalled();

    await user.click(screen.getByLabelText(/Agência de Marketing/));
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    await waitFor(() => {
      expect(mutations.selectTemplate.mutateAsync).toHaveBeenCalledWith("MARKETING_AGENCY");
    });
    expect(screen.getByText("Etapa 4 de 7")).toBeTruthy();
  });

  it("step 4 (confirmation) explains the chosen profile without capability toggles", async () => {
    const user = userEvent.setup();
    statusMock.data = makeStatus({
      company: {
        name: "Studio Aurora",
        website: null,
        timezone: "America/Sao_Paulo",
        locale: "pt-BR",
        template: "HIGH_TICKET",
        onboardedAt: null,
      },
    });
    renderOnboarding();
    await user.click(screen.getByRole("button", { name: "Começar configuração" }));
    await user.click(screen.getByRole("button", { name: "Continuar" })); // company
    // profile prefilled with HIGH_TICKET from the server
    expect(screen.getByLabelText(/High-Ticket/)).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Continuar" })); // profile

    expect(screen.getByText("Tudo pronto para High-Ticket")).toBeTruthy();
    // presentational only: advancing from the confirmation performs no write
    mutations.selectTemplate.mutateAsync.mockClear();
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByText("Etapa 5 de 7")).toBeTruthy();
    expect(mutations.selectTemplate.mutateAsync).not.toHaveBeenCalled();
  });

  it("step 5 (Meta) is honestly deferred: status card, no connection API", async () => {
    const user = userEvent.setup();
    renderOnboarding();
    await advanceTo(user, 5);

    expect(screen.getByText("Conexão Meta")).toBeTruthy();
    expect(screen.getByText("Em breve")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Continuar sem conectar" }));
    expect(screen.getByText("Etapa 6 de 7")).toBeTruthy();
  });

  it("step 6 (appearance): AURA is preselected, a choice persists via the onboarding endpoint", async () => {
    const user = userEvent.setup();
    renderOnboarding();
    await advanceTo(user, 6);

    // AURA (server default) is checked; CUSTOM is visible but deferred
    expect(screen.getByLabelText(/Aura/)).toBeChecked();
    expect(screen.getByLabelText(/Customizado/)).toBeDisabled();

    await user.click(screen.getByLabelText(/Flux/));
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    await waitFor(() => {
      expect(mutations.updateAppearance.mutateAsync).toHaveBeenCalledWith({
        preset: "FLUX",
        mode: "LIGHT",
      });
    });
    expect(screen.getByText("Etapa 7 de 7")).toBeTruthy();
  });

  it("step 7 (ready) summarizes the real chosen values and completes onboarding", async () => {
    const user = userEvent.setup();
    renderOnboarding();
    await advanceTo(user, 7);

    const summary = screen.getByText("Seu Looply está pronto para começar.").closest("form")!;
    expect(summary).toHaveTextContent("Studio Aurora");
    expect(summary).toHaveTextContent("Negócio Local");
    expect(summary).toHaveTextContent("Aura");

    await user.click(screen.getByRole("button", { name: "Entrar no Looply" }));
    await waitFor(() => {
      expect(mutations.complete.mutateAsync).toHaveBeenCalledTimes(1);
    });
  });

  it("shows a neutral message when the company save fails", async () => {
    const user = userEvent.setup();
    mutations.updateCompany.mutateAsync.mockRejectedValue(new TypeError("Failed to fetch"));
    renderOnboarding();
    await user.click(screen.getByRole("button", { name: "Começar configuração" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível conectar. Tente novamente.",
    );
    expect(screen.queryByLabelText("Escolha seu perfil")).toBeNull();
  });
});
