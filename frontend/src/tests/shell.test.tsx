import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { readFileSync } from "node:fs";
import Sidebar from "../components/Sidebar";
import AppLayout from "../components/AppLayout";
import { wrapWithQueryClient } from "../test/utils";

const SIDEBAR_SRC = readFileSync(`${process.cwd()}/src/components/Sidebar.tsx`, "utf8");
const APPLAYOUT_SRC = readFileSync(`${process.cwd()}/src/components/AppLayout.tsx`, "utf8");

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

describe("navigation contract", () => {
  const renderShell = () =>
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Sidebar />
      </MemoryRouter>,
    );

  it("exposes the five expected destinations", () => {
    renderShell();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: "Conteúdos" })).toHaveAttribute("href", "/contents");
    expect(screen.getByRole("link", { name: "Calendário" })).toHaveAttribute("href", "/calendar");
    expect(screen.getByRole("link", { name: "Clientes" })).toHaveAttribute("href", "/clients");
    expect(screen.getByRole("link", { name: "Equipe" })).toHaveAttribute("href", "/team");
  });

  it("marks the active route semantically and visually", () => {
    renderShell();
    const dashboard = screen.getByRole("link", { name: "Dashboard" });
    expect(dashboard).toHaveAttribute("aria-current", "page");
    expect(dashboard.className).toContain("--looply-color-text-brand");
    expect(screen.getByRole("link", { name: "Conteúdos" })).not.toHaveAttribute("aria-current");
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
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sair" })).toBeTruthy();
    expect(screen.getByText("conteúdo")).toBeTruthy();
  });
});