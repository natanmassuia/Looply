import { describe, it, expect } from "vitest";
import {
  hasCapability,
  isWorkspaceActive,
  getPostLoginDestination,
  DEFAULT_HOME_PATH,
  CHANGE_PASSWORD_PATH,
  ONBOARDING_PATH,
} from "../lib/workspace";
import type { SessionInfo } from "../lib/api";

function session(overrides: Partial<SessionInfo> = {}): SessionInfo {
  return {
    user: { id: "u1", name: "A", email: "a@x.com" },
    activeCompanyId: "c1",
    mustChangePassword: false,
    memberships: [],
    workspace: {
      id: "c1",
      name: "A",
      template: "LOCAL_BUSINESS",
      capabilities: ["CLIENTS", "JOBS"],
      status: "ACTIVE",
    },
    ...overrides,
  };
}

describe("hasCapability", () => {
  it("returns true for a capability the workspace has", () => {
    expect(hasCapability(session(), "CLIENTS")).toBe(true);
  });

  it("returns false for a capability the workspace lacks", () => {
    expect(hasCapability(session(), "FILES")).toBe(false);
  });

  it("returns false when session/workspace is missing", () => {
    expect(hasCapability(undefined, "CLIENTS")).toBe(false);
    expect(hasCapability(session({ workspace: null }), "CLIENTS")).toBe(false);
  });
});

describe("isWorkspaceActive", () => {
  it("true when ACTIVE, false when UNCONFIGURED or missing", () => {
    expect(isWorkspaceActive(session())).toBe(true);
    expect(
      isWorkspaceActive(
        session({ workspace: { id: "c1", name: "A", template: null, capabilities: [], status: "UNCONFIGURED" } }),
      ),
    ).toBe(false);
    expect(isWorkspaceActive(undefined)).toBe(false);
  });
});

describe("getPostLoginDestination", () => {
  it("routes to change-password when mustChangePassword", () => {
    expect(getPostLoginDestination(session({ mustChangePassword: true }))).toBe(CHANGE_PASSWORD_PATH);
  });

  it("routes to onboarding when workspace is missing or unconfigured", () => {
    expect(getPostLoginDestination(session({ workspace: null }))).toBe(ONBOARDING_PATH);
    expect(
      getPostLoginDestination(
        session({ workspace: { id: "c1", name: "A", template: null, capabilities: [], status: "UNCONFIGURED" } }),
      ),
    ).toBe(ONBOARDING_PATH);
  });

  it("routes active workspace to the default home", () => {
    expect(getPostLoginDestination(session())).toBe(DEFAULT_HOME_PATH);
  });
});
