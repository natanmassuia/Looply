import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { useDashboard, useMe } from "../lib/api";
import { Card, EmptyState, ErrorState, SkeletonCards } from "../components/common";
import StatusPill from "../components/StatusPill";
import { FORMAT_LABEL, latestVersion, relativeTime, formatAppointmentLine, formatClock, gmtOffsetLabel } from "../lib/format";
import { IconAlertCircle, IconCheck, IconClock, IconSend, IconEye, IconTrendingUp, IconChevronRight } from "../components/Icons";
import type { ReactNode } from "react";
import type { DashboardUpcomingEvent } from "../lib/types";

function getGreeting(name?: string): string {
  const h = new Date().getHours();
  const greet = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  return name ? `${greet}, ${name.split(" ")[0]}` : greet;
}

// F14.2: Dashboard is a summary — show at most 5 active demands.
const ACTIVE_DEMAND_LIMIT = 5;
const UPCOMING_LIMIT = 3;
// F14.6: pending (Atenção agora) summary shows at most 3 rows + a view-all.
const PENDING_LIMIT = 3;

function UpcomingClock({ timeZone }: { timeZone: string | null | undefined }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const offset = gmtOffsetLabel(timeZone);
  return (
    <div className="shrink-0 text-left leading-tight sm:text-right">
      <div className="text-sm font-semibold tabular-nums text-[var(--looply-color-text-primary)]">
        {formatClock(now, timeZone)}
      </div>
      <div className="text-[10.5px] text-[var(--looply-color-text-muted)]">
        Horário da empresa{offset ? ` · ${offset}` : ""}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data, isLoading, isError, error } = useDashboard();
  const { data: me } = useMe();
  const userName = me?.user?.name;
  const timeZone = data?.workspace?.timezone ?? me?.workspace?.timezone;

  const activeDemandsCount = data
    ? Math.max(0, (data.counts.totalContents ?? 0) - (data.counts.published ?? 0))
    : 0;
  // Attendance KPIs (core: WhatsApp + agenda). Fallbacks keep the tiles at 0
  // when an older backend omits the block.
  const att = data?.attendance;
  const convNeedsAttention = att?.conversationsNeedingAttention ?? 0;
  const conversationsToday = att?.conversationsActiveToday ?? 0;
  const appointmentsToday = att?.appointmentsToday ?? 0;
  const activeDemands = att?.activeDemands ?? activeDemandsCount;
  const inboxAttentionHref = "/inbox?aiStatus=NEEDS_ATTENTION";

  // Upcoming = future events, ascending, max 3.
  const nowIso = new Date();
  const upcomingEvents: DashboardUpcomingEvent[] = (data?.upcoming?.events ?? [])
    .filter((e) => new Date(e.at).getTime() > nowIso.getTime())
    .slice(0, UPCOMING_LIMIT);

  // F14.7 — contextual navigation: when a concrete demand is the target of a
  // dashboard action, pass it as ?focus so Demandas brings it into view.
  const firstAttentionId = data?.needingAttention[0]?.id;
  const attentionHref = firstAttentionId ? `/contents?focus=${firstAttentionId}` : "/contents";

  return (
    <div>
      {/* Header with greeting + live workspace clock */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[1.35rem] font-bold tracking-tight text-[var(--looply-color-text-primary)]">
            {data ? getGreeting(userName) : "Visão geral"}
          </h1>
          <p className="mt-1 text-[0.8125rem] text-[var(--looply-color-text-muted)]">
            {data
              ? "O que precisa da sua atenção hoje."
              : "Visão geral do fluxo de trabalho"}
          </p>
        </div>
        {/* Clock + demand action share one header meta row; on mobile they span
            the width (clock left, action right) instead of floating apart. */}
        <div className="flex w-full flex-wrap items-center justify-between gap-3 sm:w-auto sm:justify-end sm:shrink-0">
          {data && <UpcomingClock timeZone={timeZone} />}
          <div className="flex items-center gap-2">
            <Link to="/contents" className="btn-secondary">
              <IconEye className="h-4 w-4" />
              Ver demandas
            </Link>
          </div>
        </div>
      </div>

      {isLoading && (
        <SkeletonCards
          count={4}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        />
      )}
      {isError && <ErrorState message={(error as Error)?.message} />}
      {data && (
        <div className="space-y-5">
          {/* Band: "Atenção agora" + KPI tiles share one row on wide screens so
              the work list sits higher, above the fold. */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Primary attention panel (2/3) */}
            <div className="lg:col-span-2">
          {data.needingAttention.length > 0 || convNeedsAttention > 0 ? (
            <Card className="border-l-4 border-l-[var(--looply-color-status-warning)]">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--looply-color-status-warning)]/10 text-[var(--looply-color-status-warning)]">
                  <IconAlertCircle className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm font-semibold text-[var(--looply-color-text-primary)]">Precisam de você agora</h2>
                  <p className="mt-0.5 text-xs text-[var(--looply-color-text-muted)]">
                    {data.needingAttention.length} {data.needingAttention.length === 1 ? "demanda pendente" : "demandas pendentes"}
                  </p>
                  {convNeedsAttention > 0 && (
                    <Link
                      to={inboxAttentionHref}
                      className="mt-2.5 flex items-center justify-between gap-3 rounded-lg bg-[var(--looply-color-status-warning)]/10 px-2.5 py-2 transition-colors hover:bg-[var(--looply-color-status-warning)]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--looply-color-focus)]"
                    >
                      <span className="text-sm font-medium text-[var(--looply-color-text-primary)]">
                        {convNeedsAttention} {convNeedsAttention === 1 ? "conversa precisa de resposta" : "conversas precisam de resposta"}
                      </span>
                      <IconChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--looply-color-text-muted)]" />
                    </Link>
                  )}
                  <ul className="mt-2.5 space-y-1.5">
                    {data.needingAttention.slice(0, PENDING_LIMIT).map((c) => (
                      <li key={c.id}>
                        <Link
                          to={`/contents/${c.id}`}
                          className="flex items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 transition-colors hover:bg-[var(--looply-color-bg-subtle)]"
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
                  {data.needingAttention.length > PENDING_LIMIT && (
                    <Link
                      to={attentionHref}
                      className="mt-3 inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-[var(--looply-color-action-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--looply-color-focus)]"
                    >
                      Ver todas as demandas
                    </Link>
                  )}
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
                    Nenhuma demanda pendente no momento.
                  </p>
                </div>
              </div>
            </Card>
          )}
            </div>

            {/* Attendance KPI tiles (1/3), 2×2, top-aligned — core is WhatsApp +
                agenda, so these lead and each links to the right place. */}
            <div className="grid grid-cols-2 gap-3 lg:col-span-1 lg:self-start">
            <CompactMetric
              label="Precisam de atenção"
              value={convNeedsAttention}
              icon={<IconAlertCircle className="h-4 w-4" />}
              color="amber"
              to={inboxAttentionHref}
            />
            <CompactMetric
              label="Conversas hoje"
              value={conversationsToday}
              icon={<IconSend className="h-4 w-4" />}
              color="blue"
              to="/inbox"
            />
            <CompactMetric
              label="Agendamentos hoje"
              value={appointmentsToday}
              icon={<IconClock className="h-4 w-4" />}
              color="violet"
              to="/calendar"
            />
            <CompactMetric
              label="Demandas ativas"
              value={activeDemands}
              icon={<IconTrendingUp className="h-4 w-4" />}
              color="emerald"
              to="/contents"
            />
            </div>
          </div>

          {/* Main content: asymmetric 2-col */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
            {/* Left: In progress (~65%) */}
            <div className="lg:col-span-3">
              <Card className="p-0">
                <div className="flex items-center justify-between border-b border-[var(--looply-color-border-default)] px-5 py-3.5">
                  <h2 className="text-sm font-semibold text-[var(--looply-color-text-primary)]">Demandas em andamento</h2>
                  <Link to="/contents" className="text-xs font-semibold text-[var(--looply-color-action-primary)] hover:underline">
                    Ver todas as demandas
                  </Link>
                </div>
                {data.recentContents.length === 0 ? (
                  <div className="px-5 py-10">
                    <EmptyState
                      title="Nenhuma demanda ainda"
                      description="As demandas aparecerão aqui."
                      action={
                        <Link to="/contents" className="btn-primary">
                          <IconEye className="h-4 w-4" />
                          Ver demandas
                        </Link>
                      }
                    />
                  </div>
                ) : (
                  <ul className="divide-y divide-[var(--looply-color-border-default)]">
                    {data.recentContents.slice(0, ACTIVE_DEMAND_LIMIT).map((c) => (
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

            {/* Right: Upcoming appointments (~35%) */}
            <div className="lg:col-span-2">
              <Card className="p-0">
                <div className="flex items-center justify-between border-b border-[var(--looply-color-border-default)] px-5 py-3.5">
                  <h2 className="text-sm font-semibold text-[var(--looply-color-text-primary)]">Próximas agendas</h2>
                  <Link to="/calendar" className="text-xs font-semibold text-[var(--looply-color-action-primary)] hover:underline">
                    Ver agenda completa
                  </Link>
                </div>
                {upcomingEvents.length === 0 ? (
                  <div className="px-5 py-6 text-center">
                    <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--looply-color-bg-subtle)] text-[var(--looply-color-text-muted)]">
                      <IconClock className="h-4 w-4" />
                    </div>
                    <p className="text-xs font-medium text-[var(--looply-color-text-primary)]">Nenhuma agenda próxima</p>
                    <p className="mt-0.5 text-xs text-[var(--looply-color-text-muted)]">
                      Os próximos agendamentos aparecerão aqui.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--looply-color-border-default)]">
                    {upcomingEvents.map((ev) => (
                      <Link
                        key={ev.id}
                        to={ev.jobId ? `/contents/${ev.jobId}` : ev.appointmentId ? "/calendar" : "/contents"}
                        className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-[var(--looply-color-bg-subtle)]"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-medium text-[var(--looply-color-text-primary)]">
                            {formatAppointmentLine(ev.at, timeZone)}
                          </div>
                          <div className="truncate text-xs text-[var(--looply-color-text-muted)]">
                            {ev.title}
                            {ev.client?.name ? ` · ${ev.client.name}` : ""}
                          </div>
                        </div>
                        <IconChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--looply-color-text-muted)]" />
                      </Link>
                    ))}
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
  to,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  color: "amber" | "violet" | "emerald" | "blue";
  to?: string;
}) {
  const colorMap = {
    amber: "bg-[var(--looply-color-status-warning)]/10 text-[var(--looply-color-status-warning)]",
    violet: "bg-[var(--looply-color-action-secondary)]/15 text-[var(--looply-color-action-secondary)]",
    emerald: "bg-[var(--looply-color-status-success)]/10 text-[var(--looply-color-status-success)]",
    blue: "bg-[var(--looply-color-action-primary)]/10 text-[var(--looply-color-action-primary)]",
  };
  const inner = (
    <div className="flex items-center gap-2.5">
      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${colorMap[color]}`}>
        {icon}
      </div>
      <div>
        <div className="text-lg font-bold text-[var(--looply-color-text-primary)] leading-tight">{value}</div>
        <div className="text-[11px] text-[var(--looply-color-text-muted)]">{label}</div>
      </div>
    </div>
  );
  if (to) {
    return (
      <Link
        to={to}
        aria-label={`${label}: ${value}`}
        className="card block p-3.5 transition-colors hover:border-[var(--looply-color-border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--looply-color-focus)]"
      >
        {inner}
      </Link>
    );
  }
  return <div className="card p-3.5">{inner}</div>;
}

function ClientDot({ color }: { color?: string | null }) {
  return (
    <span
      className="inline-block h-2 w-2 rounded-full shrink-0"
      style={{ backgroundColor: color || "var(--looply-color-text-muted)" }}
    />
  );
}

function FormatIcon({ format }: { format: string }) {
  switch (format) {
    case "POST":
    case "CAROUSEL":
    case "IMAGE":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
        </svg>
      );
    case "STORY":
    case "REELS":
    case "VIDEO":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="6" y="2" width="12" height="20" rx="3" />
        </svg>
      );
    default:
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
  }
}
