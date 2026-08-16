import type { Capability, WorkspaceContext } from "./types";
import type { SessionInfo } from "./api";

// ── Capability UX primitive ───────────────────────────────────────────────
// Answers "should the UI show this?" — NEVER "is the user authorized?".
// The backend remains the sole authority; these helpers only render what
// /api/auth/me already declared for the active workspace.

export function hasCapability(
  session: SessionInfo | undefined,
  capability: Capability,
): boolean {
  return session?.workspace?.capabilities?.includes(capability) ?? false;
}

export function isWorkspaceActive(session: SessionInfo | undefined): boolean {
  return session?.workspace?.status === "ACTIVE";
}

// ── First-login routing decision (pure; F3 wires the actual routes) ──────
// Derived from the real /api/auth/me contract (B4/B12):
//   mustChangePassword → password change gate
//   workspace null/UNCONFIGURED → onboarding gate
//   otherwise → default home
export const CHANGE_PASSWORD_PATH = "/change-password";
export const ONBOARDING_PATH = "/onboarding";
export const DEFAULT_HOME_PATH = "/dashboard";

export function getPostLoginDestination(session: SessionInfo | undefined): string {
  if (!session) return DEFAULT_HOME_PATH;
  if (session.mustChangePassword) return CHANGE_PASSWORD_PATH;
  const workspace: WorkspaceContext | null = session.workspace;
  if (!workspace || workspace.status !== "ACTIVE") return ONBOARDING_PATH;
  return DEFAULT_HOME_PATH;
}
