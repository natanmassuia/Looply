import { describe, expect, it } from "vitest";
import { normalizePhoneNumber } from "../src/lib/phone";

describe("phone normalization", () => {
  it("produces a canonical E.164-like value", () => {
    expect(normalizePhoneNumber("+5511987654321")).toBe("+5511987654321");
  });

  it("resolves formatting variations to the same canonical value", () => {
    const variants = [
      "+55 11 98765-4321",
      "+55(11)98765-4321",
      "+55.11.98765.4321",
      "5511987654321",
      "11987654321",
      "11 98765-4321",
    ];
    for (const variant of variants) {
      expect(normalizePhoneNumber(variant)).toBe("+5511987654321");
    }
  });

  it("rejects malformed phones", () => {
    expect(normalizePhoneNumber("")).toBeNull();
    expect(normalizePhoneNumber("not a phone")).toBeNull();
    expect(normalizePhoneNumber("+5511 98765 4321x")).toBeNull();
    expect(normalizePhoneNumber("12345")).toBeNull();
    expect(normalizePhoneNumber("+1234567890123456")).toBeNull();
  });

  it("does exact matching only: a different number is a different value", () => {
    // No substring semantics: one digit less is a distinct phone.
    expect(normalizePhoneNumber("1198765432")).not.toBe(normalizePhoneNumber("11987654321"));
    expect(normalizePhoneNumber("+5511987654321")).not.toBe(normalizePhoneNumber("551198765432"));
  });
});
