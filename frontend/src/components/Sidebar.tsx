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
  { to: "/contents", label: "Contents", Icon: IconContents, end: false },
  { to: "/calendar", label: "Calendário", Icon: IconCalendar, end: true },
  { to: "/clients", label: "Clientes", Icon: IconClients, end: true },
  { to: "/team", label: "Equipe", Icon: IconTeam, end: true },
];

export default function Sidebar() {
  return (
    <aside className="flex w-64 shrink-0 flex-col bg-navy-900 text-slate-300">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 font-black text-white">
          L
        </div>
        <div>
          <div className="text-base font-bold tracking-tight text-white">Looply</div>
          <div className="text-[11px] font-medium text-slate-400">Fluxo de conteúdo</div>
        </div>
      </div>

      <nav className="mt-2 flex-1 space-y-1 px-3">
        {NAV.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-slate-300 hover:bg-navy-800 hover:text-white"
              }`
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-navy-800 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-700 text-xs font-bold text-slate-200">
            NM
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-white">Natan Massuia</div>
            <div className="text-[11px] text-slate-400">Administrador · Demo</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
