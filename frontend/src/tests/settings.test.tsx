import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import Settings, { WhatsAppIntegrationCard } from "../features/Settings";
import MyAccountModal from "../features/MyAccountModal";
import * as apiModule from "../lib/api";
import type { WorkspaceAppearance } from "../lib/types";
import { MVP } from "../config/mvp";

const mockSession = {
  user: {
    id: "user-1",
    name: "Natan Massuia",
    email: "natan@looply.com",
    phone: "+55 11 99999-1111",
    avatarUrl: "https://example.com/avatar.jpg",
    role: "ADMIN" as const,
    active: true,
    createdAt: new Date().toISOString(),
  },
  activeCompanyId: "comp-1",
  memberships: [
    {
      companyId: "comp-1",
      companyName: "Looply Agência",
      role: "ADMIN" as const,
    },
  ],
  workspace: {
    id: "comp-1",
    name: "Looply Agência",
    logoUrl: "https://example.com/logo.png",
    template: "MARKETING_AGENCY" as const,
    capabilities: ["CLIENTS" as const, "JOBS" as const],
    status: "ACTIVE" as const,
  },
};

const mockCompanySettings = {
  id: "comp-1",
  name: "Looply Agência",
  slug: "looply-agencia",
  logoUrl: "https://example.com/logo.png",
  timezone: "America/Sao_Paulo",
  locale: "pt-BR",
  legalName: "Looply LTDA",
  document: "00.000.000/0001-00",
  email: "contato@looply.com",
  phone: "+55 11 3000-0000",
  website: "https://looply.com",
  businessContext: null,
  businessHoursStart: null,
  businessHoursEnd: null,
  businessDays: [],
  onboardedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

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

describe("Settings Feature — F12.2 Profile and Company Data", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(apiModule, "useMe").mockReturnValue({
      data: mockSession,
      isLoading: false,
    } as any);
    vi.spyOn(apiModule, "useCompanySettings").mockReturnValue({
      data: mockCompanySettings,
      isLoading: false,
    } as any);
    // Identity media hooks — no-op mocks (upload handled independently)
    const noopMutation = { mutateAsync: vi.fn(), isPending: false } as any;
    vi.spyOn(apiModule, "useUploadUserAvatar").mockReturnValue(noopMutation);
    vi.spyOn(apiModule, "useDeleteUserAvatar").mockReturnValue(noopMutation);
    vi.spyOn(apiModule, "useUploadCompanyLogo").mockReturnValue(noopMutation);
    vi.spyOn(apiModule, "useDeleteCompanyLogo").mockReturnValue(noopMutation);
  });

  it("renders 'Minha conta' tab with user profile data and personal phone", () => {
    renderWithClient(<Settings />);

    expect(screen.getByText("Minha conta")).toBeInTheDocument();
    expect(screen.getAllByText("Natan Massuia").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("natan@looply.com").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("+55 11 99999-1111")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar perfil" })).toBeInTheDocument();
  });

  it("opens MyAccountModal and allows editing profile name and personal phone", async () => {
    const updateProfileMutate = vi.fn().mockResolvedValue({
      user: {
        id: "user-1",
        name: "Natan M. Updated",
        email: "natan@looply.com",
        phone: "+55 11 98888-2222",
      },
    });

    vi.spyOn(apiModule, "useUpdateProfile").mockReturnValue({
      mutateAsync: updateProfileMutate,
      isPending: false,
    } as any);

    renderWithClient(<MyAccountModal isOpen={true} onClose={vi.fn()} />);

    // Click Editar button on modal
    const editBtn = screen.getByRole("button", { name: "Editar" });
    fireEvent.click(editBtn);

    const nameInput = screen.getByLabelText("Nome completo");
    fireEvent.change(nameInput, { target: { value: "Natan M. Updated" } });

    const phoneInput = screen.getByLabelText("Telefone pessoal");
    fireEvent.change(phoneInput, { target: { value: "16994050998" } });

    const saveBtn = screen.getByRole("button", { name: "Salvar Perfil" });
    fireEvent.click(saveBtn);

    expect(updateProfileMutate).toHaveBeenCalledWith({
      name: "Natan M. Updated",
      email: "natan@looply.com",
      phone: "16994050998",
    });
  });

  it("renders Empresa tab with institutional business phone and logoUrl", async () => {
    const updateCompanyMutate = vi.fn().mockResolvedValue({
      company: { ...mockCompanySettings, phone: "+55 11 3555-5555" },
    });

    vi.spyOn(apiModule, "useUpdateCompanySettings").mockReturnValue({
      mutateAsync: updateCompanyMutate,
      isPending: false,
    } as any);

    renderWithClient(<Settings />);

    // Switch to Empresa tab
    const empresaTab = screen.getByRole("button", { name: "Empresa" });
    fireEvent.click(empresaTab);

    expect(screen.getByLabelText("Telefone empresarial")).toBeInTheDocument();
    expect(screen.getByText("Usado nos dados institucionais e documentos da empresa.")).toBeInTheDocument();

    const phoneInput = screen.getByLabelText("Telefone empresarial");
    fireEvent.change(phoneInput, { target: { value: "1633224455" } });

    const saveBtn = screen.getByRole("button", { name: "Salvar dados da empresa" });
    fireEvent.click(saveBtn);

    // PhoneInput normalizes to raw digits for the canonical API value.
    expect(updateCompanyMutate).toHaveBeenCalledWith({
      name: "Looply Agência",
      timezone: "America/Sao_Paulo",
      phone: "1633224455",
      businessContext: null,
      businessHoursStart: null,
      businessHoursEnd: null,
      businessDays: [],
    });
  });

  it("hides the Aparência tab when MVP.hideAppearanceTab is true", () => {
    renderWithClient(<Settings />);
    expect(screen.queryByRole("button", { name: "Aparência" })).toBeNull();
  });

  describe("Appearance settings (when enabled)", () => {
    let prevHideAppearance: boolean;

    beforeEach(() => {
      prevHideAppearance = MVP.hideAppearanceTab;
      MVP.hideAppearanceTab = false;
    });

    afterEach(() => {
      MVP.hideAppearanceTab = prevHideAppearance;
    });

    // F14 — appearance save sends ALL three of preset/mode/colors ONLY when the
    // preset is CUSTOM; a non-CUSTOM preset omits customColors so the strict
    // backend validator does not reject the request with "Erro de validação".
    it("appearance save: non-CUSTOM preset omits customColors (avoids 400)", async () => {
      const updateAppearanceMutate = vi.fn().mockResolvedValue({
        appearance: { preset: "FLUX", mode: "LIGHT", customColors: null },
      });
      vi.spyOn(apiModule, "useUpdateSettingsAppearance").mockReturnValue({
        mutateAsync: updateAppearanceMutate,
        isPending: false,
      } as any);

      renderWithClient(<Settings />);
      fireEvent.click(screen.getByRole("button", { name: "Aparência" }));
      // \b avoids matching the "Fluxo de trabalho" tab; targets the "Flux" preset.
      fireEvent.click(screen.getByRole("button", { name: /Flux\b/ }));
      fireEvent.click(screen.getByRole("button", { name: "Salvar aparência" }));

      expect(updateAppearanceMutate).toHaveBeenCalledWith({
        preset: "FLUX",
        mode: "LIGHT",
      });
      const body = updateAppearanceMutate.mock.calls[0][0];
      expect(body).not.toHaveProperty("customColors");
    });

    it("appearance save: CUSTOM preset includes the six-color payload", async () => {
      const updateAppearanceMutate = vi.fn().mockResolvedValue({
        appearance: {
          preset: "CUSTOM",
          mode: "LIGHT",
          customColors: {
            primary: "#111111",
            secondary: "#222222",
            accent: "#333333",
            surface: "#444444",
            text: "#555555",
            border: "#666666",
          },
        },
      });
      vi.spyOn(apiModule, "useUpdateSettingsAppearance").mockReturnValue({
        mutateAsync: updateAppearanceMutate,
        isPending: false,
      } as any);

      renderWithClient(<Settings />);
      fireEvent.click(screen.getByRole("button", { name: "Aparência" }));
      fireEvent.click(screen.getByRole("button", { name: /Customizado/ }));
      fireEvent.click(screen.getByRole("button", { name: "Salvar aparência" }));

      const body = updateAppearanceMutate.mock.calls[0][0];
      expect(body.preset).toBe("CUSTOM");
      expect(body.customColors).toBeTruthy();
      expect(Object.keys(body.customColors).sort()).toEqual(
        ["accent", "border", "primary", "secondary", "surface", "text"].sort(),
      );
    });

    // F14.8 — Customizado functional completeness: editor, validation, restore,
    // and cancel with an already-persisted custom palette.
    describe("Customizado editor (F14.8)", () => {
    function renderWithCustomAppearance(customColors?: WorkspaceAppearance["customColors"]) {
      vi.spyOn(apiModule, "useMe").mockReturnValue({
        data: {
          ...mockSession,
          workspace: {
            ...mockSession.workspace,
            appearance: {
              preset: "CUSTOM" as const,
              mode: "LIGHT" as const,
              customColors: customColors ?? {
                primary: "#B94738",
                secondary: "#F3B84B",
                accent: "#FFE3D7",
                surface: "#FFFFFF",
                text: "#2A171F",
                border: "#E8D8D1",
              },
            },
          },
        },
        isLoading: false,
      } as any);
      vi.spyOn(apiModule, "useUpdateSettingsAppearance").mockReturnValue({
        mutateAsync: vi.fn().mockResolvedValue({}),
        isPending: false,
      } as any);
      renderWithClient(<Settings />);
      fireEvent.click(screen.getByRole("button", { name: "Aparência" }));
      fireEvent.click(screen.getByRole("button", { name: /Customizado/ }));
    }

    it("selecting Customizado opens the six-field editor", () => {
      renderWithCustomAppearance();
      expect(screen.getByText("Cores Personalizadas")).toBeInTheDocument();
      expect(screen.getByLabelText(/Cor primária \(ações e botões\) — hexadecimal/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Texto principal — hexadecimal/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Restaurar" })).toBeInTheDocument();
    });

    it("valid hex on blur is normalized and updates the preview state", () => {
      renderWithCustomAppearance();
      const input = screen.getByLabelText(/Cor primária \(ações e botões\) — hexadecimal/);
      fireEvent.change(input, { target: { value: "#f06d55" } });
      fireEvent.blur(input);
      expect((input as HTMLInputElement).value).toBe("#F06D55");
    });

    it("invalid hex is rejected safely and the applied theme is not corrupted", () => {
      renderWithCustomAppearance();
      const input = screen.getByLabelText(/Cor primária \(ações e botões\) — hexadecimal/);
      fireEvent.change(input, { target: { value: "zzzz" } });
      fireEvent.blur(input);
      expect(screen.getByText(/Código hexadecimal inválido/)).toBeInTheDocument();
    });

    it("Restaurar resets the custom fields to the canonical baseline", () => {
      renderWithCustomAppearance({
        primary: "#111111",
        secondary: "#222222",
        accent: "#333333",
        surface: "#444444",
        text: "#555555",
        border: "#666666",
      });
      fireEvent.click(screen.getByRole("button", { name: "Restaurar" }));
      const input = screen.getByLabelText(/Cor primária \(ações e botões\) — hexadecimal/);
      expect((input as HTMLInputElement).value).toBe("#F06D55");
    });

    it("Cancelar restores the last persisted appearance values", () => {
      renderWithCustomAppearance({
        primary: "#111111",
        secondary: "#222222",
        accent: "#333333",
        surface: "#444444",
        text: "#555555",
        border: "#666666",
      });
      fireEvent.change(screen.getByLabelText(/Cor primária \(ações e botões\) — hexadecimal/), {
        target: { value: "#AAAAAA" },
      });
      fireEvent.blur(screen.getByLabelText(/Cor primária \(ações e botões\) — hexadecimal/));
      fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
      const input = screen.getByLabelText(/Cor primária \(ações e botões\) — hexadecimal/);
      expect((input as HTMLInputElement).value).toBe("#111111");
    });
  });
});
});

describe("Settings — WhatsApp integration status (real, shared source)", () => {
  beforeEach(() => vi.restoreAllMocks());

  function renderCard() {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    return render(
      <QueryClientProvider client={qc}>
        <WhatsAppIntegrationCard />
      </QueryClientProvider>,
    );
  }

  it("shows Conectado with the number when the company has an active WhatsApp number", () => {
    vi.spyOn(apiModule, "useWhatsAppPhoneNumbers").mockReturnValue({
      data: { phoneNumbers: [{ id: "p1", display_phone_number: "+55 11 99999-8888", verified_name: "Clínica Aurora", quality_rating: "GREEN", status: "CONNECTED" }] },
      isLoading: false,
      isError: false,
    } as any);

    renderCard();

    expect(screen.getByText("Conectado")).toBeInTheDocument();
    expect(screen.getByText("+55 11 99999-8888")).toBeInTheDocument();
    expect(screen.queryByText("Não conectado")).not.toBeInTheDocument();
  });

  it("shows Não conectado when the company has no WhatsApp number", () => {
    vi.spyOn(apiModule, "useWhatsAppPhoneNumbers").mockReturnValue({
      data: { phoneNumbers: [] },
      isLoading: false,
      isError: false,
    } as any);

    renderCard();

    expect(screen.getByText("Não conectado")).toBeInTheDocument();
    expect(screen.queryByText("Conectado")).not.toBeInTheDocument();
  });

  it("shows Indisponível only on a real API error", () => {
    vi.spyOn(apiModule, "useWhatsAppPhoneNumbers").mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as any);

    renderCard();

    expect(screen.getByText("Indisponível")).toBeInTheDocument();
  });
});
