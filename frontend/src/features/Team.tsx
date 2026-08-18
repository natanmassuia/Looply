import { useMemo, useState } from "react";
import {
  useMe,
  useMembers,
  useTeam,
  useInvitations,
  useCreateInvitation,
  useRevokeInvitation,
  useUpdateMember,
  useResetMemberPassword,
  ApiError,
} from "../lib/api";
import type { MemberRole, UserRole } from "../lib/types";
import { MEMBER_ROLE_LABEL, ROLE_LABEL, formatDate } from "../lib/format";
import { Card, EmptyState, ErrorState, PageHeader, Spinner } from "../components/common";
import { IconPlus, IconCheck, IconEdit, IconX } from "../components/Icons";
import ModalOrSheet from "../components/ModalOrSheet";

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const MEMBER_ROLE_STYLE: Record<MemberRole, string> = {
  OWNER: "bg-purple-50 text-purple-700 ring-purple-200",
  ADMIN: "bg-brand-50 text-brand-700 ring-brand-200",
  MEMBER: "bg-slate-50 text-slate-700 ring-slate-200",
};

const MEMBER_AVATAR_COLORS: Record<MemberRole, string> = {
  OWNER: "bg-purple-600",
  ADMIN: "bg-brand-600",
  MEMBER: "bg-slate-600",
};

const ROLE_STYLE: Record<UserRole, string> = {
  ADMIN: "bg-brand-50 text-brand-700 ring-brand-200",
  CONTENT_MANAGER: "bg-violet-50 text-violet-700 ring-violet-200",
  EDITOR: "bg-amber-50 text-amber-700 ring-amber-200",
  SOCIAL_MEDIA: "bg-blue-50 text-blue-700 ring-blue-200",
  DESIGNER: "bg-rose-50 text-rose-700 ring-rose-200",
};

const AVATAR_COLORS: Record<UserRole, string> = {
  ADMIN: "bg-brand-600",
  CONTENT_MANAGER: "bg-violet-600",
  EDITOR: "bg-amber-600",
  SOCIAL_MEDIA: "bg-blue-600",
  DESIGNER: "bg-rose-600",
};

export default function Team() {
  const { data: session } = useMe();
  const activeMembership = session?.memberships?.find(
    (m) => m.companyId === session.activeCompanyId,
  );
  const currentRole = activeMembership?.role;
  const isOwner = currentRole === "OWNER" || !currentRole;
  const isAdminOrOwner = currentRole === "OWNER" || currentRole === "ADMIN" || !currentRole;

  const { data: members, isLoading: membersLoading, isError: membersIsError, error: membersError } = useMembers(isAdminOrOwner);
  const { data: team, isLoading: teamLoading, isError: teamIsError, error: teamError } = useTeam();
  const { data: invitations } = useInvitations(isAdminOrOwner);

  const createInvitation = useCreateInvitation();
  const revokeInvitation = useRevokeInvitation();
  const updateMember = useUpdateMember();
  const resetMemberPassword = useResetMemberPassword();

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editingMember, setEditingMember] = useState<{
    id: string;
    name: string;
    email: string;
    role: MemberRole;
    isActive: boolean;
  } | null>(null);

  const [resetModalData, setResetModalData] = useState<{
    memberName: string;
    memberEmail: string;
    tempPass: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [inviteForm, setInviteForm] = useState<{ email: string; role: "ADMIN" | "MEMBER" }>({
    email: "",
    role: "MEMBER",
  });
  const [err, setErr] = useState<string | null>(null);
  const [editErr, setEditErr] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // F14.3 — Team filters.
  const [teamSearch, setTeamSearch] = useState("");
  const [teamStatus, setTeamStatus] = useState("");
  const [teamRole, setTeamRole] = useState("");
  const [teamSort, setTeamSort] = useState<"name-asc" | "name-desc">("name-asc");

  // Union of member roles (CompanyMember) and team/user roles.
  const teamRoleOptions = [
    { value: "OWNER", label: "Proprietário" },
    { value: "ADMIN", label: "Administrador" },
    { value: "MEMBER", label: "Membro" },
    { value: "CONTENT_MANAGER", label: "Gerente de Conteúdo" },
    { value: "EDITOR", label: "Editor" },
    { value: "SOCIAL_MEDIA", label: "Social Media" },
    { value: "DESIGNER", label: "Designer" },
  ];

  const matchesTeamFilters = (name: string, email: string, role: string, isActive: boolean) => {
    if (teamSearch.trim()) {
      const q = teamSearch.toLowerCase();
      if (!name.toLowerCase().includes(q) && !email.toLowerCase().includes(q)) return false;
    }
    if (teamStatus === "active" && !isActive) return false;
    if (teamStatus === "inactive" && isActive) return false;
    if (teamRole && role !== teamRole) return false;
    return true;
  };

  const sortMembersByName = <T,>(arr: T[], getName: (item: T) => string): T[] => {
    const sorted = [...arr].sort((a, b) => getName(a).localeCompare(getName(b)));
    return teamSort === "name-desc" ? sorted.reverse() : sorted;
  };

  const visibleMembers = members
    ? sortMembersByName(
        members.filter((m) => matchesTeamFilters(m.user.name || m.user.email, m.user.email, m.role, m.isActive)),
        (m) => m.user.name || m.user.email,
      )
    : undefined;
  const visibleTeam = team
    ? sortMembersByName(
        team.filter((u) => matchesTeamFilters(u.name || u.email, u.email, u.role, true)),
        (u) => u.name || u.email,
      )
    : undefined;

  const pendingInvitations = useMemo(() => {
    if (!invitations) return [];
    const now = new Date();
    return invitations.filter(
      (i) => !i.acceptedAt && !i.revokedAt && new Date(i.expiresAt) > now,
    );
  }, [invitations]);

  const submitInvite = async () => {
    setErr(null);
    setSuccessNotice(null);
    if (!inviteForm.email.trim()) {
      setErr("Preencha o e-mail.");
      return;
    }

    try {
      await createInvitation.mutateAsync(inviteForm);
      setShowInviteModal(false);
      setInviteForm({ email: "", role: "MEMBER" });
      setSuccessNotice(`Convite enviado com sucesso para ${inviteForm.email}.`);
      setTimeout(() => setSuccessNotice(null), 4000);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Falha ao enviar convite.");
    }
  };

  const saveMemberEdit = async () => {
    if (!editingMember) return;
    setEditErr(null);
    try {
      await updateMember.mutateAsync({
        id: editingMember.id,
        body: {
          role: editingMember.role,
          isActive: editingMember.isActive,
        },
      });
      const name = editingMember.name;
      setEditingMember(null);
      setSuccessNotice(`Membro "${name}" atualizado com sucesso.`);
      setTimeout(() => setSuccessNotice(null), 4000);
    } catch (e) {
      setEditErr(e instanceof ApiError ? e.message : "Falha ao atualizar membro.");
    }
  };

  const isLoading = membersLoading || teamLoading;
  const isError = membersIsError || teamIsError;
  const error = membersError || teamError;

  return (
    <div>
      <PageHeader
        title="Equipe"
        subtitle="Membros da agência e permissões de acesso"
        actions={
          isAdminOrOwner ? (
            <button className="btn-primary" onClick={() => setShowInviteModal(true)}>
              <IconPlus className="h-4 w-4" />
              Convidar membro
            </button>
          ) : undefined
        }
      />

      {successNotice && (
        <div className="mb-5 rounded-lg bg-[var(--looply-color-status-success)]/10 px-3.5 py-2.5 text-sm text-[var(--looply-color-status-success)]">
          {successNotice}
        </div>
      )}

      {err && (
        <div className="mb-5 rounded-lg bg-[var(--looply-color-status-danger)]/10 px-3.5 py-2.5 text-sm text-[var(--looply-color-status-danger)]">
          {err}
        </div>
      )}

      {/* Invite Member Modal / Bottom Sheet */}
      <ModalOrSheet
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title="Convidar membro"
        subtitle="Envie um convite de acesso para a sua equipe"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div>
            <label className="label">E-mail</label>
            <input
              className="input"
              value={inviteForm.email}
              onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="marina@agencia.com"
              type="email"
              autoFocus
            />
          </div>
          <div>
            <label className="label">Função</label>
            <select
              className="input"
              value={inviteForm.role}
              onChange={(e) => setInviteForm((f) => ({ ...f, role: e.target.value as "ADMIN" | "MEMBER" }))}
            >
              <option value="MEMBER">Membro</option>
              {isOwner && <option value="ADMIN">Administrador</option>}
            </select>
          </div>
          <div className="flex justify-end gap-2 border-t border-[var(--looply-color-border-default)] pt-4">
            <button className="btn-secondary btn-sm" onClick={() => setShowInviteModal(false)}>
              Cancelar
            </button>
            <button className="btn-primary btn-sm" disabled={createInvitation.isPending} onClick={submitInvite}>
              {createInvitation.isPending ? "Convidando…" : "Convidar membro"}
            </button>
          </div>
        </div>
      </ModalOrSheet>

      {/* Edit Member Quick Modal / Bottom Sheet */}
      <ModalOrSheet
        isOpen={!!editingMember}
        onClose={() => setEditingMember(null)}
        title="Editar membro"
        subtitle={editingMember ? `${editingMember.name} (${editingMember.email})` : "Gerenciar função e status"}
        maxWidth="max-w-md"
      >
        {editingMember && (
          <div className="space-y-4">
            <div>
              <label className="label">Função no workspace</label>
              <select
                className="input"
                value={editingMember.role}
                disabled={!isOwner}
                onChange={(e) =>
                  setEditingMember({ ...editingMember, role: e.target.value as MemberRole })
                }
              >
                <option value="OWNER">Proprietário</option>
                <option value="ADMIN">Administrador</option>
                <option value="MEMBER">Membro</option>
              </select>
              {!isOwner && (
                <p className="mt-1 text-xs text-[var(--looply-color-text-muted)]">
                  Apenas o proprietário pode alterar funções administrativas.
                </p>
              )}
            </div>

            <div>
              <label className="label">Status de acesso</label>
              <select
                className="input"
                value={editingMember.isActive ? "ACTIVE" : "INACTIVE"}
                onChange={(e) =>
                  setEditingMember({ ...editingMember, isActive: e.target.value === "ACTIVE" })
                }
              >
                <option value="ACTIVE">Ativo</option>
                <option value="INACTIVE">Inativo</option>
              </select>
            </div>

            {editErr && (
              <div className="rounded-lg bg-[var(--looply-color-status-danger)]/10 px-3 py-2 text-sm text-[var(--looply-color-status-danger)]">
                {editErr}
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-[var(--looply-color-border-default)] pt-4">
              <button
                className="btn-secondary btn-sm"
                onClick={() => setEditingMember(null)}
                disabled={updateMember.isPending}
              >
                Cancelar
              </button>
              <button
                className="btn-primary btn-sm"
                onClick={saveMemberEdit}
                disabled={updateMember.isPending}
              >
                {updateMember.isPending ? "Salvando…" : "Salvar alterações"}
              </button>
            </div>
          </div>
        )}
      </ModalOrSheet>

      {/* Pending Invitations Section */}
      {isAdminOrOwner && pendingInvitations.length > 0 && (
        <Card className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="section-title">Convites pendentes ({pendingInvitations.length})</h3>
          </div>
          <div className="divide-y divide-[var(--looply-color-border-default)]">
            {pendingInvitations.map((inv) => (
              <div
                key={inv.id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-[var(--looply-color-text-primary)]">
                      {inv.email}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
                        MEMBER_ROLE_STYLE[inv.role] ?? MEMBER_ROLE_STYLE.MEMBER
                      }`}
                    >
                      {MEMBER_ROLE_LABEL[inv.role] ?? inv.role}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-[var(--looply-color-text-muted)]">
                    Expira em {formatDate(inv.expiresAt)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="btn-ghost btn-sm text-[var(--looply-color-status-danger)] hover:bg-[var(--looply-color-status-danger)]/10"
                    disabled={revokeInvitation.isPending}
                    onClick={async () => {
                      setErr(null);
                      try {
                        await revokeInvitation.mutateAsync(inv.id);
                      } catch (e) {
                        setErr(e instanceof ApiError ? e.message : "Falha ao revogar convite.");
                      }
                    }}
                  >
                    Revogar convite
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {isLoading && <Spinner label="Carregando equipe…" />}
      {isError && <ErrorState message={(error as Error)?.message} />}

      {/* F14.3 — Team operational filters (search + status + role + sort) */}
      {(isAdminOrOwner && members && members.length > 0) || (team && team.length > 0) ? (
        <div className="mb-5 space-y-3">
          <div className="relative w-full max-w-sm">
            <input
              className="input pl-9"
              placeholder="Buscar por nome ou e-mail…"
              value={teamSearch}
              onChange={(e) => setTeamSearch(e.target.value)}
              aria-label="Buscar membro"
            />
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--looply-color-text-muted)]">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1.5">
              {([["", "Todos"], ["active", "Ativos"], ["inactive", "Inativos"]] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={teamStatus === value}
                  onClick={() => setTeamStatus(value)}
                  className={`rounded-full border px-3 py-1 text-[12.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--looply-color-focus)] ${
                    teamStatus === value
                      ? "border-[var(--looply-color-text-brand)] bg-[var(--looply-color-text-brand)]/10 text-[var(--looply-color-text-brand)]"
                      : "border-[var(--looply-color-border-default)] text-[var(--looply-color-text-muted)] hover:text-[var(--looply-color-text-primary)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <select
              aria-label="Filtrar por função"
              value={teamRole}
              onChange={(e) => setTeamRole(e.target.value)}
              className="input w-auto min-w-[150px] text-[12.5px]"
            >
              <option value="">Todas as funções</option>
              {teamRoleOptions.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <select
              aria-label="Ordenar membros"
              value={teamSort}
              onChange={(e) => setTeamSort(e.target.value as "name-asc" | "name-desc")}
              className="input w-auto min-w-[140px] text-[12.5px]"
            >
              <option value="name-asc">Nome A–Z</option>
              <option value="name-desc">Nome Z–A</option>
            </select>
            {(teamStatus || teamRole || teamSearch) && (
              <button
                type="button"
                onClick={() => { setTeamSearch(""); setTeamStatus(""); setTeamRole(""); setTeamSort("name-asc"); }}
                className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[var(--looply-color-action-primary)] hover:underline"
              >
                <IconX className="h-3.5 w-3.5" />
                Limpar filtros
              </button>
            )}
          </div>
        </div>
      ) : null}

      {/* Members Grid (Primary: CompanyMembers for Admin/Owner, Fallback: Team for Member) */}
      {isAdminOrOwner && visibleMembers ? (
        visibleMembers.length === 0 ? (
          <EmptyState title="Sem membros" description="Nenhum membro cadastrado ainda." />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleMembers.map((m) => {
              const u = m.user;
              const role = m.role;
              const canManage = isOwner || (currentRole === "ADMIN" && role === "MEMBER");

              return (
                <Card key={m.id} className="transition-shadow hover:shadow-looply-md">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {u.avatarUrl ? (
                        <img
                          src={u.avatarUrl}
                          alt=""
                          className="h-10 w-10 shrink-0 rounded-full object-cover border border-[var(--looply-color-border-default)]"
                        />
                      ) : (
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${
                            MEMBER_AVATAR_COLORS[role] ?? "bg-slate-600"
                          }`}
                        >
                          {initials(u.name || u.email)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-[var(--looply-color-text-primary)]">
                          {u.name || u.email}
                        </div>
                        <div className="truncate text-xs text-[var(--looply-color-text-muted)]">{u.email}</div>
                      </div>
                    </div>

                    {canManage && (
                      <button
                        type="button"
                        aria-label={`Editar membro ${u.name || u.email}`}
                        onClick={() =>
                          setEditingMember({
                            id: m.id,
                            name: u.name || u.email,
                            email: u.email,
                            role: m.role,
                            isActive: m.isActive,
                          })
                        }
                        className="btn-ghost btn-sm p-1.5 text-[var(--looply-color-text-muted)] hover:text-[var(--looply-color-text-primary)]"
                      >
                        <IconEdit className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2">
                    {isOwner ? (
                      <select
                        aria-label={`Função de ${u.name || u.email}`}
                        value={role}
                        disabled={updateMember.isPending}
                        onChange={async (e) => {
                          setErr(null);
                          try {
                            await updateMember.mutateAsync({
                              id: m.id,
                              body: { role: e.target.value as MemberRole },
                            });
                          } catch (err) {
                            setErr(err instanceof ApiError ? err.message : "Falha ao alterar função.");
                          }
                        }}
                        className="input py-1 px-2 text-xs w-auto font-medium"
                      >
                        <option value="OWNER">Proprietário</option>
                        <option value="ADMIN">Administrador</option>
                        <option value="MEMBER">Membro</option>
                      </select>
                    ) : (
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
                          MEMBER_ROLE_STYLE[role] ?? MEMBER_ROLE_STYLE.MEMBER
                        }`}
                      >
                        {MEMBER_ROLE_LABEL[role] ?? role}
                      </span>
                    )}

                    <span
                      className={`inline-flex items-center gap-1.5 text-xs ${
                        m.isActive ? "text-[var(--looply-color-status-success)]" : "text-[var(--looply-color-text-muted)]"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          m.isActive ? "bg-[var(--looply-color-status-success)]" : "bg-[var(--looply-color-text-muted)]"
                        }`}
                      />
                      {m.isActive ? "Ativo" : "Inativo"}
                    </span>
                  </div>

                  {/* Security / Password Reset Action (Figma 10 — Team / 03 — Team Actions) */}
                  {isAdminOrOwner && m.user.id !== session?.user?.id && !(currentRole === "ADMIN" && (m.role === "OWNER" || m.role === "ADMIN")) && (
                    <div className="mt-3 pt-3 border-t border-[var(--looply-color-border-default)] flex items-center justify-between">
                      <span className="text-[11px] text-[var(--looply-color-text-muted)]">
                        Segurança
                      </span>
                      <button
                        type="button"
                        disabled={resetMemberPassword.isPending}
                        onClick={async () => {
                          setErr(null);
                          try {
                            const res = await resetMemberPassword.mutateAsync(m.id);
                            setResetModalData({
                              memberName: res.user.name || res.user.email,
                              memberEmail: res.user.email,
                              tempPass: res.temporaryPassword,
                            });
                          } catch (e) {
                            setErr(e instanceof ApiError ? e.message : "Falha ao redefinir acesso.");
                          }
                        }}
                        className="btn-ghost btn-sm text-[11.5px] font-medium text-[var(--looply-color-text-brand)] hover:bg-[var(--looply-color-bg-subtle)]"
                      >
                        Redefinir acesso
                      </button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )
      ) : visibleTeam && visibleTeam.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleTeam.map((u) => (
            <Card key={u.id} className="transition-shadow hover:shadow-looply-md">
              <div className="flex items-center gap-3">
                {u.avatarUrl ? (
                  <img
                    src={u.avatarUrl}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-full object-cover border border-[var(--looply-color-border-default)]"
                  />
                ) : (
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${
                      AVATAR_COLORS[u.role] ?? "bg-slate-600"
                    }`}
                  >
                    {initials(u.name)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-[var(--looply-color-text-primary)]">
                    {u.name}
                  </div>
                  <div className="truncate text-xs text-[var(--looply-color-text-muted)]">{u.email}</div>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
                    ROLE_STYLE[u.role] ?? "bg-slate-50 text-slate-700 ring-slate-200"
                  }`}
                >
                  {ROLE_LABEL[u.role] ?? u.role}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 text-xs ${
                    u.active ? "text-[var(--looply-color-status-success)]" : "text-[var(--looply-color-text-muted)]"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      u.active ? "bg-[var(--looply-color-status-success)]" : "bg-[var(--looply-color-text-muted)]"
                    }`}
                  />
                  {u.active ? "Ativo" : "Inativo"}
                </span>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        !isLoading && <EmptyState title="Sem membros" description="Nenhum membro cadastrado ainda." />
      )}

      {/* Reset Password / Temporary Credential Modal (Figma 10 — Team / 03 — Team Actions) */}
      <ModalOrSheet
        isOpen={!!resetModalData}
        onClose={() => setResetModalData(null)}
        title="Redefinir acesso"
        subtitle={resetModalData ? `${resetModalData.memberName} (${resetModalData.memberEmail})` : undefined}
        maxWidth="max-w-md"
      >
        {resetModalData && (
          <div className="space-y-4">
            <p className="text-xs leading-5 text-[var(--looply-color-text-secondary)]">
              Uma senha temporária foi gerada. Copie e envie para o usuário. Ele será obrigado a cadastrar uma nova senha no próximo acesso. Todas as sessões ativas foram encerradas.
            </p>

            <div>
              <label className="label text-xs">Senha temporária</label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="text"
                  readOnly
                  value={resetModalData.tempPass}
                  className="input font-mono text-sm tracking-wider font-bold bg-[var(--looply-color-bg-subtle)] text-[var(--looply-color-text-primary)]"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(resetModalData.tempPass);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2500);
                  }}
                  className="btn-secondary btn-sm shrink-0 flex items-center gap-1.5"
                >
                  {copied ? (
                    <>
                      <IconCheck className="h-3.5 w-3.5 text-[var(--looply-color-status-success)]" />
                      <span>Copiado!</span>
                    </>
                  ) : (
                    <span>Copiar</span>
                  )}
                </button>
              </div>
            </div>

            <div className="mt-6 flex justify-end border-t border-[var(--looply-color-border-default)] pt-3">
              <button
                type="button"
                onClick={() => setResetModalData(null)}
                className="btn-primary btn-sm"
              >
                Concluir
              </button>
            </div>
          </div>
        )}
      </ModalOrSheet>
    </div>
  );
}
