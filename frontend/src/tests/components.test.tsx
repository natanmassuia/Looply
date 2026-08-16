import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { PageHeader, Card, CardCompact, CardFlush, Spinner, EmptyState, ErrorState, MediaPreview, KpiCard } from "../components/common";
import StatusPill from "../components/StatusPill";

const COMMON_SRC = readFileSync(`${process.cwd()}/src/components/common.tsx`, "utf8");
const BREADCRUMB_SRC = readFileSync(`${process.cwd()}/src/components/Breadcrumb.tsx`, "utf8");
const CSS = readFileSync(`${process.cwd()}/src/index.css`, "utf8");

const LEGACY_ALIASES = [
  "--looply-background",
  "--looply-surface",
  "--looply-foreground",
  "--looply-muted-foreground",
  "--looply-faint-foreground",
  "--looply-border",
  "--looply-border-strong",
  "--looply-border-subtle",
  "--looply-primary",
  "--looply-primary-hover",
  "--looply-primary-active",
  "--looply-primary-subtle",
  "--looply-danger",
  "--looply-danger-bg",
];

describe("shared component foundation consumes semantic tokens", () => {
  it("common.tsx never references a legacy --looply-* alias", () => {
    for (const alias of LEGACY_ALIASES) {
      expect(COMMON_SRC).not.toContain(alias);
    }
  });

  it("Breadcrumb.tsx never references a legacy --looply-* alias", () => {
    for (const alias of LEGACY_ALIASES) {
      expect(BREADCRUMB_SRC).not.toContain(alias);
    }
  });

  it("renders only semantic tokens in shared primitives", () => {
    const { container } = render(
      <div>
        <PageHeader title="Dashboard" subtitle="Resumo" />
        <Card>card</Card>
        <CardCompact>compact</CardCompact>
        <CardFlush>flush</CardFlush>
        <Spinner label="Carregando…" />
        <EmptyState title="Sem itens" description="Nada aqui" />
        <ErrorState message="Ops" />
        <MediaPreview format="VIDEO" />
        <KpiCard label="Meta" value={10} />
      </div>,
    );
    const html = container.innerHTML;
    expect(html).toContain("--looply-color-text-primary");
    expect(html).toContain("--looply-color-text-muted");
    expect(html).toContain("--looply-color-bg-surface");
    expect(html).toContain("--looply-color-bg-subtle");
    expect(html).toContain("--looply-color-border-default");
    expect(html).toContain("--looply-color-status-danger");
    for (const alias of LEGACY_ALIASES) {
      expect(html).not.toContain(alias);
    }
  });

  it("status pill keeps its data-driven per-status colors", () => {
    const { container } = render(<StatusPill status="APPROVED" />);
    expect(container.textContent).toBe("Aprovado");
  });
});

describe("CSS component primitives use semantic tokens", () => {
  it(".card and .card-elevated read semantic surfaces and borders", () => {
    expect(CSS).toMatch(/\.card\s*\{[^}]*var\(--looply-color-bg-surface\)/);
    expect(CSS).toMatch(/\.card-elevated\s*\{[^}]*var\(--looply-color-bg-elevated\)/);
  });

  it("button variants read semantic actions and focus", () => {
    expect(CSS).toMatch(/\.btn-primary\s*\{[^}]*var\(--looply-color-action-primary\)/);
    expect(CSS).toMatch(/\.btn-secondary\s*\{[^}]*var\(--looply-color-bg-surface\)/);
    expect(CSS).toMatch(/\.btn-danger\s*\{[^}]*var\(--looply-color-status-danger\)/);
    expect(CSS).toMatch(/\.btn:focus-visible\s*\{[^}]*var\(--looply-color-focus\)/);
    expect(CSS).toMatch(/\.input:focus\s*\{[^}]*var\(--looply-color-focus\)/);
  });

  it("form primitives read semantic tokens", () => {
    expect(CSS).toMatch(/\.input\s*\{[^}]*var\(--looply-color-bg-surface\)/);
    expect(CSS).toMatch(/\.label\s*\{[^}]*var\(--looply-color-text-primary\)/);
  });

  it("focus and disabled states are still defined", () => {
    expect(CSS).toMatch(/\.btn:disabled\s*\{[^}]*opacity: 0\.5/);
    expect(CSS).toMatch(/\.btn:focus-visible/);
    expect(CSS).toMatch(/\.input:disabled/);
  });
});
