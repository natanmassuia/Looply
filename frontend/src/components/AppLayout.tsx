import { useState, useEffect } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import Sidebar, { NAV } from "./Sidebar";
import { Logo } from "./Logo";
import { IconDashboard, IconSettings, IconMenu } from "./Icons";
import { useLogout, useMe } from "../lib/api";
import MyAccountModal from "../features/MyAccountModal";

// Derive mobile primary and secondary navigation from canonical NAV registry.
const MOBILE_PRIMARY = NAV.filter((n) => n.mobilePlacement === "primary");
const MOBILE_SECONDARY = NAV.filter((n) => n.mobilePlacement === "secondary");
const ACCOUNT_NAV = NAV.filter((n) =>
  ["/conversations", "/clients", "/whatsapp", "/team", "/settings"].includes(n.to),
);

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
        className="relative flex items-center gap-1.5 rounded-full bg-[var(--looply-color-coral-100)] px-2.5 py-1 text-[12.5px] font-bold text-[var(--looply-color-text-primary)] transition-colors hover:text-[var(--looply-color-text-brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--looply-color-focus)]"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
        ) : null}
        <span className="px-0.5">{firstName ?? "Conta"}</span>
        <span
          aria-hidden="true"
          className="h-2 w-2 rounded-full bg-[var(--looply-color-status-success)]"
        />
      </button>
      {open && (
        <>
          <div aria-hidden="true" onClick={close} className="fixed inset-0 z-10 cursor-default" />
          <div
            role="menu"
            aria-label="Menu da conta"
            onKeyDown={(e) => e.key === "Escape" && close()}
            className="absolute right-0 z-20 mt-2 w-60 rounded-[12px] border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] p-2 shadow-[var(--looply-elevation-2)]"
          >
            {firstName && (
              <p className="border-b border-[var(--looply-color-border-default)] px-3 py-2 text-[12px] font-bold leading-4 text-[var(--looply-color-text-primary)]">
                {firstName}
              </p>
            )}
            <div className="mt-1 space-y-0.5">
              <button
                type="button"
                onClick={() => {
                  close();
                  onOpenMyAccount();
                }}
                className="block w-full rounded-[8px] px-3 py-2 text-left text-[13px] font-medium text-[var(--looply-color-text-primary)] transition-colors hover:bg-[var(--looply-color-bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--looply-color-focus)]"
              >
                Minha conta
              </button>
              {ACCOUNT_NAV.map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={close}
                  className="block rounded-[8px] px-3 py-2 text-[13px] font-medium text-[var(--looply-color-text-primary)] transition-colors hover:bg-[var(--looply-color-bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--looply-color-focus)]"
                >
                  {label}
                </NavLink>
              ))}
              <button
                type="button"
                onClick={onLogout}
                disabled={logoutPending}
                className="block w-full rounded-[8px] px-3 py-2 text-left text-[13px] font-semibold text-[var(--looply-color-status-danger)] transition-colors hover:bg-[var(--looply-color-bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--looply-color-focus)] disabled:opacity-50"
              >
                {logoutPending ? "Saindo..." : "Sair"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function AppLayout() {
  const logout = useLogout();
  const navigate = useNavigate();
  const location = useLocation();
  const { data } = useMe();
  const [myAccountOpen, setMyAccountOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const activeRole = data?.memberships?.find(
    (m) => m.companyId === data.activeCompanyId,
  )?.role;
  const firstName = data?.user?.name?.split(" ")[0];
  const workspaceName = data?.workspace?.name ?? data?.memberships?.[0]?.companyName;

  const isSecondaryActive = MOBILE_SECONDARY.some(({ to, end }) =>
    end ? location.pathname === to : location.pathname.startsWith(to),
  );

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
      {/* Desktop navigation (md+) & Mobile Drawer overlay */}
      <Sidebar
        user={data?.user}
        role={activeRole}
        workspaceName={workspaceName}
        companyLogoUrl={data?.workspace?.logoUrl}
        onLogout={handleLogout}
        logoutPending={logout.isPending}
        onOpenMyAccount={() => setMyAccountOpen(true)}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar: menu button + brand + home affordance + account menu */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] px-3 md:hidden">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Abrir menu de navegação"
              className="flex h-9 w-9 items-center justify-center rounded-[8px] text-[var(--looply-color-text-secondary)] transition-colors hover:bg-[var(--looply-color-bg-subtle)] hover:text-[var(--looply-color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--looply-color-focus)]"
            >
              <IconMenu className="h-5 w-5" aria-hidden="true" />
            </button>
            <NavLink
              to="/dashboard"
              aria-label="Ir para Visão geral"
              title="Ir para Visão geral"
              className="flex cursor-pointer items-center gap-1.5 rounded-[8px] px-1.5 py-1 transition-colors hover:bg-[var(--looply-color-bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--looply-color-focus)]"
            >
              <Logo size={28} />
              <IconDashboard className="h-4 w-4 text-[var(--looply-color-text-brand)]" aria-hidden="true" />
              <span className="sr-only">Ir para Visão geral</span>
            </NavLink>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <NavLink
              to="/settings"
              aria-label="Configurações"
              title="Configurações"
              className={({ isActive }) =>
                `flex h-9 w-9 items-center justify-center rounded-[10px] transition-colors hover:bg-[var(--looply-color-bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--looply-color-focus)] ${
                  isActive
                    ? "bg-[var(--looply-color-coral-100)] text-[var(--looply-color-text-brand)]"
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
          <div className="mx-auto w-full px-4 py-4 md:p-6">
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
          className="flex shrink-0 gap-1 border-t border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] px-2 pt-1.5 pb-[env(safe-area-inset-bottom)] md:hidden"
        >
          {MOBILE_PRIMARY.map(({ to, short, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex min-h-[52px] flex-1 flex-col items-center justify-center gap-1 rounded-[10px] py-1.5 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--looply-color-focus)] ${
                  isActive
                    ? "bg-[var(--looply-color-coral-100)] text-[var(--looply-color-text-brand)]"
                    : "text-[var(--looply-color-text-muted)] hover:text-[var(--looply-color-text-primary)]"
                }`
              }
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              {short}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Menu"
            aria-expanded={mobileMenuOpen}
            className={`flex min-h-[52px] flex-1 flex-col items-center justify-center gap-1 rounded-[10px] py-1.5 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--looply-color-focus)] ${
              isSecondaryActive
                ? "bg-[var(--looply-color-coral-100)] text-[var(--looply-color-text-brand)]"
                : "text-[var(--looply-color-text-muted)] hover:text-[var(--looply-color-text-primary)]"
            }`}
          >
            <IconMenu className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
            Menu
          </button>
        </nav>
      </div>
    </div>
  );
}
