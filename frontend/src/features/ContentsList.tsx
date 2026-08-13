import { useState } from "react";
import { Link } from "react-router-dom";
import { useContents } from "../lib/api";
import { STATUS_FILTERS, STATUS_LABEL, FORMAT_LABEL, relativeTime } from "../lib/format";
import type { ContentStatus } from "../lib/types";
import { Card, EmptyState, ErrorState, PageHeader, Spinner } from "../components/common";
import StatusPill from "../components/StatusPill";
import { IconPlus } from "../components/Icons";

export default function ContentsList() {
  const [status, setStatus] = useState<ContentStatus | "all">("all");
  const { data, isLoading, isError, error } = useContents(status === "all" ? undefined : status);

  return (
    <div className="mx-auto max-w-6xl px-6 py-7">
      <PageHeader
        title="Conteúdos"
        crumbs={[{ label: "Conteúdos" }]}
        actions={
          <Link to="/contents/new" className="btn-primary">
            <IconPlus className="h-4 w-4" />
            Novo conteúdo
          </Link>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
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

      {isLoading && <Spinner label="Carregando conteúdos…" />}
      {isError && <ErrorState message={(error as Error)?.message} />}
      {data && data.length === 0 && (
        <EmptyState
          title="Nenhum conteúdo"
          description="Ajuste o filtro ou crie um novo conteúdo."
          action={
            <Link to="/contents/new" className="btn-primary">
              <IconPlus className="h-4 w-4" />
              Novo conteúdo
            </Link>
          }
        />
      )}
      {data && data.length > 0 && (
        <Card className="overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-medium">Conteúdo</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Formato</th>
                <th className="px-4 py-3 font-medium">Responsável</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Atualizado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link
                      to={`/contents/${c.id}`}
                      className="font-medium text-slate-800 hover:text-brand-600"
                    >
                      {c.title}
                    </Link>
                    {c.versions?.[0] && (
                      <div className="text-xs text-slate-400">
                        v{c.versions[0].versionNumber}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.client?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{FORMAT_LABEL[c.format]}</td>
                  <td className="px-4 py-3 text-slate-600">{c.responsible?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <StatusPill status={c.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-500">{relativeTime(c.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
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
      className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-brand-600 text-white"
          : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  );
}
