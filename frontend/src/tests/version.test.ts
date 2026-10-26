import { describe, it, expect } from "vitest";
import { APP_VERSION, COMMIT_HASH, formatBuildDate } from "../config/version";

describe("version config", () => {
  it("exports valid version and commit strings", () => {
    expect(APP_VERSION).toBeTruthy();
    expect(typeof APP_VERSION).toBe("string");
    expect(COMMIT_HASH).toBeTruthy();
    expect(typeof COMMIT_HASH).toBe("string");
  });

  it("formatBuildDate formats ISO date correctly", () => {
    expect(formatBuildDate("")).toBe("");
    expect(formatBuildDate("invalid")).toBe("");
    const formatted = formatBuildDate("2026-10-26T20:00:00Z");
    expect(formatted).toBeTruthy();
  });
});
