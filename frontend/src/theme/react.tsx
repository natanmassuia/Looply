import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useMe } from "../lib/api";
import type { AppearanceMode, AppearancePreset, WorkspaceAppearance } from "../lib/types";
import { normalizeAppearance, resolveTheme } from "./resolveTheme";
import { applyTheme, resetTheme } from "./applyTheme";

interface ThemeContextValue {
  preset: AppearancePreset;
  mode: AppearanceMode;
}

// AURA/LIGHT — the same static startup state index.css ships. Anything that
// renders without a provider (public pages, bootstrapping) reads this.
const DEFAULT_VALUE: ThemeContextValue = { preset: "AURA", mode: "LIGHT" };

const ThemeContext = createContext<ThemeContextValue>(DEFAULT_VALUE);

// Canonical appearance source: the authenticated session (GET /api/auth/me).
// TanStack Query shares the ["me"] query, so mounting this provider does not
// fire an extra request. Server value wins; anything else collapses to
// AURA/LIGHT defensively.
export function useWorkspaceAppearance(): WorkspaceAppearance {
  const { data } = useMe();
  return useMemo(() => normalizeAppearance(data?.workspace?.appearance), [data]);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const appearance = useWorkspaceAppearance();

  useEffect(() => {
    applyTheme(document.documentElement, resolveTheme(appearance));
  }, [appearance]);

  // On unmount (logout / route change away from the shell) restore the static
  // AURA/LIGHT startup state — never leave a stale custom theme applied.
  useEffect(() => {
    return () => resetTheme(document.documentElement);
  }, []);

  const value = useMemo(
    () => ({ preset: appearance.preset, mode: appearance.mode }),
    [appearance],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}