import { useState, useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import Sidebar, { NAV } from "./Sidebar";
import { Logo } from "./Logo";
import { IconDashboard, IconSettings } from "./Icons";
import { useLogout, useMe } from "../lib/api";
import MyAccountModal from "../features/MyAccountModal";

// Derive mobile primary and secondary navigation from canonical NAV registry.
const MOBILE_PRIMARY = NAV.filter((n) => n.mobilePlacement === "primary");
const MOBILE_SECONDARY = NAV.filter((n) => n.mobilePlacement === "secondary");

// Compact account menu (mobile top bar): Minha conta + Equipe/Configurações + Sair.
function AccountMenu({
  firstName,
  avatarUrl,
  onLogout,
  logoutPending,
  onOpenMyAccount,
}: {
  firstName?: string;
  avatarUrl?: string | null;
  onLogout: () => void;
  logoutPending: boolean;
  onOpenMyAccount: () => void;
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
        className="flex items-center gap-1.5 rounded-full bg-[var(--looply-color-bg-subtle)] px-2 py-1 text-[13px] font-semibold text-[var(--looply-color-text-primary)] transition-colors hover:text-[var(--looply-color-text-brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--looply-color-focus)]"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
        ) : null}
        <span className="px-0.5">{firstName ?? "Conta"}</span>
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
            <button
              type="button"
              onClick={() => {
                close();
                onOpenMyAccount();
              }}
              className="block w-full rounded-lg px-3 py-2 text-left text-[13px] font-medium text-[var(--looply-color-text-primary)] transition-colors hover:bg-[var(--looply-color-bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--looply-color-focus)]"
            >
              Minha conta
            </button>
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
              className="block w-full rounded-lg px-3 py-2 text-left text-[13px] font-medium text-[var(--looply-color-status-danger)] transition-colors hover:bg-[var(--looply-color-bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--looply-color-focus)] disabled:opacity-50"
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
  const navigate = useNavigate();
  const { data } = useMe();
  const [myAccountOpen, setMyAccountOpen] = useState(false);
  const activeRole = data?.memberships?.find(
    (m) => m.companyId === data.activeCompanyId,
  )?.role;
  const firstName = data?.user?.name?.split(" ")[0];
  const workspaceName = data?.workspace?.name ?? data?.memberships?.[0]?.companyName;

  // Logout: server revokes the session, all private cache is cleared, then we
  // navigate to /login immediately — no F5, no second navigation.
  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => navigate("/login", { replace: true }),
      onError: () => navigate("/login", { replace: true }),
    });
  };

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* Desktop navigation (md+). Below md the mobile shell renders instead. */}
      <Sidebar
        user={data?.user}
        role={activeRole}
        workspaceName={workspaceName}
        companyLogoUrl={data?.workspace?.logoUrl}
        onLogout={handleLogout}
        logoutPending={logout.isPending}
        onOpenMyAccount={() => setMyAccountOpen(true)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar: brand + home affordance + account menu */}
        <header className="flex shrink-0 items-center justify-between border-b border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] px-4 py-2.5 md:hidden">
          <NavLink
            to="/dashboard"
            aria-label="Ir para Visão geral"
            title="Ir para Visão geral"
            className="flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-0.5 transition-colors hover:bg-[var(--looply-color-bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--looply-color-focus)]"
          >
            <Logo size={28} />
            <IconDashboard className="h-4 w-4 text-[var(--looply-color-text-brand)]" aria-hidden="true" />
            <span className="sr-only">Ir para Visão geral</span>
          </NavLink>
          <div className="flex shrink-0 items-center gap-1">
            <NavLink
              to="/settings"
              aria-label="Configurações"
              title="Configurações"
              className={({ isActive }) =>
                `flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-[var(--looply-color-bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--looply-color-focus)] ${
                  isActive
                    ? "text-[var(--looply-color-text-brand)]"
                    : "text-[var(--looply-color-text-muted)] hover:text-[var(--looply-color-text-primary)]"
                }`
              }
            >
              <IconSettings className="h-[18px] w-[18px]" aria-hidden="true" />
            </NavLink>
            <AccountMenu
              firstName={firstName}
              avatarUrl={data?.user?.avatarUrl}
              onLogout={handleLogout}
              logoutPending={logout.isPending}
              onOpenMyAccount={() => setMyAccountOpen(true)}
            />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-[var(--looply-color-bg-canvas)]">
          <div className="mx-auto w-full px-4 py-4 md:px-6 md:py-6 lg:px-8">
            <Outlet />
          </div>
        </main>

        <MyAccountModal
          isOpen={myAccountOpen}
          onClose={() => setMyAccountOpen(false)}
        />

        {/* Mobile primary navigation — in flow (no fixed overlay, content is
            never hidden behind it). Sticky-by-position via shrink-0 inside the
            locked h-dvh shell: always reachable without scrolling. Safe-area
            inset padding so iOS/Android gesture bar never overlaps. */}
        <nav
          aria-label="Navegação principal"
          className="flex shrink-0 border-t border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] pb-[env(safe-area-inset-bottom)] md:hidden"
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
