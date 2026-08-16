import { afterEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";

const CSS = readFileSync(`${process.cwd()}/src/index.css`, "utf8");

import {
  SEMANTIC_TOKEN_IDS,
  TOKEN_CSS_VARS,
  BRAND_TOKEN_CSS_VARS,
  type ResolvedTheme,
} from "../theme/types";
import { applyTheme, resetTheme, THEME_ATTR, MODE_ATTR } from "../theme/applyTheme";
import { resolveTheme, resolveCustomTheme, normalizeAppearance } from "../theme/resolveTheme";
import { resolvePresetTokens, BRAND } from "../theme/presets";
import { contrastRatio, darken, isHexColor, lighten, mix, relativeLuminance } from "../theme/color";
import { TYPOGRAPHY } from "../theme/typography";
import { ThemeProvider, useTheme } from "../theme/react";
import { wrapWithQueryClient } from "../test/utils";

const SIX = {
  primary: "#B94738",
  secondary: "#F3B84B",
  accent: "#E0563F",
  surface: "#FFFFFF",
  text: "#2A171F",
  border: "#E8D8D1",
};

function customTheme(base = SIX, mode: "LIGHT" | "DARK" = "LIGHT"): ResolvedTheme {
  return resolveTheme({ preset: "CUSTOM", mode, customColors: base });
}

describe("resolveTheme — preset/mode determinism", () => {
  it("AURA/LIGHT matches the canonical static startup canvas", () => {
    const t = resolveTheme({ preset: "AURA", mode: "LIGHT", customColors: null });
    expect(t.tokens.bgCanvas).toBe("#FFF7F1");
    expect(t.tokens.bgSurface).toBe("#FFFFFF");
  });

  it("AURA/LIGHT primary text is the brand aubergine", () => {
    expect(resolveTheme({ preset: "AURA", mode: "LIGHT", customColors: null }).tokens.textPrimary).toBe("#2A171F");
  });

  it("AURA/DARK canvas is profundidade aubergine, not zinc/black", () => {
    expect(resolveTheme({ preset: "AURA", mode: "DARK", customColors: null }).tokens.bgCanvas).toBe("#2A171F");
    expect(resolveTheme({ preset: "AURA", mode: "DARK", customColors: null }).tokens.bgSurface).toBe("#34202A");
  });

  it("AURA/DARK text brand role is coral-light", () => {
    expect(resolveTheme({ preset: "AURA", mode: "DARK", customColors: null }).tokens.textBrand).toBe("#F58A75");
  });

  it("FLUX/LIGHT is deterministic and warm-toned", () => {
    const a = resolveTheme({ preset: "FLUX", mode: "LIGHT", customColors: null });
    const b = resolveTheme({ preset: "FLUX", mode: "LIGHT", customColors: null });
    expect(a.tokens.bgCanvas).toBe("#FCF5EC");
    expect(a.tokens).toEqual(b.tokens);
  });

  it("PULSE/DARK is deterministic and aubergine-forward", () => {
    const t = resolveTheme({ preset: "PULSE", mode: "DARK", customColors: null });
    expect(t.tokens.bgCanvas).toBe("#1C1116");
    expect(t.tokens.actionPrimary).toBe("#F3B84B");
  });

  it("every preset × mode yields the same stable role set", () => {
    for (const preset of ["AURA", "FLUX", "PULSE"] as const) {
      for (const mode of ["LIGHT", "DARK"] as const) {
        const t = resolveTheme({ preset, mode, customColors: null });
        expect(Object.keys(t.tokens).sort()).toEqual([...SEMANTIC_TOKEN_IDS].sort());
        for (const id of SEMANTIC_TOKEN_IDS) {
          expect(t.tokens[id]).toBeTruthy();
        }
      }
    }
  });

  it("resolved theme echoes preset and mode", () => {
    const t = resolveTheme({ preset: "FLUX", mode: "DARK", customColors: null });
    expect(t.preset).toBe("FLUX");
    expect(t.mode).toBe("DARK");
  });

  it("undefined input resolves to AURA/LIGHT", () => {
    const t = resolveTheme(undefined);
    expect(t.preset).toBe("AURA");
    expect(t.mode).toBe("LIGHT");
  });

  it("null workspace appearance resolves to AURA/LIGHT", () => {
    const t = resolveTheme({ workspace: { appearance: null } });
    expect(t).toEqual(resolveTheme(undefined));
  });
});

describe("resolveTheme — defensive fallbacks", () => {
  it("non-object input falls back to AURA/LIGHT", () => {
    for (const junk of [null, undefined, "aura", 42, [], true]) {
      expect(resolveTheme(junk).preset).toBe("AURA");
      expect(resolveTheme(junk).mode).toBe("LIGHT");
    }
  });

  it("unknown preset falls back to AURA", () => {
    const t = resolveTheme({ preset: "NEON", mode: "DARK", customColors: null });
    expect(t.preset).toBe("AURA");
    expect(t.mode).toBe("DARK");
  });

  it("malformed mode falls back to LIGHT and malformed custom colors to AURA", () => {
    expect(resolveTheme({ preset: "AURA", mode: "MIDNIGHT" as never, customColors: null }).mode).toBe("LIGHT");
    const bad = resolveTheme({ preset: "CUSTOM", mode: "LIGHT", customColors: { primary: "red", surface: "#fff", text: "nope", border: "#000000", accent: "#000000", secondary: "#000000" } });
    expect(bad.preset).toBe("AURA");
  });

  it("CUSTOM preset without valid colors collapses to AURA", () => {
    const t = resolveTheme({ preset: "CUSTOM", mode: "DARK", customColors: null });
    expect(t.preset).toBe("AURA");
  });

  it("CUSTOM with a complete valid palette is preserved", () => {
    const t = customTheme();
    expect(t.preset).toBe("CUSTOM");
    expect(t.mode).toBe("LIGHT");
  });
});

describe("resolveCustomTheme — six-color derivation", () => {
  it("derives the full 19-role semantic set from six colors", () => {
    const t = customTheme();
    expect(SEMANTIC_TOKEN_IDS.every((id) => isHexColor(t.tokens[id]))).toBe(true);
  });

  it("never exposes keys outside the semantic allowlist", () => {
    const t = customTheme();
    for (const key of Object.keys(t.tokens)) {
      expect(SEMANTIC_TOKEN_IDS).toContain(key as never);
    }
  });

  it("action role derives from trusted primary input when it is high-contrast", () => {
    const t = customTheme();
    expect(t.tokens.actionPrimary).toBe(SIX.primary.toUpperCase());
  });

  it("primary text stays AA-readable against canvas and surface", () => {
    const t = customTheme();
    expect(contrastRatio(t.tokens.textPrimary, t.tokens.bgCanvas)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t.tokens.textPrimary, t.tokens.bgSurface)).toBeGreaterThanOrEqual(4.5);
  });

  it("surface is trusted verbatim and canvas is derived from it", () => {
    const t = customTheme({ ...SIX, surface: "#ffffff" });
    expect(t.tokens.bgSurface).toBe("#FFFFFF");
    expect(t.tokens.bgCanvas).not.toBe("#FFFFFF");
    expect(t.tokens.bgCanvas).toBe(mix("#FFFFFF", BRAND.cream100, 0.62));
  });

  it("borders stay distinguishable from canvas", () => {
    const t = customTheme();
    expect(contrastRatio(t.tokens.borderDefault, t.tokens.bgCanvas)).toBeGreaterThanOrEqual(1.5);
  });

  it("light and dark produce different relevant surface roles", () => {
    const light = customTheme(SIX, "LIGHT");
    const dark = customTheme(SIX, "DARK");
    expect(light.tokens.bgCanvas).not.toBe(dark.tokens.bgCanvas);
    expect(dark.tokens.bgCanvas).not.toBe(dark.tokens.bgSurface);
  });

  it("does not mutate the raw input", () => {
    const input = { ...SIX };
    customTheme(input, "DARK");
    expect(input).toEqual(SIX);
  });
});

describe("contrast guarantees", () => {
  it("AURA/LIGHT primary text is AA against surface and canvas", () => {
    const t = resolveTheme({ preset: "AURA", mode: "LIGHT", customColors: null }).tokens;
    expect(contrastRatio(t.textPrimary, t.bgSurface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t.textPrimary, t.bgCanvas)).toBeGreaterThanOrEqual(4.5);
  });

  it("AURA/DARK primary text is AA against the aubergine canvas", () => {
    const t = resolveTheme({ preset: "AURA", mode: "DARK", customColors: null }).tokens;
    expect(contrastRatio(t.textPrimary, t.bgCanvas)).toBeGreaterThanOrEqual(4.5);
  });

  it("button inverse text on a mid-primary is acceptable (>=3.0)", () => {
    const t = customTheme({ ...SIX, primary: "#B94738" });
    expect(contrastRatio(t.tokens.textInverse, t.tokens.actionPrimary)).toBeGreaterThanOrEqual(3.0);
  });

  it("pathological palette resolves safely and deterministically", () => {
    const bad = { primary: "#000000", secondary: "#000000", accent: "#000000", surface: "#000000", text: "#000000", border: "#000000" };
    const a = customTheme(bad, "LIGHT");
    const b = customTheme(bad, "DARK");
    expect(a.tokens).toEqual(resolveCustomTheme(bad, "LIGHT"));
    expect(SEMANTIC_TOKEN_IDS.every((id) => isHexColor(a.tokens[id]))).toBe(true);
    expect(contrastRatio(a.tokens.textPrimary, a.tokens.bgSurface)).toBeGreaterThanOrEqual(3.0);
    expect(b.tokens.bgCanvas).not.toBe(a.tokens.bgCanvas);
  });

  it("color helpers behave at the edges", () => {
    expect(mix("#000000", "#FFFFFF", 0.5)).toBe("#808080");
    expect(lighten("#000000", 1)).toBe("#FFFFFF");
    expect(darken("#FFFFFF", 1)).toBe("#000000");
    expect(contrastRatio("#FFFFFF", "#000000")).toBe(21);
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBe(1);
    expect(relativeLuminance("#000000")).toBe(0);
    expect(relativeLuminance("#FFFFFF")).toBeCloseTo(1, 2);
    expect(isHexColor("#AB12CD")).toBe(true);
    expect(isHexColor("abc123")).toBe(true);
    expect(isHexColor("#AB12C")).toBe(false);
    expect(isHexColor("red")).toBe(false);
    expect(isHexColor(null)).toBe(false);
  });
});

describe("applyTheme — DOM application", () => {
  const root = () => document.documentElement;

  afterEach(() => resetTheme(root()));

  it("sets theme/mode attributes and only allowlisted CSS variables", () => {
    applyTheme(root(), resolveTheme({ preset: "FLUX", mode: "DARK", customColors: null }));
    expect(root()).toHaveAttribute(THEME_ATTR, "flux");
    expect(root()).toHaveAttribute(MODE_ATTR, "dark");
    for (const id of SEMANTIC_TOKEN_IDS) {
      expect(root().style.getPropertyValue(TOKEN_CSS_VARS[id])).toBeTruthy();
    }
  });

  it("ignores unknown keys in tokens (cannot create arbitrary properties)", () => {
    const theme = resolveTheme({ preset: "AURA", mode: "LIGHT", customColors: null });
    applyTheme(root(), { ...theme, tokens: { ...theme.tokens, malicious: "red" } as never });
    expect(root().style.getPropertyValue("--malicious")).toBe("");
    expect(root().style.getPropertyValue("--looply-color-bg-canvas")).toBe("#FFF7F1");
  });

  it("applies lowercase preset/mode attributes", () => {
    applyTheme(root(), resolveTheme({ preset: "PULSE", mode: "LIGHT", customColors: null }));
    expect(root()).toHaveAttribute(THEME_ATTR, "pulse");
    expect(root()).toHaveAttribute(MODE_ATTR, "light");
  });

  it("re-applying overwrites values without leaving stale ones", () => {
    applyTheme(root(), resolveTheme({ preset: "AURA", mode: "LIGHT", customColors: null }));
    applyTheme(root(), resolveTheme({ preset: "FLUX", mode: "DARK", customColors: null }));
    expect(root().style.getPropertyValue("--looply-color-bg-canvas")).toBe("#241710");
  });

  it("resetTheme removes attributes and runtime variables", () => {
    applyTheme(root(), resolveTheme({ preset: "FLUX", mode: "DARK", customColors: null }));
    resetTheme(root());
    expect(root()).not.toHaveAttribute(THEME_ATTR);
    expect(root()).not.toHaveAttribute(MODE_ATTR);
    expect(root().style.getPropertyValue("--looply-color-bg-canvas")).toBe("");
  });

  it("application never accumulates: written properties stay within the allowlist", () => {
    applyTheme(root(), resolveTheme({ preset: "AURA", mode: "LIGHT", customColors: null }));
    const first = new Set(root().style.cssText.split(";").map((s) => s.split(":")[0]?.trim()).filter(Boolean));
    applyTheme(root(), resolveTheme({ preset: "PULSE", mode: "DARK", customColors: null }));
    const second = new Set(root().style.cssText.split(";").map((s) => s.split(":")[0]?.trim()).filter(Boolean));
    for (const prop of [...first, ...second]) {
      expect(Object.values(TOKEN_CSS_VARS)).toContain(prop);
    }
  });
});

let meData: unknown = {
  workspace: { appearance: { preset: "FLUX", mode: "DARK", customColors: null } },
};

vi.mock("../lib/api", () => ({
  useMe: () => ({ data: meData }),
}));

describe("ThemeProvider — hydration", () => {
  afterEach(() => resetTheme(document.documentElement));

  it("useTheme defaults to AURA/LIGHT outside a provider", () => {
    let value: { preset: string; mode: string } | null = null;
    function Probe() {
      value = useTheme();
      return null;
    }
    const { wrapper } = wrapWithQueryClient(<Probe />);
    render(wrapper);
    expect(value).toEqual({ preset: "AURA", mode: "LIGHT" });
  });

  it("hydrates the document root from the authenticated appearance", async () => {
    const { wrapper } = wrapWithQueryClient(
      <ThemeProvider>
        <div data-testid="child" />
      </ThemeProvider>,
    );
    render(wrapper);
    await waitFor(() => expect(document.documentElement).toHaveAttribute(THEME_ATTR, "flux"));
    expect(document.documentElement).toHaveAttribute(MODE_ATTR, "dark");
    expect(document.documentElement.style.getPropertyValue("--looply-color-bg-canvas")).toBe("#241710");
  });

  it("applies the dark-mode AURA override when the session says so", async () => {
    meData = { workspace: { appearance: { preset: "AURA", mode: "DARK", customColors: null } } };
    const { wrapper } = wrapWithQueryClient(
      <ThemeProvider>
        <div data-testid="child" />
      </ThemeProvider>,
    );
    render(wrapper);
    await waitFor(() => expect(document.documentElement).toHaveAttribute(MODE_ATTR, "dark"));
    expect(document.documentElement.style.getPropertyValue("--looply-color-bg-canvas")).toBe("#2A171F");
  });

  it("resets the document to the static startup state on unmount", async () => {
    const { wrapper } = wrapWithQueryClient(
      <ThemeProvider>
        <div data-testid="child" />
      </ThemeProvider>,
    );
    const view = render(wrapper);
    await waitFor(() => expect(document.documentElement).toHaveAttribute(THEME_ATTR));
    view.unmount();
    expect(document.documentElement).not.toHaveAttribute(THEME_ATTR);
    expect(document.documentElement).not.toHaveAttribute(MODE_ATTR);
  });

  it("never issues its own network request (uses the shared me query)", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    try {
      const { wrapper } = wrapWithQueryClient(
        <ThemeProvider>
          <div data-testid="child" />
        </ThemeProvider>,
      );
      render(wrapper);
      await waitFor(() => expect(document.documentElement).toHaveAttribute(THEME_ATTR));
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("a null workspace appearance normalizes to the AURA/LIGHT default", () => {
    expect(normalizeAppearance({ workspace: { appearance: null } })).toEqual({
      preset: "AURA",
      mode: "LIGHT",
      customColors: null,
    });
  });
});

describe("typography ramp", () => {
  it("H2 spec matches the canonical 36/44 bold", () => {
    expect(TYPOGRAPHY.headingH2).toMatchObject({ fontSize: 36, lineHeight: 44, fontWeight: 700 });
  });

  it("body font in index.css is Manrope-first and no longer Inter-first", () => {
    const bodyRule = CSS.match(/body\s*\{[^}]*font-family:[^}]*\}/)?.[0] ?? "";
    const family = bodyRule.slice(bodyRule.indexOf("font-family"));
    expect(family.indexOf("Manrope")).toBeLessThan(family.indexOf("Inter") === -1 ? Infinity : family.indexOf("Inter"));
    expect(family).toMatch(/Manrope/);
  });

  it("type ramp ships as utility classes", () => {
    for (const cls of [".typo-eyebrow", ".typo-display-large", ".typo-heading-h2", ".typo-title-large", ".typo-body-medium", ".typo-caption"]) {
      expect(CSS).toContain(cls);
    }
  });
});

describe("foundation tokens in index.css", () => {
  it("declares every semantic CSS variable the runtime can apply", () => {
    for (const varName of Object.values(TOKEN_CSS_VARS)) {
      expect(CSS).toContain(varName);
    }
  });

  it("declares the spacing ramp 16/24/32/48/64", () => {
    for (const v of ["--looply-space-16", "--looply-space-24", "--looply-space-32", "--looply-space-48", "--looply-space-64"]) {
      expect(CSS).toContain(v);
    }
  });

  it("declares radius 10/16/full", () => {
    for (const v of ["--looply-radius-10", "--looply-radius-16", "--looply-radius-full"]) {
      expect(CSS).toContain(v);
    }
  });

  it("declares elevations 01/02/03", () => {
    for (const v of ["--looply-elevation-1", "--looply-elevation-2", "--looply-elevation-3"]) {
      expect(CSS).toContain(v);
    }
  });

  it("ships the AURA dark override as profundidade aubergine", () => {
    const darkBlock = CSS.match(/html\[data-looply-theme="aura"\]\[data-looply-mode="dark"\]\s*\{[^}]*\}/)?.[0] ?? "";
    expect(darkBlock).toContain("--looply-color-bg-canvas: #2a171f");
    expect(darkBlock).toContain("--looply-color-bg-surface: #34202a");
  });

  it("dark inverse text role resolves to the aubergine ink", () => {
    expect(resolvePresetTokens("AURA", "DARK").textInverse).toBe("#2A171F");
  });

  it("brand base tokens are declared", () => {
    for (const varName of Object.values(BRAND_TOKEN_CSS_VARS)) {
      expect(CSS).toContain(varName);
    }
  });
});

describe("runtime integrity", () => {
  it("token vocabulary and CSS var mapping stay in lockstep", () => {
    expect(Object.keys(TOKEN_CSS_VARS).sort()).toEqual([...SEMANTIC_TOKEN_IDS].sort());
    expect(SEMANTIC_TOKEN_IDS.length).toBe(19);
  });

  it("CUSTOM status tokens follow the mode", () => {
    const dark = customTheme(SIX, "DARK");
    expect(dark.tokens.statusSuccess).toBe("#34D399");
    const light = customTheme(SIX, "LIGHT");
    expect(light.tokens.statusSuccess).toBe("#059669");
  });

  it("ensureContrast is bounded and deterministic", () => {
    const a = resolveCustomTheme(SIX, "LIGHT").textPrimary;
    expect(contrastRatio(a, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
  });
});