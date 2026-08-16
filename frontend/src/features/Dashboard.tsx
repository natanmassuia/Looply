import { Link } from "react-router-dom";
import { useDashboard, useTeam } from "../lib/api";
import { Card, EmptyState, ErrorState, Spinner } from "../components/common";
import StatusPill from "../components/StatusPill";
import { FORMAT_LABEL, relativeTime } from "../lib/format";
import { IconPlus, IconAlertCircle, IconCheck, IconClock, IconSend, IconEye, IconTrendingUp } from "../components/Icons";
import type { ReactNode } from "react";

function getGreeting(name?: string): string {
  const h = new Date().getHours();
  const greet = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  return name ? `${greet}, ${name.split(" ")[0]}` : greet;
}

export default function Dashboard() {
  const { data, isLoading, isError, error } = useDashboard();
  const { data: team } = useTeam();
  const userName = team?.find((u) => u.role === "ADMIN")?.name;

  const activeJobsCount = data
    ? Math.max(0, (data.counts.totalContents ?? 0) - (data.counts.published ?? 0))
    : 0;
  const activeClientsCount = data ? data.counts.totalClients ?? 0 : 0;
  const inApprovalCount = data ? data.counts.awaitingClient : 0;
  const scheduledCount = data ? data.counts.scheduled : 0;

  return (
    <div>
      {/* Header with greeting */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[1.35rem] font-bold tracking-tight text-[var(--looply-color-text-primary)]">
            {data ? getGreeting(userName) : "Visão geral"}
          </h1>
          <p className="mt-1 text-[0.8125rem] text-[var(--looply-color-text-muted)]">
            {data
              ? "Acompanhe o que está acontecendo com sua operação."
              : "Visão geral do fluxo de trabalho"}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link to="/contents" className="btn-secondary">
            <IconEye className="h-4 w-4" />
            Ver jobs
          </Link>
          <Link to="/contents/new" className="btn-primary">
            <IconPlus className="h-4 w-4" />
            Novo job
          </Link>
        </div>
      </div>

      {isLoading && <Spinner label="Carregando painel…" />}
      {isError && <ErrorState message={(error as Error)?.message} />}
      {data && (
        <div className="space-y-6">
          {/* Attention panel - primary */}
          {data.needingAttention.length > 0 ? (
            <Card className="border-l-4 border-l-[var(--looply-color-status-warning)]">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--looply-color-status-warning)]/10 text-[var(--looply-color-status-warning)]">
                  <IconAlertCircle className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm font-semibold text-[var(--looply-color-text-primary)]">Atenção agora</h2>
                  <p className="mt-0.5 text-xs text-[var(--looply-color-text-muted)]">
                    {data.needingAttention.length} {data.needingAttention.length === 1 ? "job pendente" : "jobs pendentes"}
                  </p>
                  <ul className="mt-3 space-y-2">
                    {data.needingAttention.map((c) => (
                      <li key={c.id}>
                        <Link
                          to={`/contents/${c.id}`}
                          className="flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-[var(--looply-color-bg-subtle)]"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-[var(--looply-color-text-primary)]">
                              {c.title}
                            </div>
                            <div className="text-xs text-[var(--looply-color-text-muted)]">
                              {c.client?.name} · {FORMAT_LABEL[c.format]}
                            </div>
                          </div>
                          <StatusPill status={c.status} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="border-l-4 border-l-[var(--looply-color-status-success)]">
              <div className="flex items-center gap-3 py-1">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--looply-color-status-success)]/10 text-[var(--looply-color-status-success)]">
                  <IconCheck className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-[var(--looply-color-text-primary)]">Tudo em dia</h2>
                  <p className="text-xs text-[var(--looply-color-text-muted)]">
                    Nenhum job pendente no momento.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Compact metrics row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <CompactMetric
              label="Jobs ativos"
              value={activeJobsCount}
              icon={<IconTrendingUp className="h-4 w-4" />}
              color="blue"
            />
            <CompactMetric
              label="Em aprovação"
              value={inApprovalCount}
              icon={<IconClock className="h-4 w-4" />}
              color="violet"
            />
            <CompactMetric
              label="Clientes ativos"
              value={activeClientsCount}
              icon={<IconCheck className="h-4 w-4" />}
              color="emerald"
            />
            <CompactMetric
              label="Agendados"
              value={scheduledCount}
              icon={<IconSend className="h-4 w-4" />}
              color="amber"
            />
          </div>

          {/* Main content: asymmetric 2-col */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            {/* Left: In progress (~65%) */}
            <div className="lg:col-span-3">
              <Card className="p-0">
                <div className="border-b border-[var(--looply-color-border-default)] px-5 py-3.5">
                  <h2 className="text-sm font-semibold text-[var(--looply-color-text-primary)]">Jobs em andamento</h2>
                </div>
                {data.recentContents.length === 0 ? (
                  <div className="px-5 py-10">
                    <EmptyState
                      title="Nenhum job ainda"
                      description="Crie seu primeiro job para começar."
                      action={
                        <Link to="/contents/new" className="btn-primary">
                          <IconPlus className="h-4 w-4" />
                          Novo job
                        </Link>
                      }
                    />
                  </div>
                ) : (
                  <ul className="divide-y divide-[var(--looply-color-border-default)]">
                    {data.recentContents.map((c) => (
                      <li key={c.id}>
                        <Link
                          to={`/contents/${c.id}`}
                          className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[var(--looply-color-bg-subtle)]"
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--looply-color-bg-subtle)] text-[var(--looply-color-text-muted)]">
                            <FormatIcon format={c.format} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-[var(--looply-color-text-primary)]">
                              {c.title}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-[var(--looply-color-text-muted)]">
                              <ClientDot color={c.client?.brandColor} />
                              <span>{c.client?.name}</span>
                              <span className="text-[var(--looply-color-border-default)]">·</span>
                              <span>{FORMAT_LABEL[c.format]}</span>
                              <span className="text-[var(--looply-color-border-default)]">·</span>
                              <span>v{latestVersion(c)}</span>
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <StatusPill status={c.status} />
                            <div className="mt-1 text-[10px] text-[var(--looply-color-text-muted)]">
                              {relativeTime(c.updatedAt)}
                            </div>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>

            {/* Right: Upcoming (~35%) */}
            <div className="lg:col-span-2">
              <Card className="p-0">
                <div className="border-b border-[var(--looply-color-border-default)] px-5 py-3.5">
                  <h2 className="text-sm font-semibold text-[var(--looply-color-text-primary)]">Agenda de hoje</h2>
                </div>
                {data.counts.scheduled === 0 && data.counts.approved === 0 ? (
                  <div className="px-5 py-8 text-center">
                    <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--looply-color-bg-subtle)] text-[var(--looply-color-text-muted)]">
                      <IconClock className="h-5 w-5" />
                    </div>
                    <p className="text-xs font-medium text-[var(--looply-color-text-primary)]">Nada agendado</p>
                    <p className="mt-0.5 text-xs text-[var(--looply-color-text-muted)]">
                      Jobs aprovados aparecerão aqui.
                    </p>
                  </div>
                ) : (
                  <div className="px-5 py-3">
                    <p className="text-xs text-[var(--looply-color-text-muted)]">
                      {data.counts.scheduled} agendado{data.counts.scheduled !== 1 ? "s" : ""}
                      {data.counts.approved > 0 && ` · ${data.counts.approved} aprovado${data.counts.approved !== 1 ? "s" : ""} pronto${data.counts.approved !== 1 ? "s" : ""} para agendar`}
                    </p>
                  </div>
                )}
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CompactMetric({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  color: "amber" | "violet" | "emerald" | "blue";
}) {
  const colorMap = {
    amber: "bg-[var(--looply-color-status-warning)]/10 text-[var(--looply-color-status-warning)]",
    violet: "bg-[var(--looply-color-action-secondary)]/15 text-[var(--looply-color-action-secondary)]",
    emerald: "bg-[var(--looply-color-status-success)]/10 text-[var(--looply-color-status-success)]",
    blue: "bg-[var(--looply-color-action-primary)]/10 text-[var(--looply-color-action-primary)]",
  };
  return (
    <div className="card p-3.5">
      <div className="flex items-center gap-2.5">
        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${colorMap[color]}`}>
          {icon}
        </div>
        <div>
          <div className="text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--looply-color-text-muted)]">
            {label}
          </div>
          <div className="text-lg font-bold tabular-nums text-[var(--looply-color-text-primary)]">{value}</div>
        </div>
      </div>
    </div>
  );
}

function FormatIcon({ format }: { format: string }) {
  switch (format) {
    case "REELS":
    case "VIDEO":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="M10 9l5 3-5 3V9z" fill="currentColor" stroke="none" />
        </svg>
      );
    case "CAROUSEL":
    case "IMAGE":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
      );
    default:
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
        </svg>
      );
  }
}

function ClientDot({ color }: { color?: string | null }) {
  return (
    <span
      className="h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: color ?? "var(--looply-color-text-muted)" }}
    />
  );
}

function latestVersion(c: { versions?: { versionNumber: number }[] }): number {
  if (!c.versions?.length) return 1;
  return Math.max(...c.versions.map((v) => v.versionNumber));
}
