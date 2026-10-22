import type { ReactNode } from "react";
import Breadcrumb, { type Crumb } from "./Breadcrumb";

export function PageHeader({
  title,
  subtitle,
  crumbs,
  actions,
}: {
  title: string;
  subtitle?: string;
  crumbs?: Crumb[];
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        {crumbs && (
          <div className="mb-1.5">
            <Breadcrumb items={crumbs} />
          </div>
        )}
        <h1 className="text-[1.35rem] font-bold tracking-tight text-[var(--looply-color-text-primary)]">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-[0.8125rem] leading-relaxed text-[var(--looply-color-text-muted)]">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`card p-5 ${className}`}>{children}</div>;
}

export function CardCompact({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`card p-4 ${className}`}>{children}</div>;
}

export function CardFlush({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`card overflow-hidden p-0 ${className}`}>{children}</div>;
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-[var(--looply-color-text-muted)]">
      <svg className="h-6 w-6 animate-spin text-[var(--looply-color-action-primary)]" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
        <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}

/**
 * Base skeleton block — a pulsing placeholder in the subtle surface tone.
 * Compose these to mirror the real layout so loading states don't shift content.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-[6px] bg-[var(--looply-color-bg-subtle)] ${className}`}
    />
  );
}

/**
 * Row skeletons for list views (avatar + two text lines), matching the dense
 * conversation/list row rhythm. Wrapped in a status region for a11y.
 */
export function SkeletonRows({
  count = 6,
  className = "",
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-label="Carregando…"
      className={`flex flex-col ${className}`}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-2.5 px-3 py-2.5">
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-2.5 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Card skeletons for grid/dashboard views, laid out on the same responsive grid
 * as the real cards so the content doesn't jump when data arrives.
 */
export function SkeletonCards({
  count = 6,
  className = "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3",
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div role="status" aria-label="Carregando…" className={className}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="card space-y-3 p-5"
        >
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-8 w-24 rounded-[8px]" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] px-6 py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--looply-color-bg-subtle)] text-[var(--looply-color-text-muted)]">
        {icon || (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="M21 15l-5-5L5 21" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <div className="text-[0.8125rem] font-semibold text-[var(--looply-color-text-primary)]">{title}</div>
      {description && <p className="mt-1 max-w-sm text-[0.8125rem] text-[var(--looply-color-text-muted)]">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--looply-color-status-danger)]/20 bg-[color-mix(in_srgb,var(--looply-color-status-danger)_8%,var(--looply-color-bg-surface))] px-6 py-12 text-center">
      <div className="text-[0.8125rem] font-semibold text-[var(--looply-color-status-danger)]">Algo deu errado</div>
      <p className="mt-1.5 max-w-sm text-[0.8125rem] text-[var(--looply-color-status-danger)]/80">
        {message ?? "Não foi possível carregar os dados. Tente novamente."}
      </p>
    </div>
  );
}

export function MediaPreview({
  url,
  alt,
  className = "",
  format,
}: {
  url?: string | null;
  alt?: string;
  className?: string;
  format?: string;
}) {
  if (!url) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-[var(--looply-color-bg-subtle)] to-[var(--looply-color-bg-subtle)] text-[var(--looply-color-text-muted)] ${className}`}
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--looply-color-bg-surface)] shadow-sm">
          {format === "REELS" || format === "VIDEO" ? (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="M10 9l5 3-5 3V9z" fill="currentColor" stroke="none" />
            </svg>
          ) : format === "STORY" ? (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="2" width="14" height="20" rx="3" />
              <circle cx="12" cy="18" r="1" fill="currentColor" />
            </svg>
          ) : format === "CAROUSEL" ? (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="14" height="14" rx="2" />
              <rect x="8" y="6" width="14" height="14" rx="2" opacity="0.5" />
              <circle cx="9" cy="11" r="1.5" />
              <path d="M21 17l-4-4-4 4" />
            </svg>
          ) : (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          )}
        </div>
        <div className="text-center">
          <span className="text-xs font-medium">Sem mídia</span>
          <p className="mt-0.5 text-[10px] text-[var(--looply-color-text-muted)]">
            {format ? `Formato: ${format}` : "Aguardando upload"}
          </p>
        </div>
      </div>
    );
  }
  return <img src={url} alt={alt ?? ""} className={`object-cover ${className}`} />;
}

export function KpiCard({
  label,
  value,
  accent,
  href,
}: {
  label: string;
  value: number | string;
  accent?: string;
  href?: string;
}) {
  const content = (
    <div className="card p-4 transition-shadow hover:shadow-looply-md">
      <div className="text-xs font-medium uppercase tracking-wide text-[var(--looply-color-text-muted)]">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${accent ?? "text-[var(--looply-color-text-primary)]"}`}>{value}</div>
    </div>
  );
  if (href) {
    return (
      <a href={href} className="block">
        {content}
      </a>
    );
  }
  return content;
}
