import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { readFileSync } from "node:fs";
import Login, { ProtectedRoute } from "../features/Login";
import { ApiError } from "../lib/api";

const useLoginMock = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
}));
const useMeMock = vi.hoisted(() => ({
  isPending: false,
  isError: false,
}));

vi.mock("../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/api")>();
  return {
    ...actual,
    useLogin: () => useLoginMock,
    useMe: () => useMeMock,
  };
});

const assignSpy = vi.hoisted(() => vi.fn());
vi.stubGlobal("location", { assign: assignSpy });

describe("Login", () => {
  beforeEach(() => {
    useLoginMock.mutateAsync.mockReset();
    useLoginMock.isPending = false;
    assignSpy.mockReset();
  });

  it("renders accessible labeled fields with password-manager autocomplete", () => {
    render(<Login />);
    const email = screen.getByLabelText("E-mail");
    const password = screen.getByLabelText("Senha");
    expect(email).toHaveAttribute("type", "email");
    expect(email).toHaveAttribute("autocomplete", "email");
    expect(password).toHaveAttribute("type", "password");
    expect(password).toHaveAttribute("autocomplete", "current-password");
  });

  it("submits the email/password contract and routes to post-login destination", async () => {
    const user = userEvent.setup();
    // Partial session (no workspace yet): the onboarding gate is the destination.
    useLoginMock.mutateAsync.mockResolvedValue({ user: { email: "a@b.c" } });
    render(<Login />);
    await user.type(screen.getByLabelText("E-mail"), "admin@looply.app");
    await user.type(screen.getByLabelText("Senha"), "secret");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => {
      expect(useLoginMock.mutateAsync).toHaveBeenCalledWith({
        email: "admin@looply.app",
        password: "secret",
      });
      expect(assignSpy).toHaveBeenCalledWith("/onboarding");
    });
  });

  it("shows the server message on invalid credentials", async () => {
    const user = userEvent.setup();
    useLoginMock.mutateAsync.mockRejectedValue(
      new ApiError(401, "Credenciais inválidas", "unauthorized"),
    );
    render(<Login />);
    await user.type(screen.getByLabelText("E-mail"), "admin@looply.app");
    await user.type(screen.getByLabelText("Senha"), "wrong");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Credenciais inválidas");
    expect(assignSpy).not.toHaveBeenCalled();
  });

  it("shows a neutral message on network failure, never a raw error", async () => {
    const user = userEvent.setup();
    useLoginMock.mutateAsync.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<Login />);
    await user.type(screen.getByLabelText("E-mail"), "admin@looply.app");
    await user.type(screen.getByLabelText("Senha"), "secret");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível conectar. Tente novamente.",
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent("Failed to fetch");
  });

  it("disables the submit button while pending", async () => {
    useLoginMock.isPending = true;
    render(<Login />);
    const button = screen.getByRole("button", { name: "Entrando..." });
    expect(button).toBeDisabled();
  });

  it("offers no public signup or account creation (team-exclusive access only)", () => {
    render(<Login />);
    expect(screen.queryByText(/criar conta|cadastre|registrar|sign ?up/i)).toBeNull();
    expect(screen.getByText("Precisa de ajuda para entrar?")).toBeTruthy();
    expect(screen.getByText("Acesso seguro para sua equipe")).toBeTruthy();
    // Verbum Lab product signature footer is NOT rendered in Auth
    expect(screen.queryByText(/Looply — um produto Verbum Lab/i)).toBeNull();
    expect(screen.queryByText(/O Looply é um produto Verbum Lab/i)).toBeNull();
  });

  it("recovery entry point stays honest: explains the real path, never fakes a reset flow", async () => {
    const user = userEvent.setup();
    render(<Login />);
    await user.click(screen.getByRole("button", { name: "Esqueci minha senha" }));
    const note = await screen.findByRole("status");
    expect(note).toHaveTextContent(/ainda não está disponível/i);
    expect(note).toHaveTextContent(/quem administra o Looply na sua empresa/i);
    // no navigation away from the login screen
    expect(assignSpy).not.toHaveBeenCalled();
  });
});

// ── AuthShell visual contract (Final Figma 05.1) ──────────────────────────
describe("AuthShell — Final Figma Visual Contract", () => {
  beforeEach(() => {
    useLoginMock.mutateAsync.mockReset();
    useLoginMock.isPending = false;
  });

  it("renders final desktop Product Story copy with semantic inverse roles", () => {
    render(<Login />);
    expect(screen.getByText("Seu trabalho continua sem perder o contexto.").className).toContain(
      "text-inverse",
    );
    expect(
      screen.getByText("Clientes, jobs, agenda e aprovações conectados no mesmo fluxo.").className,
    ).toContain("text-inverse-secondary");
    expect(screen.queryByText(/Looply — um produto Verbum Lab/i)).toBeNull();
  });

  it("desktop product preview defaults to Visão geral with canonical metrics and attention cards", () => {
    render(<Login />);
    const previewNav = screen.getByRole("navigation", { name: "Demonstração do produto" });
    const overviewBtn = within(previewNav).getByRole("button", { name: "Visão geral" });
    expect(overviewBtn).toHaveAttribute("aria-pressed", "true");

    expect(screen.getByText("O que precisa da sua atenção hoje.")).toBeTruthy();
    expect(screen.getByText("18")).toBeTruthy();
    expect(screen.getByText("Jobs ativos")).toBeTruthy();
    expect(screen.getByText("4")).toBeTruthy();
    expect(screen.getByText("Em aprovação")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("Vencem hoje")).toBeTruthy();
    expect(screen.getByText("Campanha de lançamento · Aurora")).toBeTruthy();
    expect(screen.getByText("Entrega final · revisão pendente")).toBeTruthy();
    expect(screen.getByText("14:00 · Revisão · Aurora")).toBeTruthy();
    expect(screen.getByText("HOJE")).toBeTruthy();
  });

  it("switches to Clientes view with canonical client rows and footer", async () => {
    const user = userEvent.setup();
    render(<Login />);
    const previewNav = screen.getByRole("navigation", { name: "Demonstração do produto" });
    await user.click(within(previewNav).getByRole("button", { name: "Clientes" }));

    expect(screen.getByText("Quem precisa de atenção agora.")).toBeTruthy();
    expect(screen.getByText("Aurora Clínica")).toBeTruthy();
    expect(screen.getByText("Ana Martins · 3 jobs")).toBeTruthy();
    expect(screen.getByText("Mova Studio")).toBeTruthy();
    expect(screen.getByText("Lucas Costa · 2 jobs")).toBeTruthy();
    expect(screen.getByText("Nexo Educação")).toBeTruthy();
    expect(screen.getByText("Natan Massuia · 1 job")).toBeTruthy();
    expect(screen.getByText("12 clientes ativos · 3 precisam de atenção")).toBeTruthy();
    expect(assignSpy).not.toHaveBeenCalled();
  });

  it("switches to Jobs view with canonical jobs and status OPERAÇÃO EM DIA", async () => {
    const user = userEvent.setup();
    render(<Login />);
    const previewNav = screen.getByRole("navigation", { name: "Demonstração do produto" });
    await user.click(within(previewNav).getByRole("button", { name: "Jobs" }));

    expect(screen.getByText("Hoje, sem perder o contexto.")).toBeTruthy();
    expect(screen.getByText("Peças de agosto")).toBeTruthy();
    expect(screen.getByText("Mova Studio · Lucas")).toBeTruthy();
    expect(screen.getByText("Landing institucional")).toBeTruthy();
    expect(screen.getByText("Kit de anúncios")).toBeTruthy();
    expect(screen.getByText("12 clientes · 8 jobs ativos · 3 aprovações")).toBeTruthy();
    expect(screen.getByText("OPERAÇÃO EM DIA")).toBeTruthy();
    expect(assignSpy).not.toHaveBeenCalled();
  });

  it("switches to Agenda view with canonical appointments and timing footer", async () => {
    const user = userEvent.setup();
    render(<Login />);
    const previewNav = screen.getByRole("navigation", { name: "Demonstração do produto" });
    await user.click(within(previewNav).getByRole("button", { name: "Agenda" }));

    expect(screen.getByText("Compromissos ligados ao trabalho.")).toBeTruthy();
    expect(screen.getByText("Kickoff · Nexo")).toBeTruthy();
    expect(screen.getByText("Revisão · Aurora")).toBeTruthy();
    expect(screen.getByText("Planejamento interno")).toBeTruthy();
    expect(screen.getByText("Próximo compromisso em 1 h 20 min")).toBeTruthy();
    expect(assignSpy).not.toHaveBeenCalled();
  });

  it("renders desktop floating signals and mobile compact story card", () => {
    render(<Login />);
    // Floating signals
    expect(screen.getByText("Kit de anúncios aprovado")).toBeTruthy();
    expect(screen.getByText("14:30")).toBeTruthy();
    expect(screen.getByText("Reunião · Mova Studio")).toBeTruthy();

    // Mobile compact story card
    expect(screen.getByText("Trabalho em contexto.")).toBeTruthy();
    expect(screen.getByText("Acesso seguro para sua equipe")).toBeTruthy();
  });

  it("obsolete benefit marquee and static benefit chips are absent", () => {
    render(<Login />);
    const css = readFileSync(`${process.cwd()}/src/index.css`, "utf8");
    expect(css).not.toContain("@keyframes looply-marquee");
    expect(css).not.toContain(".marquee-track");
    expect(screen.queryByText("Aprovação pública")).toBeNull();
    expect(screen.queryByText("Agenda + WhatsApp")).toBeNull();
  });
});

describe("ProtectedRoute", () => {
  beforeEach(() => {
    useMeMock.isPending = false;
    useMeMock.isError = false;
  });

  it("renders a loading state while the session query is pending", () => {
    useMeMock.isPending = true;
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <ProtectedRoute>child</ProtectedRoute>
      </MemoryRouter>,
    );
    expect(screen.getByText("Carregando...")).toBeTruthy();
  });

  it("redirects to /login when the session query fails", () => {
    useMeMock.isError = true;
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route path="/login" element={<div>login page</div>} />
          <Route path="/dashboard" element={<ProtectedRoute>child</ProtectedRoute>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("login page")).toBeTruthy();
  });

  it("renders children when the session is valid", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <ProtectedRoute>child</ProtectedRoute>
      </MemoryRouter>,
    );
    expect(screen.getByText("child")).toBeTruthy();
  });
});