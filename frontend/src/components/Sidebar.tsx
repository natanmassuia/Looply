import { NavLink } from "react-router-dom";
import {
  IconDashboard,
  IconContents,
  IconCalendar,
  IconClients,
  IconTeam,
} from "./Icons";
import { useUIStore } from "../lib/store";

const NAV = [
  { to: "/dashboard", label: "Dashboard", Icon: IconDashboard, end: true },
  { to: "/contents", label: "Conteúdos", Icon: IconContents, end: false },
  { to: "/calendar", label: "Calendário", Icon: IconCalendar, end: true },
  { to: "/clients", label: "Clientes", Icon: IconClients, end: true },
  { to: "/team", label: "Equipe", Icon: IconTeam, end: true },
];

export default function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUIStore();

  return (
    <aside
      aria-label="Menu principal"
      className={`flex shrink-0 flex-col border-r border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] transition-all duration-200 ${
        sidebarCollapsed ? "w-[72px]" : "w-60"
      }`}
    >
      {/* Brand */}
      <div className={`flex items-center ${sidebarCollapsed ? "justify-center px-3" : "gap-2.5 px-5"} py-5`}>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--looply-color-action-primary)] font-bold text-[var(--looply-color-text-inverse)] text-sm shadow-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
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

        {/* User area */}
        <div className={`flex items-center ${sidebarCollapsed ? "justify-center px-2" : "gap-2.5 px-2"} py-2 rounded-lg`}>
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--looply-color-bg-subtle)] text-[10px] font-bold text-[var(--looply-color-text-brand)]">
            NM
          </div>
          {!sidebarCollapsed && (
            <div className="min-w-0">
              <div className="truncate text-[12.5px] font-semibold text-[var(--looply-color-text-primary)]">Natan Massuia</div>
              <div className="text-[10.5px] text-[var(--looply-color-text-muted)]">Administrador · Demo</div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
