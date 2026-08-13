import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useContents } from "../lib/api";
import { STATUS_FILTERS, STATUS_LABEL, FORMAT_LABEL, relativeTime } from "../lib/format";
import type { ContentStatus, ContentListItem } from "../lib/types";
import { Card, EmptyState, ErrorState, PageHeader, Spinner } from "../components/common";
import StatusPill from "../components/StatusPill";
import { IconPlus, IconSearch } from "../components/Icons";

export default function ContentsList() {
  const [status, setStatus] = useState<ContentStatus | "all">("all");
  const [search, setSearch] = useState("");
  const { data, isLoading, isError, error } = useContents(status === "all" ? undefined : status);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.client?.name.toLowerCase().includes(q) ||
        FORMAT_LABEL[c.format].toLowerCase().includes(q),
    );
  }, [data, search]);

  return (
    <div>
      <PageHeader
        title="Conteúdos"
        subtitle="Gerencie todo o ciclo de vida dos conteúdos"
        crumbs={[{ label: "Conteúdos" }]}
        actions={
          <Link to="/contents/new" className="btn-primary">
            <IconPlus className="h-4 w-4" />
            Novo conteúdo
          </Link>
        }
      />

      {/* Filters */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip active={status === "all"} onClick={() => setStatus("all")} label="Todos" />
          {STATUS_FILTERS.map((s) => (
            <FilterChip
              key={s}
              active={status === s}
              onClick={() => setStatus(s)}
              label={STATUS_LABEL[s]}
            />
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--looply-faint-foreground)]" />
          <input
            className="input pl-9"
            placeholder="Buscar conteúdos…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {isLoading && <Spinner label="Carregando conteúdos…" />}
      {isError && <ErrorState message={(error as Error)?.message} />}

      {!isLoading && !isError && filtered.length === 0 && (
        <EmptyState
          title={search ? "Nenhum resultado" : "Nenhum conteúdo"}
          description={
            search
              ? "Tente ajustar a busca ou os filtros."
              : "Ajuste o filtro ou crie um novo conteúdo."
          }
          action={
            !search && (
              <Link to="/contents/new" className="btn-primary">
                <IconPlus className="h-4 w-4" />
                Novo conteúdo
              </Link>
            )
          }
        />
      )}

      {!isLoading && !isError && filtered.length > 0 && (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--looply-border)] bg-[var(--looply-surface-muted)] text-left text-xs uppercase tracking-wide text-[var(--looply-muted-foreground)]">
                  <th className="px-4 py-3 font-semibold">Conteúdo</th>
                  <th className="px-4 py-3 font-semibold">Cliente</th>
                  <th className="hidden px-4 py-3 font-semibold sm:table-cell">Formato</th>
                  <th className="hidden px-4 py-3 font-semibold lg:table-cell">Responsável</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="hidden px-4 py-3 font-semibold md:table-cell">Atualizado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--looply-border)]">
                {filtered.map((c) => (
                  <tr key={c.id} className="transition-colors hover:bg-[var(--looply-surface-muted)]">
                    <td className="px-4 py-3">
                      <Link
                        to={`/contents/${c.id}`}
                        className="font-medium text-[var(--looply-foreground)] transition-colors hover:text-brand-600"
                      >
                        {c.title}
                      </Link>
                      <div className="text-xs text-[var(--looply-faint-foreground)]">
                        v{latestVersion(c)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: c.client?.brandColor ?? "var(--looply-faint-foreground)" }}
                        />
                        <span className="text-[var(--looply-foreground)]">{c.client?.name ?? "—"}</span>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 text-[var(--looply-muted-foreground)] sm:table-cell">
                      {FORMAT_LABEL[c.format]}
                    </td>
                    <td className="hidden px-4 py-3 text-[var(--looply-muted-foreground)] lg:table-cell">
                      {c.responsible?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={c.status} />
                    </td>
                    <td className="hidden text-[var(--looply-muted-foreground)] md:table-cell px-4 py-3">
                      {relativeTime(c.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function latestVersion(c: ContentListItem): number {
  if (!c.versions?.length) return 1;
  return Math.max(...c.versions.map((v) => v.versionNumber));
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-[13px] font-medium transition-all duration-150 ${
        active
          ? "bg-brand-600 text-white shadow-sm"
          : "bg-[var(--looply-surface)] text-[var(--looply-muted-foreground)] ring-1 ring-inset ring-[var(--looply-border)] hover:bg-[var(--looply-surface-muted)] hover:text-[var(--looply-foreground)]"
      }`}
    >
      {label}
    </button>
  );
}
