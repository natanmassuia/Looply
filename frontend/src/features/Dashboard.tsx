import { Link } from "react-router-dom";
import { useDashboard } from "../lib/api";
import { Card, EmptyState, ErrorState, PageHeader, Spinner } from "../components/common";
import StatusPill from "../components/StatusPill";
import { FORMAT_LABEL, relativeTime } from "../lib/format";
import { IconPlus } from "../components/Icons";
import type { ReactNode } from "react";

function Metric({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <Card className="flex flex-col gap-1">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`text-2xl font-bold ${accent ?? "text-slate-900"}`}>{value}</div>
    </Card>
  );
}

export default function Dashboard() {
  const { data, isLoading, isError, error } = useDashboard();

  return (
    <div className="mx-auto max-w-6xl px-6 py-7">
      <PageHeader
        title="Dashboard"
        actions={
          <>
            <Link to="/contents" className="btn-secondary">
              Ver conteúdos
            </Link>
            <Link to="/contents/new" className="btn-primary">
              <IconPlus className="h-4 w-4" />
              Novo conteúdo
            </Link>
          </>
        }
      />

      {isLoading && <Spinner label="Carregando painel…" />}
      {isError && <ErrorState message={(error as Error)?.message} />}
      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <Metric label="Total de conteúdos" value={data.counts.totalContents} />
            <Metric label="Em revisão" value={data.counts.inReview} accent="text-amber-600" />
            <Metric
              label="Aguardando cliente"
              value={data.counts.awaitingClient}
              accent="text-violet-600"
            />
            <Metric
              label="Alterações solicitadas"
              value={data.counts.changesRequested}
              accent="text-rose-600"
            />
            <Metric label="Aprovados" value={data.counts.approved} accent="text-emerald-600" />
            <Metric label="Agendados" value={data.counts.scheduled} accent="text-blue-600" />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-700">Conteúdos recentes</h2>
                <Link to="/contents" className="text-sm font-medium text-brand-600 hover:underline">
                  Ver todos
                </Link>
              </div>
              {data.recentContents.length === 0 ? (
                <EmptyState title="Nenhum conteúdo ainda" description="Crie seu primeiro conteúdo." />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.recentContents.map((c) => (
                    <li key={c.id}>
                      <Link
                        to={`/contents/${c.id}`}
                        className="flex items-center justify-between gap-3 py-3 hover:bg-slate-50"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-slate-800">
                            {c.title}
                          </div>
                          <div className="text-xs text-slate-500">
                            {c.client?.name} · {FORMAT_LABEL[c.format]} · atualizado{" "}
                            {relativeTime(c.updatedAt)}
                          </div>
                        </div>
                        <StatusPill status={c.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <h2 className="mb-4 text-sm font-semibold text-slate-700">Precisando de atenção</h2>
              {data.needingAttention.length === 0 ? (
                <EmptyState title="Tudo em dia" description="Nada pendente no momento." />
              ) : (
                <ul className="space-y-2">
                  {data.needingAttention.map((c) => (
                    <li key={c.id}>
                      <Link
                        to={`/contents/${c.id}`}
                        className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50"
                      >
                        <span className="truncate text-sm text-slate-700">{c.title}</span>
                        <StatusPill status={c.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <SummaryRow label="Clientes" value={data.counts.totalClients} to="/clients" />
          <SummaryRow label="Equipe" value={data.counts.totalTeam} to="/team" />
        </div>
      )}
    </div>
  );
}

function SummaryRow({ label, value, to }: { label: string; value: number; to: string }): ReactNode {
  return (
    <Link to={to} className="block">
      <Card className="flex items-center justify-between hover:border-brand-300">
        <span className="text-sm font-medium text-slate-600">{label}</span>
        <span className="text-lg font-bold text-slate-900">{value}</span>
      </Card>
    </Link>
  );
}
