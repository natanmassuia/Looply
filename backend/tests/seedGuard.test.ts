import { describe, it, expect, afterEach } from "vitest";
import { assertSeedAllowed } from "../src/lib/seedGuard";

const save = { ...process.env };

afterEach(() => {
  process.env = { ...save };
});

describe("assertSeedAllowed", () => {
  it("aborts when NODE_ENV=production", () => {
    process.env.NODE_ENV = "production";
    expect(() => assertSeedAllowed()).toThrow(/production/);
  });

  it("allows when NODE_ENV=development", () => {
    process.env.NODE_ENV = "development";
    expect(() => assertSeedAllowed()).not.toThrow();
  });

  it("allows when NODE_ENV=test (CI seed step)", () => {
    process.env.NODE_ENV = "test";
    expect(() => assertSeedAllowed()).not.toThrow();
  });
});
