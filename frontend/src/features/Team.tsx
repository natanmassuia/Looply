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

export default function Team() {
  const { data: team, isLoading, isError, error } = useTeam();

  return (
    <div className="mx-auto max-w-5xl px-6 py-7">
      <PageHeader title="Equipe" crumbs={[{ label: "Equipe" }]} />

      {isLoading && <Spinner label="Carregando equipe…" />}
      {isError && <ErrorState message={(error as Error)?.message} />}
      {team && team.length === 0 && <EmptyState title="Sem membros" />}
      {team && team.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {team.map((u) => (
            <Card key={u.id}>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-navy-800 text-sm font-bold text-white">
                  {initials(u.name)}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-800">{u.name}</div>
                  <div className="truncate text-xs text-slate-500">{u.email}</div>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${ROLE_STYLE[u.role]}`}
                >
                  {ROLE_LABEL[u.role]}
                </span>
                <span
                  className={`flex items-center gap-1.5 text-xs ${
                    u.active ? "text-emerald-600" : "text-slate-400"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${u.active ? "bg-emerald-500" : "bg-slate-300"}`}
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
