import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Recovery from "../features/Recovery";
import ResetPassword from "../features/ResetPassword";

const useRequestPasswordRecoveryMock = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
}));

const useResetPasswordMock = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
}));

vi.mock("../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/api")>();
  return {
    ...actual,
    useRequestPasswordRecovery: () => useRequestPasswordRecoveryMock,
    useResetPassword: () => useResetPasswordMock,
  };
});

describe("Recovery Feature", () => {
  beforeEach(() => {
    useRequestPasswordRecoveryMock.mutateAsync.mockReset();
    useRequestPasswordRecoveryMock.isPending = false;
  });

  it("renders recovery title and fields per Figma contract", () => {
    render(
      <MemoryRouter>
        <Recovery />
      </MemoryRouter>,
    );

    expect(screen.getByText("RECUPERAÇÃO DE SENHA")).toBeTruthy();
    expect(screen.getByText("Recupere seu acesso.")).toBeTruthy();
    expect(screen.getByLabelText("E-mail")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Enviar link de recuperação" })).toBeTruthy();
  });

  it("submits email and displays neutral success message", async () => {
    const user = userEvent.setup();
    useRequestPasswordRecoveryMock.mutateAsync.mockResolvedValue({
      ok: true,
      message: "Se o e-mail estiver cadastrado, você receberá as instruções em poucos minutos.",
    });

    render(
      <MemoryRouter>
        <Recovery />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText("E-mail"), "user@empresa.com");
    await user.click(screen.getByRole("button", { name: "Enviar link de recuperação" }));

    await waitFor(() => {
      expect(useRequestPasswordRecoveryMock.mutateAsync).toHaveBeenCalledWith({
        email: "user@empresa.com",
      });
      expect(screen.getByText("E-mail enviado")).toBeTruthy();
      expect(screen.getByText(/Se o e-mail/)).toBeTruthy();
    });
  });
});

describe("ResetPassword Feature", () => {
  beforeEach(() => {
    useResetPasswordMock.mutateAsync.mockReset();
    useResetPasswordMock.isPending = false;
  });

  it("shows invalid link state if token is missing in URL", () => {
    render(
      <MemoryRouter initialEntries={["/reset-password"]}>
        <Routes>
          <Route path="/reset-password" element={<ResetPassword />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Link inválido.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Solicitar novo link" })).toBeTruthy();
  });

  it("submits new password with token and displays success state", async () => {
    const user = userEvent.setup();
    useResetPasswordMock.mutateAsync.mockResolvedValue({
      ok: true,
      message: "Senha redefinida com sucesso.",
    });

    render(
      <MemoryRouter initialEntries={["/reset-password?token=valid-test-token"]}>
        <Routes>
          <Route path="/reset-password" element={<ResetPassword />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Defina uma nova senha.")).toBeTruthy();
    await user.type(screen.getByLabelText("Nova senha"), "NewSecurePass123!");
    await user.type(screen.getByLabelText("Confirmar nova senha"), "NewSecurePass123!");
    await user.click(screen.getByRole("button", { name: "Redefinir senha" }));

    await waitFor(() => {
      expect(useResetPasswordMock.mutateAsync).toHaveBeenCalledWith({
        token: "valid-test-token",
        password: "NewSecurePass123!",
      });
      expect(screen.getByText("Senha atualizada")).toBeTruthy();
    });
  });
});
