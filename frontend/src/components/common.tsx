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
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        {crumbs && (
          <div className="mb-1.5">
            <Breadcrumb items={crumbs} />
          </div>
        )}
        <h1 className="text-xl font-bold tracking-tight text-[var(--looply-foreground)]">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-sm text-[var(--looply-muted-foreground)]">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`card p-5 ${className}`}>{children}</div>;
}

export function CardCompact({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`card p-4 ${className}`}>{children}</div>;
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-[var(--looply-faint-foreground)]">
      <svg className="h-6 w-6 animate-spin text-brand-600" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
        <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--looply-border)] bg-[var(--looply-surface)] px-6 py-14 text-center">
      <div className="text-[15px] font-semibold text-[var(--looply-foreground)]">{title}</div>
      {description && <p className="mt-1.5 max-w-sm text-sm text-[var(--looply-muted-foreground)]">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--looply-danger)]/20 bg-[var(--looply-danger-bg)] px-6 py-14 text-center">
      <div className="text-[15px] font-semibold text-[var(--looply-danger)]">Algo deu errado</div>
      <p className="mt-1.5 max-w-sm text-sm text-[var(--looply-danger)]/80">
        {message ?? "Não foi possível carregar os dados. Tente novamente."}
      </p>
    </div>
  );
}

export function MediaPreview({
  url,
  alt,
  className = "",
}: {
  url?: string | null;
  alt?: string;
  className?: string;
}) {
  if (!url) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 bg-[var(--looply-surface-muted)] text-[var(--looply-faint-foreground)] ${className}`}
      >
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="M21 15l-5-5L5 21" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-xs">Sem mídia</span>
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
      <div className="text-xs font-medium uppercase tracking-wide text-[var(--looply-muted-foreground)]">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${accent ?? "text-[var(--looply-foreground)]"}`}>{value}</div>
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
