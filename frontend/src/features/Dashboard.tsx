import { Link } from "react-router-dom";
import { useDashboard } from "../lib/api";
import { Card, EmptyState, ErrorState, PageHeader, Spinner } from "../components/common";
import StatusPill from "../components/StatusPill";
import { FORMAT_LABEL, relativeTime } from "../lib/format";
import { IconPlus, IconAlertCircle, IconCheck } from "../components/Icons";
import type { ReactNode } from "react";

function Metric({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="card p-4 transition-shadow hover:shadow-looply-md">
      <div className="text-xs font-medium uppercase tracking-wide text-[var(--looply-muted-foreground)]">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${accent ?? "text-[var(--looply-foreground)]"}`}>{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const { data, isLoading, isError, error } = useDashboard();

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Visão geral do fluxo de conteúdos"
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
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <Metric label="Total" value={data.counts.totalContents} />
            <Metric label="Em revisão" value={data.counts.inReview} accent="text-amber-600" />
            <Metric label="Aguardando cliente" value={data.counts.awaitingClient} accent="text-violet-600" />
            <Metric label="Alterações" value={data.counts.changesRequested} accent="text-rose-600" />
            <Metric label="Aprovados" value={data.counts.approved} accent="text-emerald-600" />
            <Metric label="Agendados" value={data.counts.scheduled} accent="text-blue-600" />
          </div>

          {/* Attention + Recent */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Recent contents */}
            <Card className="lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[var(--looply-foreground)]">Conteúdos recentes</h2>
                <Link to="/contents" className="text-sm font-medium text-brand-600 transition-colors hover:text-brand-700">
                  Ver todos
                </Link>
              </div>
              {data.recentContents.length === 0 ? (
                <EmptyState title="Nenhum conteúdo ainda" description="Crie seu primeiro conteúdo para começar." />
              ) : (
                <ul className="divide-y divide-[var(--looply-border)]">
                  {data.recentContents.map((c) => (
                    <li key={c.id}>
                      <Link
                        to={`/contents/${c.id}`}
                        className="flex items-center justify-between gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-[var(--looply-surface-muted)]"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-[var(--looply-foreground)]">
                            {c.title}
                          </div>
                          <div className="text-xs text-[var(--looply-muted-foreground)]">
                            {c.client?.name} · {FORMAT_LABEL[c.format]} · {relativeTime(c.updatedAt)}
                          </div>
                        </div>
                        <StatusPill status={c.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* Needing attention */}
            <Card>
              <div className="mb-4 flex items-center gap-2">
                <IconAlertCircle className="h-4 w-4 text-rose-500" />
                <h2 className="text-sm font-semibold text-[var(--looply-foreground)]">Precisando de atenção</h2>
              </div>
              {data.needingAttention.length === 0 ? (
                <div className="flex flex-col items-center py-6 text-center">
                  <IconCheck className="mb-2 h-8 w-8 text-emerald-400" />
                  <p className="text-sm font-medium text-[var(--looply-foreground)]">Tudo em dia</p>
                  <p className="mt-0.5 text-xs text-[var(--looply-muted-foreground)]">Nada pendente no momento.</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {data.needingAttention.map((c) => (
                    <li key={c.id}>
                      <Link
                        to={`/contents/${c.id}`}
                        className="flex items-center justify-between rounded-lg border border-[var(--looply-border)] px-3 py-2.5 transition-colors hover:bg-[var(--looply-surface-muted)]"
                      >
                        <span className="truncate text-sm text-[var(--looply-foreground)]">{c.title}</span>
                        <StatusPill status={c.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {/* Quick links */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <QuickLinkCard label="Clientes" value={data.counts.totalClients} to="/clients" icon="clients" />
            <QuickLinkCard label="Equipe" value={data.counts.totalTeam} to="/team" icon="team" />
          </div>
        </div>
      )}
    </div>
  );
}

function QuickLinkCard({ label, value, to, icon }: { label: string; value: number; to: string; icon: string }) {
  const icons: Record<string, ReactNode> = {
    clients: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11" />
      </svg>
    ),
    team: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11" />
      </svg>
    ),
  };
  return (
    <Link to={to} className="block">
      <div className="card flex items-center justify-between p-4 transition-all hover:border-brand-300 hover:shadow-looply-md">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--looply-surface-muted)] text-[var(--looply-muted-foreground)]">
            {icons[icon]}
          </div>
          <span className="text-sm font-medium text-[var(--looply-foreground)]">{label}</span>
        </div>
        <span className="text-lg font-bold text-[var(--looply-foreground)]">{value}</span>
      </div>
    </Link>
  );
}
