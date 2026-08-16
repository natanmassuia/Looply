import { useMemo, useState } from "react";
import {
  useMe,
  useMembers,
  useTeam,
  useInvitations,
  useCreateInvitation,
  useRevokeInvitation,
  useUpdateMember,
  ApiError,
} from "../lib/api";
import type { MemberRole, UserRole } from "../lib/types";
import { MEMBER_ROLE_LABEL, ROLE_LABEL, formatDate } from "../lib/format";
import { Card, EmptyState, ErrorState, PageHeader, Spinner } from "../components/common";
import { IconPlus, IconX } from "../components/Icons";

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

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<{ email: string; role: "ADMIN" | "MEMBER" }>({
    email: "",
    role: "MEMBER",
  });
  const [err, setErr] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const pendingInvitations = useMemo(() => {
    if (!invitations) return [];
    const now = new Date();
    return invitations.filter(
      (i) => !i.acceptedAt && !i.revokedAt && new Date(i.expiresAt) > now,
    );
  }, [invitations]);

  const submit = async () => {
    setErr(null);
    setSuccessNotice(null);
    if (!form.email.trim()) {
      setErr("Preencha o e-mail.");
      return;
    }
    try {
      await createInvitation.mutateAsync({
        email: form.email.trim().toLowerCase(),
        role: form.role,
      });
      const invitedEmail = form.email.trim().toLowerCase();
      setForm({ email: "", role: "MEMBER" });
      setShowForm(false);
      setSuccessNotice(`Convite criado com sucesso para ${invitedEmail}.`);
      setTimeout(() => setSuccessNotice(null), 5000);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Falha ao criar convite.");
    }
  };

  const isLoading = isAdminOrOwner ? membersLoading : teamLoading;
  const isError = isAdminOrOwner ? membersIsError : teamIsError;
  const error = isAdminOrOwner ? membersError : teamError;

  return (
    <div>
      <PageHeader
        title="Equipe"
        subtitle="Membros e permissões da agência"
        actions={
          isAdminOrOwner ? (
            <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>
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

      {showForm && (
        <Card className="mb-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="section-title">Convidar membro</h3>
            <button className="btn-ghost btn-sm" onClick={() => setShowForm(false)} aria-label="Fechar">
              <IconX className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">E-mail</label>
              <input
                className="input"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="marina@agencia.com"
                type="email"
                autoFocus
              />
            </div>
            <div>
              <label className="label">Função</label>
              <select
                className="input"
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as "ADMIN" | "MEMBER" }))}
              >
                <option value="MEMBER">Membro</option>
                {isOwner && <option value="ADMIN">Administrador</option>}
              </select>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2 border-t border-[var(--looply-color-border-default)] pt-4">
            <button className="btn-secondary" onClick={() => setShowForm(false)}>
              Cancelar
            </button>
            <button className="btn-primary" disabled={createInvitation.isPending} onClick={submit}>
              {createInvitation.isPending ? "Convidando…" : "Convidar membro"}
            </button>
          </div>
        </Card>
      )}

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

      {/* Members Grid (Primary: CompanyMembers for Admin/Owner, Fallback: Team for Member) */}
      {isAdminOrOwner && members ? (
        members.length === 0 ? (
          <EmptyState title="Sem membros" description="Nenhum membro cadastrado ainda." />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {members.map((m) => {
              const u = m.user;
              const role = m.role;
              return (
                <Card key={m.id} className="transition-shadow hover:shadow-looply-md">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${
                        MEMBER_AVATAR_COLORS[role] ?? "bg-slate-600"
                      }`}
                    >
                      {initials(u.name || u.email)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-[var(--looply-color-text-primary)]">
                        {u.name || u.email}
                      </div>
                      <div className="truncate text-xs text-[var(--looply-color-text-muted)]">{u.email}</div>
                    </div>
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

                    {isOwner ? (
                      <button
                        type="button"
                        aria-label={`Status de ${u.name || u.email}`}
                        disabled={updateMember.isPending}
                        onClick={async () => {
                          setErr(null);
                          try {
                            await updateMember.mutateAsync({
                              id: m.id,
                              body: { isActive: !m.isActive },
                            });
                          } catch (err) {
                            setErr(err instanceof ApiError ? err.message : "Falha ao alterar status.");
                          }
                        }}
                        className={`inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer ${
                          m.isActive ? "text-[var(--looply-color-status-success)]" : "text-[var(--looply-color-text-muted)]"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            m.isActive ? "bg-[var(--looply-color-status-success)]" : "bg-[var(--looply-color-text-muted)]"
                          }`}
                        />
                        {m.isActive ? "Ativo" : "Inativo"}
                      </button>
                    ) : (
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
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )
      ) : team && team.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {team.map((u) => (
            <Card key={u.id} className="transition-shadow hover:shadow-looply-md">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${
                    AVATAR_COLORS[u.role] ?? "bg-slate-600"
                  }`}
                >
                  {initials(u.name)}
                </div>
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
    </div>
  );
}
