import { describe, it, expect } from "vitest";
import { redact } from "../src/lib/logger";

describe("redact", () => {
  it("redacts sensitive keys at any depth", () => {
    const input = {
      authorization: "Bearer xyz",
      nested: { password: "hunter2", ok: "keep" },
      list: [{ token: "abc" }],
      plain: "value",
    };
    const out = redact(input) as Record<string, unknown>;
    expect(out.authorization).toBe("[redacted]");
    const nested = out.nested as Record<string, unknown>;
    expect(nested.password).toBe("[redacted]");
    expect(nested.ok).toBe("keep");
    const first = (out.list as Record<string, unknown>[])[0];
    expect(first.token).toBe("[redacted]");
    expect(out.plain).toBe("value");
  });

  it("leaves primitives and null untouched", () => {
    expect(redact("str")).toBe("str");
    expect(redact(42)).toBe(42);
    expect(redact(null)).toBe(null);
  });
});
