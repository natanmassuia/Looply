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
  IconWhatsApp,
  IconX,
} from "./Icons";
import { Logo } from "./Logo";
import { useUIStore } from "../lib/store";
import { initials, DISPLAY_ROLE_LABEL } from "../lib/format";
import { APP_VERSION, COMMIT_HASH, BUILD_TIME, formatBuildDate } from "../config/version";

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
  { to: "/conversations", label: "Conversas", short: "Conversas", Icon: IconInbox, end: false, mobilePlacement: "primary" },
  { to: "/calendar", label: "Agenda", short: "Agenda", Icon: IconCalendar, end: true, mobilePlacement: "primary" },
  { to: "/contents", label: "Demandas", short: "Demandas", Icon: IconContents, end: false, mobilePlacement: "primary" },
  { to: "/clients", label: "Clientes", short: "Clientes", Icon: IconClients, end: true, mobilePlacement: "secondary" },
  { to: "/whatsapp", label: "WhatsApp", short: "WhatsApp", Icon: IconWhatsApp, end: true, mobilePlacement: "secondary" },
  { to: "/team", label: "Equipe", short: "Equipe", Icon: IconTeam, end: true, mobilePlacement: "secondary" },
  { to: "/settings", label: "Configurações", short: "Configurações", Icon: IconSettings, end: true, mobilePlacement: "secondary" },
];

export default function Sidebar({
  user,
  role,
  workspaceName,
  companyLogoUrl,
  onLogout,
  logoutPending = false,
  onOpenMyAccount,
  mobileOpen = false,
  onCloseMobile,
}: {
  user?: { name: string; email?: string; avatarUrl?: string | null } | null;
  role?: string;
  workspaceName?: string | null;
  companyLogoUrl?: string | null;
  onLogout?: () => void;
  logoutPending?: boolean;
  onOpenMyAccount?: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}) {
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const name = user?.name ?? null;

  useEffect(() => {
    if (!accountMenuOpen && !mobileOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (accountMenuOpen) setAccountMenuOpen(false);
        else if (mobileOpen) onCloseMobile?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [accountMenuOpen, mobileOpen, onCloseMobile]);

  const isCollapsed = sidebarCollapsed && !mobileOpen;
  const primaryNav = NAV.filter((item) => item.to !== "/settings");
  const settingsNav = NAV.find((item) => item.to === "/settings");

  return (
    <>
      {mobileOpen && (
        <div
          aria-hidden="true"
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden"
        />
      )}

      <aside
        aria-label="Menu principal"
        className={`flex-col border-r border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] transition-all duration-200 gap-4 ${
          mobileOpen
            ? "fixed inset-y-0 left-0 z-50 flex w-[280px] max-w-[85vw] p-6 shadow-2xl overflow-y-auto md:relative md:z-auto md:max-w-none md:shadow-none md:overflow-visible"
            : "relative hidden shrink-0 md:flex"
        } ${
          isCollapsed ? "md:w-[72px] md:px-3 md:py-5" : "md:w-[272px] md:p-6"
        }`}
      >
        {/* Brand — fixed Looply product mark links to Home. NEVER replaced by
            the workspace/company logo (V1 is not white-label). */}
        <div className={`flex items-center ${isCollapsed ? "justify-center" : "justify-between"}`}>
          <Link
            to="/dashboard"
            onClick={() => onCloseMobile?.()}
            aria-label="Ir para Visão geral"
            title="Ir para Visão geral"
            className={`flex cursor-pointer items-center rounded-[10px] py-1 transition-colors hover:bg-[var(--looply-color-bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--looply-color-focus)] ${
              isCollapsed ? "justify-center px-2" : "-ml-1.5 gap-2.5 px-1.5"
            }`}
          >
            <Logo size={isCollapsed ? 36 : 42} wordmark={false} />
            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <div className="truncate text-[19px] font-extrabold tracking-tight text-[var(--looply-color-text-primary)] lowercase">
                  Looply
                </div>
              </div>
            )}
          </Link>

          {!isCollapsed && (
            <>
              <button
                type="button"
                onClick={toggleSidebar}
                aria-label="Recolher sidebar"
                aria-expanded={!sidebarCollapsed}
                title="Recolher sidebar"
                className="hidden md:flex h-8 w-8 items-center justify-center rounded-[10px] text-[var(--looply-color-text-muted)] transition-colors hover:bg-[var(--looply-color-bg-subtle)] hover:text-[var(--looply-color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--looply-color-focus)]"
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
                >
                  <path d="M11 6l-6 6 6 6" />
                  <path d="M17 6l-6 6 6 6" opacity="0.35" />
                </svg>
              </button>

              {mobileOpen && (
                <button
                  type="button"
                  onClick={onCloseMobile}
                  aria-label="Fechar menu"
                  title="Fechar menu"
                  className="flex md:hidden h-8 w-8 items-center justify-center rounded-[10px] text-[var(--looply-color-text-muted)] transition-colors hover:bg-[var(--looply-color-bg-subtle)] hover:text-[var(--looply-color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--looply-color-focus)]"
                >
                  <IconX className="h-5 w-5" aria-hidden="true" />
                </button>
              )}
            </>
          )}
        </div>

        {/* Workspace identity — Figma 04 Workspace Switcher card (ESPAÇO + name + circular avatar) */}
        {!isCollapsed ? (
          <div className="flex items-center justify-between gap-3 rounded-[10px] bg-[var(--looply-color-bg-subtle)] px-3.5 py-3">
            <div className="min-w-0 flex-1">
              <div className="typo-eyebrow text-[10px] tracking-[0.08em] text-[var(--looply-color-text-muted)]">
                ESPAÇO
              </div>
              <div className="mt-0.5 truncate text-[13.5px] font-bold text-[var(--looply-color-text-primary)]">
                {workspaceName || "Workspace"}
              </div>
            </div>
            {companyLogoUrl ? (
              <img
                src={companyLogoUrl}
                alt={workspaceName || "Logo da empresa"}
                className="h-8 w-8 shrink-0 rounded-full object-cover border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)]"
              />
            ) : (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--looply-color-coral-100)] text-[11px] font-bold text-[var(--looply-color-text-primary)]">
                {workspaceName ? initials(workspaceName) : "W"}
              </div>
            )}
          </div>
        ) : (
          <div className="flex justify-center">
            {companyLogoUrl ? (
              <img
                src={companyLogoUrl}
                alt={workspaceName || "Logo da empresa"}
                className="h-8 w-8 shrink-0 rounded-full object-cover border border-[var(--looply-color-border-default)]"
              />
            ) : (
              <div
                title={workspaceName || "Workspace"}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--looply-color-coral-100)] text-[11px] font-bold text-[var(--looply-color-text-primary)]"
              >
                {workspaceName ? initials(workspaceName) : "W"}
              </div>
            )}
          </div>
        )}

        {/* Navigation (Figma 03.4 Navigation Item + 04 App Shell) */}
        <nav aria-label="Navegação" className="flex min-h-0 flex-1 flex-col">
          {!isCollapsed && (
            <div className="mb-2 px-1 typo-eyebrow text-[10px] tracking-[0.08em] text-[var(--looply-color-text-muted)]">
              NAVEGAÇÃO
            </div>
          )}

          <div className="space-y-1.5">
            {primaryNav.map(({ to, label, Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={() => onCloseMobile?.()}
                title={isCollapsed ? label : undefined}
                className={({ isActive }) =>
                  `group relative flex h-10 items-center ${
                    isCollapsed ? "justify-center px-2" : "gap-3 px-3"
                  } rounded-[10px] text-[13.5px] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--looply-color-focus)] ${
                    isActive
                      ? "bg-[var(--looply-color-coral-100)] font-semibold text-[var(--looply-color-text-brand)]"
                      : "font-medium text-[var(--looply-color-text-secondary)] hover:bg-[var(--looply-color-bg-subtle)] hover:text-[var(--looply-color-text-primary)]"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && !isCollapsed && (
                      <span
                        aria-hidden="true"
                        className="-ml-1 h-5 w-[3px] shrink-0 rounded-full bg-[var(--looply-color-action-primary)]"
                      />
                    )}
                    <Icon
                      className={`h-[18px] w-[18px] shrink-0 transition-colors ${
                        isActive
                          ? "text-[var(--looply-color-text-primary)]"
                          : "text-[var(--looply-color-text-muted)] group-hover:text-[var(--looply-color-text-primary)]"
                      }`}
                    />
                    {!isCollapsed && (
                      <span className={isActive ? "text-[var(--looply-color-text-primary)]" : ""}>
                        {label}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>

          {/* Bottom-pinned Settings link inside Navigation landmark */}
          {settingsNav && (
            <div className="mt-auto pt-3">
              <NavLink
                to={settingsNav.to}
                end={settingsNav.end}
                onClick={() => onCloseMobile?.()}
                title={isCollapsed ? settingsNav.label : undefined}
                className={({ isActive }) =>
                  `group relative flex h-10 items-center ${
                    isCollapsed ? "justify-center px-2" : "gap-3 px-3"
                  } rounded-[10px] text-[13.5px] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--looply-color-focus)] ${
                    isActive
                      ? "bg-[var(--looply-color-coral-100)] font-semibold text-[var(--looply-color-text-brand)]"
                      : "font-medium text-[var(--looply-color-text-secondary)] hover:bg-[var(--looply-color-bg-subtle)] hover:text-[var(--looply-color-text-primary)]"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && !isCollapsed && (
                      <span
                        aria-hidden="true"
                        className="-ml-1 h-5 w-[3px] shrink-0 rounded-full bg-[var(--looply-color-action-primary)]"
                      />
                    )}
                    <settingsNav.Icon
                      className={`h-[18px] w-[18px] shrink-0 transition-colors ${
                        isActive
                          ? "text-[var(--looply-color-text-primary)]"
                          : "text-[var(--looply-color-text-muted)] group-hover:text-[var(--looply-color-text-primary)]"
                      }`}
                    />
                    {!isCollapsed && (
                      <span className={isActive ? "text-[var(--looply-color-text-primary)]" : ""}>
                        {settingsNav.label}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            </div>
          )}
        </nav>

        {/* Account Footer Area (Figma 04 — App Shell: "A conta mora no rodapé da sidebar") */}
        <div className="relative space-y-2">
          {isCollapsed && (
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label="Expandir sidebar"
              aria-expanded={!sidebarCollapsed}
              title="Expandir sidebar"
              className="flex w-full items-center justify-center rounded-[10px] py-2 text-[var(--looply-color-text-muted)] transition-colors hover:bg-[var(--looply-color-bg-subtle)] hover:text-[var(--looply-color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--looply-color-focus)]"
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
                className="rotate-180"
              >
                <path d="M11 6l-6 6 6 6" />
                <path d="M17 6l-6 6 6 6" opacity="0.35" />
              </svg>
            </button>
          )}

          {/* Account Menu Trigger */}
          <button
            type="button"
            onClick={() => setAccountMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={accountMenuOpen}
            aria-label="Menu da conta"
            className={`flex w-full items-center ${
              isCollapsed ? "justify-center p-1.5" : "gap-2.5 p-3"
            } rounded-[10px] bg-[var(--looply-color-bg-subtle)] text-left transition-colors hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--looply-color-focus)]`}
          >
            <div className="relative shrink-0">
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[var(--looply-color-coral-100)]">
                {user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-[12px] font-bold text-[var(--looply-color-text-primary)]">
                    {name ? initials(name) : "·"}
                  </span>
                )}
              </div>
              <span
                aria-hidden="true"
                className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[var(--looply-color-bg-subtle)] bg-[var(--looply-color-status-success)]"
              />
            </div>

            {!isCollapsed && (
              <>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-bold leading-5 text-[var(--looply-color-text-primary)]">
                    {name ?? "·"}
                  </div>
                  <div className="truncate text-[11.5px] leading-4 text-[var(--looply-color-text-muted)]">
                    {role ? (DISPLAY_ROLE_LABEL[role] ?? "Equipe") : "·"}
                  </div>
                </div>
                <span
                  aria-hidden="true"
                  className="shrink-0 text-[14px] font-bold tracking-widest text-[var(--looply-color-text-muted)]"
                >
                  ···
                </span>
              </>
            )}
          </button>

          {/* Account Menu Dropdown (Figma 04 Account Menu Desktop) */}
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
                className={`absolute bottom-full mb-2 z-50 rounded-[12px] border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] p-2 shadow-[var(--looply-elevation-2)] ${
                  isCollapsed ? "left-0 w-60" : "left-0 right-0"
                }`}
              >
                <div className="border-b border-[var(--looply-color-border-default)] px-3 py-2.5">
                  <div className="truncate text-[13px] font-bold text-[var(--looply-color-text-primary)]">
                    {name ?? "Minha conta"}
                  </div>
                  {user?.email && (
                    <div className="truncate text-[11.5px] text-[var(--looply-color-text-muted)]">
                      {user.email}
                    </div>
                  )}
                </div>

                <div className="mt-1 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      onCloseMobile?.();
                      onOpenMyAccount?.();
                    }}
                    className="flex w-full flex-col rounded-[8px] px-3 py-2 text-left transition-colors hover:bg-[var(--looply-color-bg-subtle)]"
                  >
                    <span className="text-[12.5px] font-semibold text-[var(--looply-color-text-primary)]">
                      Minha conta
                    </span>
                    <span className="text-[11px] text-[var(--looply-color-text-muted)]">
                      Perfil e dados pessoais
                    </span>
                  </button>

                  <Link
                    to="/settings"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      onCloseMobile?.();
                    }}
                    className="flex flex-col rounded-[8px] px-3 py-2 transition-colors hover:bg-[var(--looply-color-bg-subtle)]"
                  >
                    <span className="text-[12.5px] font-semibold text-[var(--looply-color-text-primary)]">
                      Configurações
                    </span>
                    <span className="text-[11px] text-[var(--looply-color-text-muted)]">
                      Empresa e preferências
                    </span>
                  </Link>

                  <button
                    type="button"
                    aria-label="Sair do Looply"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      onCloseMobile?.();
                      onLogout?.();
                    }}
                    disabled={logoutPending}
                    className="flex w-full flex-col rounded-[8px] px-3 py-2 text-left transition-colors hover:bg-[var(--looply-color-bg-subtle)] disabled:opacity-50"
                  >
                    <span className="text-[12.5px] font-semibold text-[var(--looply-color-status-danger)]">
                      {logoutPending ? "Saindo..." : "Sair do Looply"}
                    </span>
                    <span className="text-[11px] text-[var(--looply-color-text-muted)]">
                      Encerrar esta sessão
                    </span>
                  </button>

                  <div className="mt-1 border-t border-[var(--looply-color-border-default)] px-3 pt-2 text-[10.5px] font-mono text-[var(--looply-color-text-muted)] opacity-70">
                    Looply v{APP_VERSION} ({COMMIT_HASH})
                    {BUILD_TIME ? ` · ${formatBuildDate(BUILD_TIME)}` : ""}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {!isCollapsed && (
          <div
            title={BUILD_TIME ? `Build: ${formatBuildDate(BUILD_TIME)}` : undefined}
            className="px-3 pb-1 text-center text-[10px] font-mono text-[var(--looply-color-text-muted)] opacity-50 select-none"
          >
            v{APP_VERSION} ({COMMIT_HASH})
          </div>
        )}
      </aside>
    </>
  );
}
