import { useState, useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";
import Sidebar, { NAV } from "./Sidebar";
import { Logo } from "./Logo";
import { useLogout, useMe } from "../lib/api";

// Derive mobile primary and secondary navigation from canonical NAV registry.
const MOBILE_PRIMARY = NAV.filter((n) => n.mobilePlacement === "primary");
const MOBILE_SECONDARY = NAV.filter((n) => n.mobilePlacement === "secondary");

// Compact account menu (mobile top bar): Equipe + Sair. No focus trap —
// Escape closes, backdrop closes, links close on navigate.
function AccountMenu({
  firstName,
  onLogout,
  logoutPending,
}: {
  firstName?: string;
  onLogout: () => void;
  logoutPending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Conta"
        className="rounded-full bg-[var(--looply-color-bg-subtle)] px-3 py-1.5 text-[13px] font-semibold text-[var(--looply-color-text-primary)] transition-colors hover:text-[var(--looply-color-text-brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--looply-color-focus)]"
      >
        {firstName ?? "Conta"}
      </button>
      {open && (
        <>
          <div aria-hidden="true" onClick={close} className="fixed inset-0 z-10 cursor-default" />
          <div
            role="menu"
            aria-label="Menu da conta"
            onKeyDown={(e) => e.key === "Escape" && close()}
            className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] p-1.5 shadow-looply-md"
          >
            {firstName && (
              <p className="px-3 py-2 text-[12px] leading-4 text-[var(--looply-color-text-muted)]">
                {firstName}
              </p>
            )}
            {MOBILE_SECONDARY.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                onClick={close}
                className="block rounded-lg px-3 py-2 text-[13px] font-medium text-[var(--looply-color-text-primary)] transition-colors hover:bg-[var(--looply-color-bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--looply-color-focus)]"
              >
                {label}
              </NavLink>
            ))}
            <button
              type="button"
              onClick={onLogout}
              disabled={logoutPending}
              className="block w-full rounded-lg px-3 py-2 text-left text-[13px] font-medium text-[var(--looply-color-text-primary)] transition-colors hover:bg-[var(--looply-color-bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--looply-color-focus)] disabled:opacity-50"
            >
              {logoutPending ? "Saindo..." : "Sair"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function AppLayout() {
  const logout = useLogout();
  const { data } = useMe();
  const activeRole = data?.memberships?.find(
    (m) => m.companyId === data.activeCompanyId,
  )?.role;
  const firstName = data?.user?.name?.split(" ")[0];

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop navigation (md+). Below md the mobile shell renders instead. */}
      <Sidebar user={data?.user} role={activeRole} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar: brand + account menu (compact by design) */}
        <header className="flex shrink-0 items-center justify-between border-b border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] px-4 py-2.5 md:hidden">
          <Logo size={32} />
          <AccountMenu
            firstName={firstName}
            onLogout={() => logout.mutate()}
            logoutPending={logout.isPending}
          />
        </header>

        <main className="flex-1 overflow-y-auto bg-[var(--looply-color-bg-canvas)]">
          <div className="mx-auto w-full px-4 py-4 md:px-6 md:py-6 lg:px-8">
            <div className="mb-4 hidden items-center justify-end gap-3 text-sm md:flex">
              <span className="text-[var(--looply-color-text-muted)]">{data?.user?.name}</span>
              <button
                onClick={() => logout.mutate()}
                disabled={logout.isPending}
                className="btn-secondary btn-sm"
              >
                Sair
              </button>
            </div>
            <Outlet />
          </div>
        </main>

        {/* Mobile primary navigation — in flow (no fixed overlay, content is
            never hidden behind it) */}
        <nav
          aria-label="Navegação principal"
          className="flex shrink-0 border-t border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] md:hidden"
        >
          {MOBILE_PRIMARY.map(({ to, short, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--looply-color-focus)] ${
                  isActive
                    ? "text-[var(--looply-color-text-brand)]"
                    : "text-[var(--looply-color-text-muted)] hover:text-[var(--looply-color-text-primary)]"
                }`
              }
            >
              <Icon className="h-5 w-5 shrink-0" />
              {short}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
