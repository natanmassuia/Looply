import { useTeam } from "../lib/api";
import { ROLE_LABEL } from "../lib/format";
import { Card, EmptyState, ErrorState, PageHeader, Spinner } from "../components/common";
import type { UserRole } from "../lib/types";

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

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
  const { data: team, isLoading, isError, error } = useTeam();

  return (
    <div>
      <PageHeader title="Equipe" subtitle="Membros da agência" crumbs={[{ label: "Equipe" }]} />

      {isLoading && <Spinner label="Carregando equipe…" />}
      {isError && <ErrorState message={(error as Error)?.message} />}
      {team && team.length === 0 && <EmptyState title="Sem membros" description="Nenhum membro cadastrado ainda." />}
      {team && team.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {team.map((u) => (
            <Card key={u.id} className="transition-shadow hover:shadow-looply-md">
              <div className="flex items-center gap-3">
                <div className={`flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold text-white ${AVATAR_COLORS[u.role]}`}>
                  {initials(u.name)}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-[var(--looply-foreground)]">{u.name}</div>
                  <div className="truncate text-xs text-[var(--looply-muted-foreground)]">{u.email}</div>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${ROLE_STYLE[u.role]}`}
                >
                  {ROLE_LABEL[u.role]}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 text-xs ${
                    u.active ? "text-emerald-600" : "text-[var(--looply-faint-foreground)]"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${u.active ? "bg-emerald-500" : "bg-[var(--looply-faint-foreground)]"}`}
                  />
                  {u.active ? "Ativo" : "Inativo"}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
