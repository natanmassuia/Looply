import { describe, it, expect, afterEach } from "vitest";
import { validateEnv } from "../src/lib/env";

const save = { ...process.env };

afterEach(() => {
  process.env = { ...save };
});

describe("validateEnv", () => {
  it("throws when DATABASE_URL is missing", () => {
    delete process.env.DATABASE_URL;
    expect(() => validateEnv()).toThrow(/DATABASE_URL/);
  });

  it("throws on invalid PORT", () => {
    process.env.DATABASE_URL = "postgresql://x";
    process.env.PORT = "not-a-port";
    expect(() => validateEnv()).toThrow(/PORT/);
  });

  it("passes with valid env", () => {
    process.env.DATABASE_URL = "postgresql://x";
    process.env.PORT = "4000";
    expect(() => validateEnv()).not.toThrow();
  });
});
