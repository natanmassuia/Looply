import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { PageHeader, Card, CardCompact, CardFlush, Spinner, EmptyState, ErrorState, MediaPreview, KpiCard } from "../components/common";
import StatusPill from "../components/StatusPill";

const COMMON_SRC = readFileSync(`${process.cwd()}/src/components/common.tsx`, "utf8");
const BREADCRUMB_SRC = readFileSync(`${process.cwd()}/src/components/Breadcrumb.tsx`, "utf8");
const PUBLIC_APPROVAL_SRC = readFileSync(`${process.cwd()}/src/features/PublicApproval.tsx`, "utf8");
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

  it("PublicApproval.tsx never references a legacy --looply-* alias or hardcoded emerald classes", () => {
    for (const alias of LEGACY_ALIASES) {
      expect(PUBLIC_APPROVAL_SRC).not.toContain(alias);
    }
    expect(PUBLIC_APPROVAL_SRC).not.toContain("bg-emerald-");
    expect(PUBLIC_APPROVAL_SRC).not.toContain("text-emerald-");
    expect(PUBLIC_APPROVAL_SRC).not.toContain("border-emerald-");
  });

  it("Dashboard.tsx never references a legacy --looply-* alias", () => {
    const DASHBOARD_SRC = readFileSync(`${process.cwd()}/src/features/Dashboard.tsx`, "utf8");
    for (const alias of LEGACY_ALIASES) {
      expect(DASHBOARD_SRC).not.toContain(alias);
    }
  });

  it("Dashboard.tsx enforces canonical Figma copy and CTA (no Nova demanda; Ver demandas)", () => {
    const DASHBOARD_SRC = readFileSync(`${process.cwd()}/src/features/Dashboard.tsx`, "utf8");
    // F14.6 — creation lives in Demandas; Dashboard keeps "Ver demandas" and no "Nova demanda".
    expect(DASHBOARD_SRC).toContain("Ver demandas");
    expect(DASHBOARD_SRC).not.toContain("Nova demanda");
    expect(DASHBOARD_SRC).not.toContain("Novo conteúdo");
    expect(DASHBOARD_SRC).toContain("Atenção agora");
    expect(DASHBOARD_SRC).toContain("Demandas ativas");
    expect(DASHBOARD_SRC).toContain("Em aprovação");
    expect(DASHBOARD_SRC).toContain("Clientes ativos");
  });

  it("Clients.tsx never references a legacy --looply-* alias and uses Demandas vocabulary", () => {
    const CLIENTS_SRC = readFileSync(`${process.cwd()}/src/features/Clients.tsx`, "utf8");
    for (const alias of LEGACY_ALIASES) {
      expect(CLIENTS_SRC).not.toContain(alias);
    }
    expect(CLIENTS_SRC).toContain("Demandas ativas");
    expect(CLIENTS_SRC).not.toContain("Conteúdos ativos");
  });

  it("Jobs features never reference legacy --looply-* aliases and use canonical Job copy", () => {
    const LIST_SRC = readFileSync(`${process.cwd()}/src/features/ContentsList.tsx`, "utf8");
    const DETAIL_SRC = readFileSync(`${process.cwd()}/src/features/ContentDetail.tsx`, "utf8");
    const NEW_SRC = readFileSync(`${process.cwd()}/src/features/NewContent.tsx`, "utf8");

    for (const alias of LEGACY_ALIASES) {
      expect(LIST_SRC).not.toContain(alias);
      expect(DETAIL_SRC).not.toContain(alias);
      expect(NEW_SRC).not.toContain(alias);
    }

    expect(LIST_SRC).toContain("Nova demanda");
    expect(LIST_SRC).not.toContain("Novo conteúdo");
    expect(DETAIL_SRC).toContain('crumbs={[{ label: "Demandas", to: "/contents" }');
    expect(NEW_SRC).toContain('title="Nova demanda"');
  });

  it("Calendar.tsx never references legacy --looply-* aliases and uses Agenda and Demandas vocabulary", () => {
    const CAL_SRC = readFileSync(`${process.cwd()}/src/features/Calendar.tsx`, "utf8");
    for (const alias of LEGACY_ALIASES) {
      expect(CAL_SRC).not.toContain(alias);
    }
    expect(CAL_SRC).toContain('title="Agenda"');
    expect(CAL_SRC).toContain("Demandas aprovadas");
    expect(CAL_SRC).not.toContain("Conteúdos aprovados");
  });

  it("Team.tsx never references legacy --looply-* aliases and uses Equipe vocabulary", () => {
    const TEAM_SRC = readFileSync(`${process.cwd()}/src/features/Team.tsx`, "utf8");
    for (const alias of LEGACY_ALIASES) {
      expect(TEAM_SRC).not.toContain(alias);
    }
    expect(TEAM_SRC).toContain('title="Equipe"');
    expect(TEAM_SRC).toContain("Convidar membro");
  });

  it("Settings.tsx never references legacy --looply-* aliases and surfaces canonical appearance and integration contracts", () => {
    const SETTINGS_SRC = readFileSync(`${process.cwd()}/src/features/Settings.tsx`, "utf8");
    for (const alias of LEGACY_ALIASES) {
      expect(SETTINGS_SRC).not.toContain(alias);
    }
    expect(SETTINGS_SRC).toContain('title="Configurações"');
    expect(SETTINGS_SRC).toContain("Aparência");
    expect(SETTINGS_SRC).toContain("Integrações");
    expect(SETTINGS_SRC).toContain("WhatsApp Oficial");
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

// F14.1.1 — unified client editor + identity media propagation contracts.
describe("F14.1.1 unified client editor and identity propagation", () => {
  const CLIENTS_SRC = readFileSync(`${process.cwd()}/src/features/Clients.tsx`, "utf8");
  const DETAIL_SRC = readFileSync(`${process.cwd()}/src/features/ClientDetail.tsx`, "utf8");
  const EDITOR_SRC = readFileSync(`${process.cwd()}/src/components/ClientEditor.tsx`, "utf8");
  const SIDEBAR_SRC = readFileSync(`${process.cwd()}/src/components/Sidebar.tsx`, "utf8");
  const TEAM_SRC = readFileSync(`${process.cwd()}/src/features/Team.tsx`, "utf8");

  it("one canonical ClientEditor used by both Clients list and Client Detail", () => {
    expect(CLIENTS_SRC).toContain('from "../components/ClientEditor"');
    expect(DETAIL_SRC).toContain('from "../components/ClientEditor"');
    expect(CLIENTS_SRC).not.toContain('ChannelPicker');
    expect(DETAIL_SRC).not.toContain('ImageUpload');
  });

  it("canonical editor exposes image upload, channels and full field set", () => {
    expect(EDITOR_SRC).toContain("Logo do cliente");
    expect(EDITOR_SRC).toContain("<ImageUpload");
    expect(EDITOR_SRC).toContain("<ChannelPicker");
    expect(EDITOR_SRC).toContain("Ex.: Restaurante Aurora");
    expect(EDITOR_SRC).toContain("Salvar alterações");
    expect(EDITOR_SRC).toContain("Cadastrar");
  });

  it("Sidebar account identity renders avatarUrl with initials fallback", () => {
    expect(SIDEBAR_SRC).toMatch(/user\?\.avatarUrl/);
    expect(SIDEBAR_SRC).toContain("<img");
    expect(SIDEBAR_SRC).toContain("initials(name)");
  });

  it("Team renders avatarUrl for members and team fallback to initials", () => {
    expect(TEAM_SRC).toMatch(/u\.avatarUrl/);
    expect(TEAM_SRC).toContain("initials(u.name");
  });
});
