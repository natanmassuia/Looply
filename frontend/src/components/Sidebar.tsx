import { useState, useEffect } from "react";
import { NavLink, Link } from "react-router-dom";
import {
  IconDashboard,
  IconContents,
  IconCalendar,
  IconClients,
  IconInbox,
  IconTeam,
  IconSettings,
} from "./Icons";
import { Logo } from "./Logo";
import { useUIStore } from "../lib/store";

export interface NavItem {
  to: string;
  label: string;
  short: string;
  Icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
  mobilePlacement: "primary" | "secondary";
}

export const NAV: NavItem[] = [
  { to: "/dashboard", label: "Visão geral", short: "Visão geral", Icon: IconDashboard, end: true, mobilePlacement: "primary" },
  { to: "/clients", label: "Clientes", short: "Clientes", Icon: IconClients, end: true, mobilePlacement: "primary" },
  { to: "/contents", label: "Demandas", short: "Demandas", Icon: IconContents, end: false, mobilePlacement: "primary" },
  { to: "/calendar", label: "Agenda", short: "Agenda", Icon: IconCalendar, end: true, mobilePlacement: "primary" },
  { to: "/conversations", label: "Conversas", short: "Conversas", Icon: IconInbox, end: false, mobilePlacement: "secondary" },
  { to: "/team", label: "Equipe", short: "Equipe", Icon: IconTeam, end: true, mobilePlacement: "secondary" },
  { to: "/settings", label: "Configurações", short: "Configurações", Icon: IconSettings, end: true, mobilePlacement: "secondary" },
];

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Proprietário",
  ADMIN: "Administrador",
  CONTENT_MANAGER: "Gerente de conteúdo",
  EDITOR: "Editor",
  SOCIAL_MEDIA: "Social media",
  DESIGNER: "Designer",
};

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0] ?? "")
      .join("")
      .toUpperCase() || "·"
  );
}

export default function Sidebar({
  user,
  role,
  workspaceName,
  companyLogoUrl,
  onLogout,
  logoutPending = false,
  onOpenMyAccount,
}: {
  user?: { name: string; email?: string; avatarUrl?: string | null } | null;
  role?: string;
  workspaceName?: string | null;
  companyLogoUrl?: string | null;
  onLogout?: () => void;
  logoutPending?: boolean;
  onOpenMyAccount?: () => void;
}) {
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const name = user?.name ?? null;

  useEffect(() => {
    if (!accountMenuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAccountMenuOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [accountMenuOpen]);

  return (
    <aside
      aria-label="Menu principal"
      className={`relative hidden shrink-0 flex-col border-r border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] transition-all duration-200 md:flex ${
        sidebarCollapsed ? "w-[72px]" : "w-60"
      }`}
    >
      {/* Brand — fixed Looply product mark links to Home. NEVER replaced by
          the workspace/company logo (V1 is not white-label). */}
      <div className={`flex items-center ${sidebarCollapsed ? "justify-center px-3" : "px-5"} py-4`}>
        <Link
          to="/dashboard"
          aria-label="Ir para Visão geral"
          title="Ir para Visão geral"
          className={`flex cursor-pointer items-center rounded-lg transition-colors hover:bg-[var(--looply-color-bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--looply-color-focus)] ${sidebarCollapsed ? "justify-center px-3" : "-mx-2 gap-2.5 px-2"}`}
        >
          <Logo size={38} wordmark={false} />
          {!sidebarCollapsed && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-bold tracking-tight text-[var(--looply-color-text-primary)]">Looply</div>
            </div>
          )}
        </Link>
      </div>

      {/* Workspace identity — separate row below the product brand. Company
          logo/initials + name are workspace identity, clearly distinct. */}
      {!sidebarCollapsed && (
        <div className="mx-3 mb-2 flex items-center gap-2.5 rounded-lg border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-subtle)]/40 px-2.5 py-2">
          {companyLogoUrl ? (
            <img
              src={companyLogoUrl}
              alt={workspaceName || "Logo da empresa"}
              className="h-7 w-7 shrink-0 rounded object-contain border border-[var(--looply-color-border-default)]"
            />
          ) : (
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-[10px] font-bold text-[var(--looply-color-text-brand)]">
              {workspaceName ? initials(workspaceName) : "W"}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-semibold text-[var(--looply-color-text-primary)]">
              {workspaceName || "Workspace"}
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav aria-label="Navegação" className="mt-2 flex-1 space-y-0.5 px-2.5">
        {NAV.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={sidebarCollapsed ? label : undefined}
            className={({ isActive }) =>
              `group flex items-center ${sidebarCollapsed ? "justify-center px-2" : "gap-2.5 px-2.5"} py-2 rounded-lg text-[13px] font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--looply-color-focus)] ${
                isActive
                  ? "bg-[var(--looply-color-bg-subtle)] font-semibold text-[var(--looply-color-text-brand)]"
                  : "text-[var(--looply-color-text-muted)] hover:bg-[var(--looply-color-bg-subtle)] hover:text-[var(--looply-color-text-primary)]"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={`h-[17px] w-[17px] shrink-0 transition-colors ${isActive ? "text-[var(--looply-color-text-brand)]" : "text-[var(--looply-color-text-muted)] group-hover:text-[var(--looply-color-text-primary)]"}`} />
                {!sidebarCollapsed && label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Collapse toggle + Account Footer Area (Figma 04 — App Shell) */}
      <div className="relative border-t border-[var(--looply-color-border-default)] px-2 py-2">
        {/* Toggle button */}
        <button
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? "Expandir sidebar" : "Recolher sidebar"}
          aria-expanded={!sidebarCollapsed}
          className="flex w-full items-center justify-center rounded-lg py-1.5 text-[var(--looply-color-text-muted)] transition-colors hover:bg-[var(--looply-color-bg-subtle)] hover:text-[var(--looply-color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--looply-color-focus)]"
          title={sidebarCollapsed ? "Expandir sidebar" : "Recolher sidebar"}
        >
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform duration-200 ${sidebarCollapsed ? "rotate-180" : ""}`}
          >
            <path d="M11 6l-6 6 6 6" />
            <path d="M17 6l-6 6 6 6" opacity="0.3" />
          </svg>
        </button>

        {/* Account Menu Trigger */}
        <button
          type="button"
          onClick={() => setAccountMenuOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={accountMenuOpen}
          aria-label="Menu da conta"
          className={`flex w-full items-center ${sidebarCollapsed ? "justify-center px-1" : "gap-2.5 px-2"} py-2 rounded-lg transition-colors hover:bg-[var(--looply-color-bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--looply-color-focus)] text-left`}
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full overflow-hidden bg-[var(--looply-color-bg-subtle)]">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-[10px] font-bold text-[var(--looply-color-text-brand)]">
                {name ? initials(name) : "·"}
              </span>
            )}
          </div>
          {!sidebarCollapsed && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] font-semibold text-[var(--looply-color-text-primary)]">
                {name ?? "·"}
              </div>
              <div className="truncate text-[10.5px] text-[var(--looply-color-text-muted)]">
                {role ? (ROLE_LABEL[role] ?? "Equipe") : "·"}
              </div>
            </div>
          )}
        </button>

        {/* Account Menu Dropdown */}
        {accountMenuOpen && (
          <>
            <div
              aria-hidden="true"
              onClick={() => setAccountMenuOpen(false)}
              className="fixed inset-0 z-40 cursor-default"
            />
            <div
              role="menu"
              aria-label="Menu da conta"
              className={`absolute bottom-full mb-2 z-50 rounded-xl border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] p-1.5 shadow-looply-lg ${
                sidebarCollapsed ? "left-2 w-52" : "left-2 right-2"
              }`}
            >
              <div className="border-b border-[var(--looply-color-border-default)] px-3 py-2">
                <div className="truncate text-[12px] font-bold text-[var(--looply-color-text-primary)]">
                  {name ?? "Minha conta"}
                </div>
                {user?.email && (
                  <div className="truncate text-[11px] text-[var(--looply-color-text-muted)]">
                    {user.email}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setAccountMenuOpen(false);
                  onOpenMyAccount?.();
                }}
                className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[12.5px] font-medium text-[var(--looply-color-text-primary)] hover:bg-[var(--looply-color-bg-subtle)] transition-colors text-left"
              >
                Minha conta
              </button>

              <Link
                to="/settings"
                onClick={() => setAccountMenuOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-[12.5px] font-medium text-[var(--looply-color-text-primary)] hover:bg-[var(--looply-color-bg-subtle)] transition-colors"
              >
                Configurações
              </Link>

              <button
                type="button"
                onClick={() => {
                  setAccountMenuOpen(false);
                  onLogout?.();
                }}
                disabled={logoutPending}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[12.5px] font-medium text-[var(--looply-color-status-danger)] hover:bg-[var(--looply-color-bg-subtle)] transition-colors disabled:opacity-50"
              >
                {logoutPending ? "Saindo..." : "Sair do Looply"}
              </button>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
