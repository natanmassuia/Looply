import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Login, { ProtectedRoute } from "../features/Login";
import { ApiError } from "../lib/api";
import { getPostLoginDestination } from "../lib/workspace";

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
      expect(assignSpy).toHaveBeenCalledWith(getPostLoginDestination(undefined));
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