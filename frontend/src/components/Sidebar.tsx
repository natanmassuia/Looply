import { NavLink } from "react-router-dom";
import {
  IconDashboard,
  IconContents,
  IconCalendar,
  IconClients,
  IconTeam,
} from "./Icons";

const NAV = [
  { to: "/dashboard", label: "Dashboard", Icon: IconDashboard, end: true },
  { to: "/contents", label: "Conteúdos", Icon: IconContents, end: false },
  { to: "/calendar", label: "Calendário", Icon: IconCalendar, end: true },
  { to: "/clients", label: "Clientes", Icon: IconClients, end: true },
  { to: "/team", label: "Equipe", Icon: IconTeam, end: true },
];

export default function Sidebar() {
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 font-black text-white shadow-looply-sm">
          L
        </div>
        <div>
          <div className="text-[15px] font-bold tracking-tight text-slate-900">Looply</div>
          <div className="text-[11px] font-medium text-sidebar-text">Fluxo de conteúdo</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="mt-3 flex-1 space-y-0.5 px-3">
        {NAV.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-all duration-150 ${
                isActive
                  ? "bg-sidebar-active font-semibold text-sidebar-text-active shadow-sm"
                  : "text-sidebar-text hover:bg-sidebar-hover hover:text-slate-800"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={`h-[18px] w-[18px] transition-colors ${isActive ? "text-sidebar-text-active" : ""}`} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User area */}
      <div className="border-t border-sidebar-border px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[11px] font-bold text-brand-700">
            NM
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-slate-800">Natan Massuia</div>
            <div className="text-[11px] text-sidebar-text">Administrador · Demo</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
