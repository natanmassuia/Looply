import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { readFileSync } from "node:fs";
import Sidebar from "../components/Sidebar";
import AppLayout from "../components/AppLayout";
import { Logo } from "../components/Logo";
import { wrapWithQueryClient } from "../test/utils";
import * as apiModule from "../lib/api";

const SIDEBAR_SRC = readFileSync(`${process.cwd()}/src/components/Sidebar.tsx`, "utf8");
const APPLAYOUT_SRC = readFileSync(`${process.cwd()}/src/components/AppLayout.tsx`, "utf8");
const LOGO_SRC = readFileSync(`${process.cwd()}/src/components/Logo.tsx`, "utf8");
const AUTHSHELL_SRC = readFileSync(`${process.cwd()}/src/components/AuthShell.tsx`, "utf8");

// Generic pre-brand stacked-layer symbol — must not survive as the brand.
const STACKED_LAYER_PATH = "M12 2L2 7";

const LEGACY_ALIASES = [
  "--looply-background",
  "--looply-surface",
  "--looply-foreground",
  "--looply-muted-foreground",
  "--looply-border",
  "--looply-primary",
  "--looply-danger",
];

const RAW_PALETTE_CLASSES = ["sidebar-", "brand-", "slate-", "neutral-"];

describe("app shell consumes semantic tokens", () => {
  it("Sidebar.tsx never references a legacy --looply-* alias", () => {
    for (const alias of LEGACY_ALIASES) {
      expect(SIDEBAR_SRC).not.toContain(alias);
    }
  });

  it("AppLayout.tsx never references a legacy --looply-* alias", () => {
    for (const alias of LEGACY_ALIASES) {
      expect(APPLAYOUT_SRC).not.toContain(alias);
    }
  });

  it("shell never uses the raw sidebar/brand/slate/neutral palette", () => {
    for (const cls of RAW_PALETTE_CLASSES) {
      expect(SIDEBAR_SRC).not.toContain(cls);
      expect(APPLAYOUT_SRC).not.toContain(cls);
    }
  });

  it("AppLayout renders on canvas", () => {
    expect(APPLAYOUT_SRC).toContain("--looply-color-bg-canvas");
  });
});

describe("canonical Human Relay brand (FR1-R1B)", () => {
  it("Logo is the single geometry authority — canonical relay paths, fixed brand colors", () => {
    expect(LOGO_SRC).toContain('stroke="#F06D55"');
    expect(LOGO_SRC).toContain('stroke="#F3B84B"');
    expect(LOGO_SRC).toContain('fill="#2A171F"');
    expect(LOGO_SRC).toContain('viewBox="0 0 168 168"');
    expect(LOGO_SRC).not.toContain(STACKED_LAYER_PATH);
  });

  it("Sidebar and AuthShell consume Logo; no duplicated brand SVG anywhere", () => {
    expect(SIDEBAR_SRC).toContain('from "./Logo"');
    expect(SIDEBAR_SRC).not.toContain(STACKED_LAYER_PATH);
    expect(AUTHSHELL_SRC).toContain('from "./Logo"');
    expect(AUTHSHELL_SRC).not.toContain(STACKED_LAYER_PATH);
  });

  it("lockup announces the brand exactly once; symbol-only is decorative", () => {
    const lockup = render(<Logo size={48} />);
    expect(lockup.getByRole("img", { name: "Looply" })).toBeTruthy();

    const symbolOnly = render(<Logo size={42} wordmark={false} />);
    expect(symbolOnly.container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("symbol preserves 1:1 aspect ratio at canonical sizes", () => {
    for (const size of [48, 42, 32]) {
      const { container } = render(<Logo size={size} wordmark={false} />);
      const svg = container.querySelector("svg")!;
      expect(svg.getAttribute("width")).toBe(String(size));
      expect(svg.getAttribute("height")).toBe(String(size));
    }
  });
});

describe("navigation contract", () => {
  const renderShell = () =>
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Sidebar />
      </MemoryRouter>,
    );

  it("exposes the six expected destinations in canonical product order", () => {
    renderShell();
    expect(screen.getByRole("link", { name: "Visão geral" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: "Clientes" })).toHaveAttribute("href", "/clients");
    expect(screen.getByRole("link", { name: "Demandas" })).toHaveAttribute("href", "/contents");
    expect(screen.getByRole("link", { name: "Agenda" })).toHaveAttribute("href", "/calendar");
    expect(screen.getByRole("link", { name: "Equipe" })).toHaveAttribute("href", "/team");
    expect(screen.getByRole("link", { name: "Configurações" })).toHaveAttribute("href", "/settings");
  });

  it("marks the active route semantically and visually", () => {
    renderShell();
    const dashboard = screen.getByRole("link", { name: "Visão geral" });
    expect(dashboard).toHaveAttribute("aria-current", "page");
    expect(dashboard.className).toContain("--looply-color-text-brand");
    expect(screen.getByRole("link", { name: "Demandas" })).not.toHaveAttribute("aria-current");
  });

  it("labels the navigation region", () => {
    renderShell();
    expect(screen.getByRole("navigation", { name: "Navegação" })).toBeTruthy();
  });

  it("collapse toggle is accessible and reflects state", () => {
    renderShell();
    const toggle = screen.getByRole("button", { name: "Recolher sidebar" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  it("renders the real session identity — never demo or hardcoded users", () => {
    render(
      <MemoryRouter>
        <Sidebar user={{ name: "Marina Silva", email: "marina@agencia.com" }} role="ADMIN" />
      </MemoryRouter>,
    );
    expect(screen.getByText("Marina Silva")).toBeTruthy();
    expect(screen.getByText("Administrador")).toBeTruthy();
  });

  it("without a session yet, shows a neutral placeholder instead of inventing identity", () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );
    expect(screen.queryByText(/Demo|Natan/)).toBeNull();
    expect(screen.queryByText(/Administrador/)).toBeNull();
  });
});

describe("AppLayout shell", () => {
  it("renders the sidebar inside a routed layout", () => {
    const { wrapper } = wrapWithQueryClient(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<div>conteúdo</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    render(<>{wrapper}</>);
    expect(screen.getAllByRole("link", { name: "Visão geral" })).toHaveLength(2);
    expect(screen.getByText("conteúdo")).toBeTruthy();
  });
});

// ── Mobile app shell (FR1-R2 · Figma 04/90) ───────────────────────────────
describe("mobile app shell", () => {
  const renderLayout = (path: string) => {
    const { wrapper } = wrapWithQueryClient(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<div>conteúdo</div>} />
            <Route path="/contents" element={<div>demandas</div>} />
            <Route path="/clients" element={<div>clientes</div>} />
            <Route path="/calendar" element={<div>agenda</div>} />
            <Route path="/team" element={<div>equipe</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    return render(<>{wrapper}</>);
  };

  it("desktop navigation never occupies layout below md (class contract)", () => {
    expect(SIDEBAR_SRC).toMatch(/hidden[\s\S]*?md:flex/);
  });

  it("mobile top bar and bottom navigation are hidden from desktop (class contract)", () => {
    expect(APPLAYOUT_SRC).toMatch(/md:hidden/);
  });

  it("bottom nav exposes the four primary mobile destinations with Figma 90 labels and excludes secondary destinations", () => {
    renderLayout("/dashboard");
    const nav = screen.getByRole("navigation", { name: "Navegação principal" });
    const expected: [string, string][] = [
      ["Visão geral", "/dashboard"],
      ["Clientes", "/clients"],
      ["Demandas", "/contents"],
      ["Agenda", "/calendar"],
    ];
    for (const [name, href] of expected) {
      expect(within(nav).getByRole("link", { name })).toHaveAttribute("href", href);
    }
    // Equipe and Aprovações are NOT in primary bottom nav
    expect(within(nav).queryByRole("link", { name: "Equipe" })).toBeNull();
    expect(within(nav).queryByRole("link", { name: /Aprovações|Aprovar/i })).toBeNull();
    expect(within(nav).queryByRole("link", { name: /Configurações|Ajustes/i })).toBeNull();
  });

  it("marks the active mobile route semantically", () => {
    renderLayout("/dashboard");
    const nav = screen.getByRole("navigation", { name: "Navegação principal" });
    expect(within(nav).getByRole("link", { name: "Visão geral" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("account menu exposes Equipe, Configurações and Sair; Escape closes; no dead clones or unrouted destinations", async () => {
    const user = userEvent.setup();
    renderLayout("/dashboard");

    await user.click(screen.getByRole("button", { name: "Conta" }));
    const menu = screen.getByRole("menu", { name: "Menu da conta" });
    expect(within(menu).getByRole("link", { name: "Equipe" })).toHaveAttribute("href", "/team");
    expect(within(menu).getByRole("link", { name: "Configurações" })).toHaveAttribute("href", "/settings");
    expect(within(menu).getByRole("button", { name: "Sair" })).toBeTruthy();
    // Aprovações is not invented as a dead route
    expect(within(menu).queryByText(/Aprovações/)).toBeNull();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("clicking a secondary destination closes the menu on navigate", async () => {
    const user = userEvent.setup();
    renderLayout("/dashboard");
    await user.click(screen.getByRole("button", { name: "Conta" }));
    const menu = screen.getByRole("menu", { name: "Menu da conta" });
    await user.click(within(menu).getByRole("link", { name: "Equipe" }));
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByText("equipe")).toBeTruthy();
  });
});

describe("F14 logo home affordance", () => {
  it("desktop Sidebar and mobile header logo links announce 'Ir para Visão geral'", () => {
    expect(SIDEBAR_SRC).toContain('aria-label="Ir para Visão geral"');
    expect(SIDEBAR_SRC).toContain('title="Ir para Visão geral"');
    expect(SIDEBAR_SRC).toContain("cursor-pointer");
    expect(APPLAYOUT_SRC).toContain('aria-label="Ir para Visão geral"');
    expect(APPLAYOUT_SRC).toContain('title="Ir para Visão geral"');
  });

  // F14: a small visible icon next to the mobile brand (sr-only label kept
  // for assistive tech) makes the home affordance discoverable without
  // redesigning the logo or adding visible copy.
  it("mobile logo link renders a co-located home icon for discoverability", () => {
    expect(APPLAYOUT_SRC).toContain("IconDashboard");
    expect(APPLAYOUT_SRC).toMatch(/sr-only[\s\S]{0,80}Ir para Visão geral/);
  });

  it("mobile shell uses dynamic viewport height so the bottom nav is never hidden behind browser chrome", () => {
    expect(APPLAYOUT_SRC).toContain("h-dvh");
    expect(APPLAYOUT_SRC).not.toContain("h-screen");
  });

  it("primary mobile nav is anchored in viewport (no fixed overlay, no document scroll)", () => {
    // Bottom nav is a sibling of <main> inside the h-dvh flex column: it is
    // never behind page content, and main is the only overflow-y-auto child.
    expect(APPLAYOUT_SRC).toContain('overflow-y-auto');
    // Mobile nav uses shrink-0 to stay visible; safe area inset for iOS.
    expect(APPLAYOUT_SRC).toMatch(/Navegação principal[\s\S]{0,300}shrink-0/);
    expect(APPLAYOUT_SRC).toMatch(/pb-\[env\(safe-area-inset-bottom\)\]/);
    expect(APPLAYOUT_SRC).not.toMatch(/Navegação principal[\s\S]{0,200}fixed/);
    expect(APPLAYOUT_SRC).not.toMatch(/Navegação principal[\s\S]{0,200}sticky/);
  });
});

describe("F14.1 mobile Settings entry", () => {
  it("mobile header exposes a direct Configurações link (not only inside account menu)", () => {
    // A dedicated NavLink with IconSettings lives in the always-visible
    // mobile header, so Settings is reachable from any scroll position
    // without opening the account menu.
    expect(APPLAYOUT_SRC).toContain('aria-label="Configurações"');
    expect(APPLAYOUT_SRC).toContain('title="Configurações"');
    expect(APPLAYOUT_SRC).toMatch(/to="\/settings"/);
    expect(APPLAYOUT_SRC).toMatch(/IconSettings className="h-\[18px\] w-\[18px\]" aria-hidden="true"/);
  });

  it("mobile Settings link has a screen-reader label and is not the account menu", () => {
    // Accessible name comes from aria-label (icon is aria-hidden) — no
    // duplicate sr-only label.
    expect(APPLAYOUT_SRC).toContain('aria-label="Configurações"');
    expect(APPLAYOUT_SRC).toContain('aria-hidden="true"');
    // Still keeps Minha conta / account / logout separate concepts.
    expect(APPLAYOUT_SRC).toContain("Minha conta");
    expect(APPLAYOUT_SRC).toContain("Sair");
  });

  it("mobile Settings is NOT added to the primary bottom nav (keeps 4-item contract)", () => {
    expect(APPLAYOUT_SRC).toMatch(/MOBILE_PRIMARY = NAV\.filter\(\(n\) => n\.mobilePlacement === "primary"\)/);
    // The header Settings link and bottom nav are separate: no NavLink to
    // /settings inside the bottom nav markup.
    const bottomNavBlock = APPLAYOUT_SRC.match(/Navegação principal[\s\S]*?<\/nav>/)?.[0] ?? "";
    expect(bottomNavBlock).not.toContain('to="/settings"');
    expect(bottomNavBlock).not.toContain("Configurações");
  });

  it("mobile Settings link marks active route semantically", () => {
    // NavLink adds aria-current at runtime when the location matches. Scope
    // to the mobile header because the desktop Sidebar also renders a
    // "Configurações" link in the same tree.
    const { wrapper } = wrapWithQueryClient(
      <MemoryRouter initialEntries={["/settings"]}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/settings" element={<div>configurações</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    render(<>{wrapper}</>);
    const mobileHeader = screen.getByRole("banner");
    expect(within(mobileHeader).getByRole("link", { name: "Configurações" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});

// F14.6 — logout navigates to /login immediately after server success.
describe("F14.6 logout immediate navigation", () => {
  it("clicks 'Sair do Looply' and calls logout mutate (server session revocation)", async () => {
    const user = userEvent.setup();
    const logoutMutate = vi.fn().mockImplementation((_v, opts) => {
      opts?.onSuccess?.();
      return Promise.resolve({ ok: true });
    });
    vi.spyOn(apiModule, "useLogout").mockReturnValue({
      mutate: logoutMutate,
      mutateAsync: logoutMutate,
      isPending: false,
    } as any);

    const { wrapper } = wrapWithQueryClient(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<div>dashboard</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    render(<>{wrapper}</>);

    // Open account menu (desktop Sidebar) and click Sair.
    await user.click(screen.getByRole("button", { name: "Menu da conta" }));
    await user.click(screen.getByRole("button", { name: "Sair do Looply" }));

    expect(logoutMutate).toHaveBeenCalled();
    // The mutate is invoked with an options object carrying onSuccess (which
    // navigates to /login). Verify onSuccess was wired.
    const arg = logoutMutate.mock.calls[0][1];
    expect(typeof arg?.onSuccess).toBe("function");
  });
});

// F14.6.1 — Sidebar identity: Looply product brand is fixed; company/workspace
// identity renders in a SEPARATE row and never replaces the product mark.
describe("F14.6.1 sidebar identity separation", () => {
  function renderSidebar(props: Record<string, unknown> = {}) {
    const { wrapper } = wrapWithQueryClient(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Sidebar {...props} />
      </MemoryRouter>,
    );
    render(<>{wrapper}</>);
  }

  it("always renders the fixed Looply product brand", () => {
    renderSidebar();
    // Product logo mark is always present (Logo component with wordmark=false).
    expect(LOGO_SRC).toContain("wordmark");
    // The product "Looply" label remains.
    expect(screen.getAllByText("Looply").length).toBeGreaterThanOrEqual(1);
  });

  it("renders company logo in the workspace row, NOT replacing the product mark", () => {
    renderSidebar({ workspaceName: "Loyal Tech", companyLogoUrl: "/api/media/file?key=company%2Fc%2Flogo%2F1.png" });
    // Workspace identity row shows the company logo <img>.
    const workspaceImg = screen.getByRole("img");
    expect(workspaceImg).toHaveAttribute(
      "src",
      "/api/media/file?key=company%2Fc%2Flogo%2F1.png",
    );
    // Workspace name shown.
    expect(screen.getByText("Loyal Tech")).toBeInTheDocument();
    // Product "Looply" still present (not replaced by the workspace logo).
    expect(screen.getAllByText("Looply").length).toBeGreaterThanOrEqual(1);
  });

  it("workspace initials fallback when no company logo", () => {
    renderSidebar({ workspaceName: "Loyal Tech" });
    expect(screen.getByText("LT")).toBeInTheDocument(); // initials fallback
    expect(screen.getByText("Loyal Tech")).toBeInTheDocument();
  });
});
