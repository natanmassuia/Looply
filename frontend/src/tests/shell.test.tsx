import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { readFileSync } from "node:fs";
import Sidebar from "../components/Sidebar";
import AppLayout from "../components/AppLayout";
import { Logo } from "../components/Logo";
import { wrapWithQueryClient } from "../test/utils";

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

  it("AppLayout renders on canvas and reuses the F2 secondary button", () => {
    expect(APPLAYOUT_SRC).toContain("--looply-color-bg-canvas");
    expect(APPLAYOUT_SRC).toContain("btn-secondary");
    expect(APPLAYOUT_SRC).toContain("btn-sm");
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
    expect(screen.getByRole("link", { name: "Jobs" })).toHaveAttribute("href", "/contents");
    expect(screen.getByRole("link", { name: "Agenda" })).toHaveAttribute("href", "/calendar");
    expect(screen.getByRole("link", { name: "Equipe" })).toHaveAttribute("href", "/team");
    expect(screen.getByRole("link", { name: "Configurações" })).toHaveAttribute("href", "/settings");
  });

  it("marks the active route semantically and visually", () => {
    renderShell();
    const dashboard = screen.getByRole("link", { name: "Visão geral" });
    expect(dashboard).toHaveAttribute("aria-current", "page");
    expect(dashboard.className).toContain("--looply-color-text-brand");
    expect(screen.getByRole("link", { name: "Jobs" })).not.toHaveAttribute("aria-current");
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
        <Sidebar user={{ name: "Ana Souza" }} role="ADMIN" />
      </MemoryRouter>,
    );
    expect(screen.getByText("Ana Souza")).toBeTruthy();
    expect(screen.getByText("Administrador")).toBeTruthy();
    expect(screen.queryByText(/Demo/)).toBeNull();
    expect(screen.queryByText(/Natan/)).toBeNull();
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
  it("renders the sidebar and a logout button inside a routed layout", () => {
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
    expect(screen.getByRole("button", { name: "Sair" })).toBeTruthy();
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
            <Route path="/contents" element={<div>jobs</div>} />
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
    // desktop user header stays desktop-only
    expect(APPLAYOUT_SRC).toMatch(/hidden[\s\S]*?md:flex/);
  });

  it("bottom nav exposes the four primary mobile destinations with Figma 90 labels and excludes secondary destinations", () => {
    renderLayout("/dashboard");
    const nav = screen.getByRole("navigation", { name: "Navegação principal" });
    const expected: [string, string][] = [
      ["Visão geral", "/dashboard"],
      ["Clientes", "/clients"],
      ["Jobs", "/contents"],
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