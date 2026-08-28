import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Team from "../features/Team";
import * as apiModule from "../lib/api";
import type { CompanyMember, Invitation } from "../lib/types";

const mockSessionOwner: apiModule.SessionInfo = {
  user: { id: "u-owner", name: "Ana Proprietária", email: "ana@agencia.com" },
  activeCompanyId: "c-1",
  mustChangePassword: false,
  memberships: [{ companyId: "c-1", companyName: "Agência Looply", role: "OWNER" }],
  workspace: {
    id: "c-1",
    name: "Agência Looply",
    template: "MARKETING_AGENCY",
    capabilities: ["CLIENTS", "JOBS", "DASHBOARD"],
    status: "ACTIVE",
    appearance: { preset: "AURA", mode: "LIGHT", customColors: null },
  },
};

const mockSessionMember: apiModule.SessionInfo = {
  user: { id: "u-member", name: "Carlos Membro", email: "carlos@agencia.com" },
  activeCompanyId: "c-1",
  mustChangePassword: false,
  memberships: [{ companyId: "c-1", companyName: "Agência Looply", role: "MEMBER" }],
  workspace: {
    id: "c-1",
    name: "Agência Looply",
    template: "MARKETING_AGENCY",
    capabilities: ["CLIENTS", "JOBS", "DASHBOARD"],
    status: "ACTIVE",
    appearance: { preset: "AURA", mode: "LIGHT", customColors: null },
  },
};

const mockMembers: CompanyMember[] = [
  {
    id: "cm-1",
    role: "OWNER",
    isActive: true,
    createdAt: new Date().toISOString(),
    user: { id: "u-owner", name: "Ana Proprietária", email: "ana@agencia.com", active: true },
  },
  {
    id: "cm-2",
    role: "MEMBER",
    isActive: true,
    createdAt: new Date().toISOString(),
    user: { id: "u-carlos", name: "Carlos Designer", email: "carlos@agencia.com", active: true },
  },
];

const mockInvitations: Invitation[] = [
  {
    id: "inv-1",
    email: "pedro@agencia.com",
    role: "MEMBER",
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    acceptedAt: null,
    revokedAt: null,
    createdAt: new Date().toISOString(),
  },
];

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("Team Feature — B2 Functional Wiring", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders team members from API and displays role and status", async () => {
    vi.spyOn(apiModule, "useMe").mockReturnValue({
      data: mockSessionOwner,
      isLoading: false,
    } as any);

    vi.spyOn(apiModule, "useMembers").mockReturnValue({
      data: mockMembers,
      isLoading: false,
      isError: false,
    } as any);

    vi.spyOn(apiModule, "useInvitations").mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    renderWithClient(<Team />);

    expect(screen.getByText("Equipe")).toBeInTheDocument();
    expect(screen.getByText("Ana Proprietária")).toBeInTheDocument();
    expect(screen.getByText("Carlos Designer")).toBeInTheDocument();
  });

  it("renders pending invitations and allows revoking", async () => {
    vi.spyOn(apiModule, "useMe").mockReturnValue({
      data: mockSessionOwner,
      isLoading: false,
    } as any);

    vi.spyOn(apiModule, "useMembers").mockReturnValue({
      data: mockMembers,
      isLoading: false,
    } as any);

    vi.spyOn(apiModule, "useInvitations").mockReturnValue({
      data: mockInvitations,
      isLoading: false,
    } as any);

    const revokeMutate = vi.fn().mockResolvedValue({ ok: true });
    vi.spyOn(apiModule, "useRevokeInvitation").mockReturnValue({
      mutateAsync: revokeMutate,
      isPending: false,
    } as any);

    renderWithClient(<Team />);

    expect(screen.getByText("Convites pendentes (1)")).toBeInTheDocument();
    expect(screen.getByText("pedro@agencia.com")).toBeInTheDocument();

    const revokeBtn = screen.getByRole("button", { name: "Revogar convite" });
    fireEvent.click(revokeBtn);

    expect(revokeMutate).toHaveBeenCalledWith("inv-1");
  });

  it("submits invitation to POST /api/invitations with correct payload and disables pending button", async () => {
    vi.spyOn(apiModule, "useMe").mockReturnValue({
      data: mockSessionOwner,
      isLoading: false,
    } as any);

    vi.spyOn(apiModule, "useMembers").mockReturnValue({
      data: mockMembers,
      isLoading: false,
    } as any);

    vi.spyOn(apiModule, "useInvitations").mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    const createInviteMutate = vi.fn().mockResolvedValue({
      invitationId: "inv-new",
      expiresAt: new Date().toISOString(),
      token: "tok-123",
    });

    vi.spyOn(apiModule, "useCreateInvitation").mockReturnValue({
      mutateAsync: createInviteMutate,
      isPending: false,
    } as any);

    renderWithClient(<Team />);

    // Open invite form
    const openBtn = screen.getByRole("button", { name: /Convidar membro/i });
    fireEvent.click(openBtn);

    // Form inputs
    const emailInput = screen.getByPlaceholderText("marina@agencia.com");
    fireEvent.change(emailInput, { target: { value: "juliana@agencia.com" } });

    const submitBtns = screen.getAllByRole("button", { name: "Convidar membro" });
    fireEvent.click(submitBtns[submitBtns.length - 1]);

    expect(createInviteMutate).toHaveBeenCalledWith({
      email: "juliana@agencia.com",
      role: "MEMBER",
    });
  });

  it("surfaces conflict error cleanly when user is already invited or member", async () => {
    vi.spyOn(apiModule, "useMe").mockReturnValue({
      data: mockSessionOwner,
      isLoading: false,
    } as any);

    vi.spyOn(apiModule, "useMembers").mockReturnValue({
      data: mockMembers,
      isLoading: false,
    } as any);

    vi.spyOn(apiModule, "useInvitations").mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    vi.spyOn(apiModule, "useCreateInvitation").mockReturnValue({
      mutateAsync: vi.fn().mockRejectedValue(new apiModule.ApiError(409, "Convite pendente já existe para este e-mail")),
      isPending: false,
    } as any);

    renderWithClient(<Team />);

    fireEvent.click(screen.getByRole("button", { name: /Convidar membro/i }));
    fireEvent.change(screen.getByPlaceholderText("marina@agencia.com"), { target: { value: "pedro@agencia.com" } });
    const submitBtns = screen.getAllByRole("button", { name: "Convidar membro" });
    fireEvent.click(submitBtns[submitBtns.length - 1]);

    await waitFor(() => {
      expect(screen.getByText("Convite pendente já existe para este e-mail")).toBeInTheDocument();
    });
  });

  it("allows OWNER to update member role via select dropdown", async () => {
    vi.spyOn(apiModule, "useMe").mockReturnValue({
      data: mockSessionOwner,
      isLoading: false,
    } as any);

    vi.spyOn(apiModule, "useMembers").mockReturnValue({
      data: mockMembers,
      isLoading: false,
    } as any);

    vi.spyOn(apiModule, "useInvitations").mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    const updateMemberMutate = vi.fn().mockResolvedValue({
      id: "cm-2",
      role: "ADMIN",
      isActive: true,
    });

    vi.spyOn(apiModule, "useUpdateMember").mockReturnValue({
      mutateAsync: updateMemberMutate,
      isPending: false,
    } as any);

    renderWithClient(<Team />);

    const roleSelect = screen.getByLabelText("Função de Carlos Designer");
    expect(roleSelect).toBeInTheDocument();

    fireEvent.change(roleSelect, { target: { value: "ADMIN" } });

    expect(updateMemberMutate).toHaveBeenCalledWith({
      id: "cm-2",
      body: { role: "ADMIN" },
    });
  });

  it("hides invite button and role select for non-admin/owner members", async () => {
    vi.spyOn(apiModule, "useMe").mockReturnValue({
      data: mockSessionMember,
      isLoading: false,
    } as any);

    vi.spyOn(apiModule, "useMembers").mockReturnValue({
      data: undefined,
      isLoading: false,
    } as any);

    vi.spyOn(apiModule, "useTeam").mockReturnValue({
      data: [
        { id: "u-owner", name: "Ana Proprietária", email: "ana@agencia.com", role: "ADMIN", active: true, createdAt: "" },
        { id: "u-carlos", name: "Carlos Designer", email: "carlos@agencia.com", role: "EDITOR", active: true, createdAt: "" },
      ],
      isLoading: false,
    } as any);

    vi.spyOn(apiModule, "useInvitations").mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    renderWithClient(<Team />);

    expect(screen.queryByRole("button", { name: /Convidar membro/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Função de Carlos Designer")).not.toBeInTheDocument();
  });

  // F14.1.1 — user avatar propagates to Team: a member with avatarUrl renders
  // a photo; a member without one keeps the initials fallback.
  it("renders avatar photo for members with avatarUrl and initials otherwise", () => {
    vi.spyOn(apiModule, "useMe").mockReturnValue({
      data: mockSessionOwner,
      isLoading: false,
    } as any);

    vi.spyOn(apiModule, "useMembers").mockReturnValue({
      data: [
        {
          id: "cm-1",
          role: "OWNER",
          isActive: true,
          createdAt: new Date().toISOString(),
          user: {
            id: "u-owner",
            name: "Ana Proprietária",
            email: "ana@agencia.com",
            avatarUrl: "/api/media/file?key=users%2Fu-owner%2Favatar%2F1.png",
            active: true,
          },
        },
        {
          id: "cm-2",
          role: "MEMBER",
          isActive: true,
          createdAt: new Date().toISOString(),
          user: { id: "u-carlos", name: "Carlos Designer", email: "carlos@agencia.com", active: true },
        },
      ],
      isLoading: false,
      isError: false,
    } as any);

    vi.spyOn(apiModule, "useInvitations").mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    renderWithClient(<Team />);

    // Owner has avatar → <img>
    const ownerAvatar = screen.getByAltText("");
    expect(ownerAvatar.tagName).toBe("IMG");
    expect(ownerAvatar).toHaveAttribute(
      "src",
      "/api/media/file?key=users%2Fu-owner%2Favatar%2F1.png",
    );
    // Carlos has no avatar → initials fallback text
    expect(screen.getByText("CD")).toBeInTheDocument();
  });

  // F14.3 — Team filters.
  it("status + role filters narrow the member list", () => {
    vi.spyOn(apiModule, "useMe").mockReturnValue({
      data: mockSessionOwner,
      isLoading: false,
    } as any);

    vi.spyOn(apiModule, "useMembers").mockReturnValue({
      data: [
        { id: "cm-1", role: "OWNER", isActive: true, createdAt: new Date().toISOString(), user: { id: "u1", name: "Ana", email: "ana@x.com", active: true } },
        { id: "cm-2", role: "MEMBER", isActive: false, createdAt: new Date().toISOString(), user: { id: "u2", name: "Bruno", email: "bruno@x.com", active: true } },
        { id: "cm-3", role: "MEMBER", isActive: true, createdAt: new Date().toISOString(), user: { id: "u3", name: "Carla", email: "carla@x.com", active: true } },
      ],
      isLoading: false,
      isError: false,
    } as any);

    vi.spyOn(apiModule, "useInvitations").mockReturnValue({ data: [], isLoading: false } as any);

    renderWithClient(<Team />);

    // Filter: only active members.
    fireEvent.click(screen.getByRole("button", { name: "Ativos" }));
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.getByText("Carla")).toBeInTheDocument();
    expect(screen.queryByText("Bruno")).not.toBeInTheDocument();

    // Filter role = OWNER narrows further.
    fireEvent.change(screen.getByLabelText("Filtrar por função"), { target: { value: "OWNER" } });
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.queryByText("Carla")).not.toBeInTheDocument();
  });

  it("team search composes with filters", () => {
    vi.spyOn(apiModule, "useMe").mockReturnValue({
      data: mockSessionOwner,
      isLoading: false,
    } as any);
    vi.spyOn(apiModule, "useMembers").mockReturnValue({
      data: [
        { id: "cm-1", role: "OWNER", isActive: true, createdAt: new Date().toISOString(), user: { id: "u1", name: "Ana Proprietária", email: "ana@x.com", active: true } },
        { id: "cm-2", role: "MEMBER", isActive: true, createdAt: new Date().toISOString(), user: { id: "u2", name: "Carlos Designer", email: "carlos@x.com", active: true } },
      ],
      isLoading: false,
      isError: false,
    } as any);
    vi.spyOn(apiModule, "useInvitations").mockReturnValue({ data: [], isLoading: false } as any);

    renderWithClient(<Team />);

    fireEvent.change(screen.getByLabelText("Buscar membro"), { target: { value: "carlos" } });
    expect(screen.getByText("Carlos Designer")).toBeInTheDocument();
    expect(screen.queryByText("Ana Proprietária")).not.toBeInTheDocument();
  });

  it("A5: fails closed when session or role is undefined (no admin controls rendered)", () => {
    vi.spyOn(apiModule, "useMe").mockReturnValue({
      data: {
        user: { id: "u-anon", name: "Sem Role", email: "anon@agencia.com" },
        activeCompanyId: "c-1",
        mustChangePassword: false,
        memberships: [], // No membership / undefined role
      },
      isLoading: false,
    } as any);

    vi.spyOn(apiModule, "useMembers").mockReturnValue({
      data: mockMembers,
      isLoading: false,
      isError: false,
    } as any);

    vi.spyOn(apiModule, "useInvitations").mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    renderWithClient(<Team />);

    // Admin action buttons should NOT be rendered when role is missing/undefined
    expect(screen.queryByRole("button", { name: /Convidar membro/i })).not.toBeInTheDocument();
  });
});
