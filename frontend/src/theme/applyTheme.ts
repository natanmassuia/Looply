import { SEMANTIC_TOKEN_IDS, TOKEN_CSS_VARS, type ResolvedTheme } from "./types";

// DOM contract: the active theme lives on the <html> element.
export const THEME_ATTR = "data-looply-theme";
export const MODE_ATTR = "data-looply-mode";

// Applies a resolved theme to the document root. Only the allowlisted semantic
// CSS variables are ever written — unknown keys in `theme.tokens` are ignored
// by construction, so a malicious/stale payload cannot create arbitrary CSS
// custom properties (no style/injection surface).
export function applyTheme(root: HTMLElement, theme: ResolvedTheme): void {
  root.setAttribute(THEME_ATTR, theme.preset.toLowerCase());
  root.setAttribute(MODE_ATTR, theme.mode.toLowerCase());
  for (const id of SEMANTIC_TOKEN_IDS) {
    const value = theme.tokens[id];
    if (value) root.style.setProperty(TOKEN_CSS_VARS[id], value);
  }
}

// Returns the document to the static startup state (AURA/LIGHT defaults that
// live in index.css) by removing runtime attributes and custom properties.
export function resetTheme(root: HTMLElement): void {
  root.removeAttribute(THEME_ATTR);
  root.removeAttribute(MODE_ATTR);
  for (const id of SEMANTIC_TOKEN_IDS) {
    root.style.removeProperty(TOKEN_CSS_VARS[id]);
  }
}