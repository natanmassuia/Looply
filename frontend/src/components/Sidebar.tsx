import { NavLink } from "react-router-dom";
import {
  IconDashboard,
  IconContents,
  IconCalendar,
  IconClients,
  IconTeam,
  IconSettings,
} from "./Icons";
import { Logo } from "./Logo";
import { useUIStore } from "../lib/store";

// Single canonical navigation registry: shared between desktop Sidebar and
// mobile AppLayout (bottom nav + account menu).
// Mobile derives primary and secondary destinations directly via `mobilePlacement`.
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
  { to: "/contents", label: "Jobs", short: "Jobs", Icon: IconContents, end: false, mobilePlacement: "primary" },
  { to: "/calendar", label: "Agenda", short: "Agenda", Icon: IconCalendar, end: true, mobilePlacement: "primary" },
  { to: "/team", label: "Equipe", short: "Equipe", Icon: IconTeam, end: true, mobilePlacement: "secondary" },
  { to: "/settings", label: "Configurações", short: "Configurações", Icon: IconSettings, end: true, mobilePlacement: "secondary" },
];

// Session identity comes from AppLayout's useMe cache via props — no
// duplicate query, no hardcoded demo user.
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
}: {
  user?: { name: string } | null;
  role?: string;
}) {
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const name = user?.name ?? null;

  return (
    <aside
      aria-label="Menu principal"
      className={`hidden shrink-0 flex-col border-r border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] transition-all duration-200 md:flex ${
        sidebarCollapsed ? "w-[72px]" : "w-60"
      }`}
    >
      {/* Brand — canonical Human Relay symbol; visible text carries the name */}
      <div className={`flex items-center ${sidebarCollapsed ? "justify-center px-3" : "gap-2.5 px-5"} py-5`}>
        <Logo size={42} wordmark={false} />
        {!sidebarCollapsed && (
          <div className="flex-1">
            <div className="text-[14px] font-bold tracking-tight text-[var(--looply-color-text-primary)]">Looply</div>
            <div className="text-[10.5px] font-medium text-[var(--looply-color-text-muted)]">Fluxo de conteúdo</div>
          </div>
        )}
      </div>

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

      {/* Collapse toggle + User area */}
      <div className="border-t border-[var(--looply-color-border-default)] px-2 py-2">
        {/* Toggle button */}
        <button
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? "Expandir sidebar" : "Recolher sidebar"}
          aria-expanded={!sidebarCollapsed}
          className="flex w-full items-center justify-center rounded-lg py-2 text-[var(--looply-color-text-muted)] transition-colors hover:bg-[var(--looply-color-bg-subtle)] hover:text-[var(--looply-color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--looply-color-focus)]"
          title={sidebarCollapsed ? "Expandir sidebar" : "Recolher sidebar"}
        >
          <svg
            aria-hidden="true"
            width="18"
            height="18"
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

        {/* User area — real session identity (props from AppLayout) */}
        <div className={`flex items-center ${sidebarCollapsed ? "justify-center px-2" : "gap-2.5 px-2"} py-2 rounded-lg`}>
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--looply-color-bg-subtle)] text-[10px] font-bold text-[var(--looply-color-text-brand)]">
            {name ? initials(name) : "·"}
          </div>
          {!sidebarCollapsed && (
            <div className="min-w-0">
              <div className="truncate text-[12.5px] font-semibold text-[var(--looply-color-text-primary)]">
                {name ?? "·"}
              </div>
              <div className="text-[10.5px] text-[var(--looply-color-text-muted)]">
                {role ? (ROLE_LABEL[role] ?? "Equipe") : "·"}
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
