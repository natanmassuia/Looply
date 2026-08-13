import { describe, it, expect } from "vitest";
import {
  canTransition,
  assertCanTransition,
  TransitionError,
  nextVersionNumber,
  CONTENT_STATUSES,
} from "../src/domain/workflow";

describe("content workflow transitions", () => {
  it("DRAFT → IN_REVIEW", () => {
    expect(canTransition("DRAFT", "IN_REVIEW")).toBe(true);
  });

  it("IN_REVIEW → AWAITING_CLIENT", () => {
    expect(canTransition("IN_REVIEW", "AWAITING_CLIENT")).toBe(true);
  });

  it("AWAITING_CLIENT → CHANGES_REQUESTED (public change request)", () => {
    expect(canTransition("AWAITING_CLIENT", "CHANGES_REQUESTED")).toBe(true);
  });

  it("AWAITING_CLIENT → APPROVED (public approval)", () => {
    expect(canTransition("AWAITING_CLIENT", "APPROVED")).toBe(true);
  });

  it("CHANGES_REQUESTED → IN_REVIEW (new version enters review)", () => {
    expect(canTransition("CHANGES_REQUESTED", "IN_REVIEW")).toBe(true);
  });

  it("APPROVED → SCHEDULED", () => {
    expect(canTransition("APPROVED", "SCHEDULED")).toBe(true);
  });

  it("SCHEDULED → PUBLISHED", () => {
    expect(canTransition("SCHEDULED", "PUBLISHED")).toBe(true);
  });

  it("rejects invalid transitions", () => {
    expect(canTransition("DRAFT", "PUBLISHED")).toBe(false);
    expect(canTransition("APPROVED", "AWAITING_CLIENT")).toBe(false);
    expect(canTransition("SCHEDULED", "DRAFT")).toBe(false);
    expect(canTransition("PUBLISHED", "APPROVED")).toBe(false);
  });

  it("scheduling requires approved content (cannot schedule a draft)", () => {
    expect(canTransition("DRAFT", "SCHEDULED")).toBe(false);
    expect(canTransition("IN_REVIEW", "SCHEDULED")).toBe(false);
  });

  it("publishing requires scheduled content (cannot publish an approved item)", () => {
    expect(canTransition("APPROVED", "PUBLISHED")).toBe(false);
  });

  it("assertCanTransition throws TransitionError on illegal move", () => {
    expect(() => assertCanTransition("DRAFT", "PUBLISHED")).toThrow(TransitionError);
    expect(() => assertCanTransition("DRAFT", "PUBLISHED")).toThrow();
  });

  it("PUBLISHED is terminal (no outgoing transitions)", () => {
    expect(CONTENT_STATUSES).toContain("PUBLISHED");
    expect(canTransition("PUBLISHED", "DRAFT")).toBe(false);
  });
});

describe("versioning", () => {
  it("next version is monotonically increasing", () => {
    expect(nextVersionNumber(0)).toBe(1); // first version
    expect(nextVersionNumber(1)).toBe(2); // second version
    expect(nextVersionNumber(5)).toBe(6);
  });

  it("rejects non-integer / negative bases", () => {
    expect(() => nextVersionNumber(-1)).toThrow();
    expect(() => nextVersionNumber(1.5)).toThrow();
  });

  it("never decreases (starting from 0 yields 1, not 0)", () => {
    expect(nextVersionNumber(0)).toBeGreaterThan(0);
  });
});
