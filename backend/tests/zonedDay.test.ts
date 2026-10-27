import { describe, it, expect } from "vitest";
import { zonedDayRange } from "../src/services/scheduling";

describe("zonedDayRange", () => {
  it("brackets the local São Paulo day (UTC-3) around a mid-day instant", () => {
    // 2026-10-27 14:00 in São Paulo == 17:00 UTC.
    const { start, end } = zonedDayRange(new Date("2026-10-27T17:00:00.000Z"), "America/Sao_Paulo");
    expect(start.toISOString()).toBe("2026-10-27T03:00:00.000Z"); // 00:00 local
    expect(end.toISOString()).toBe("2026-10-28T03:00:00.000Z");
  });

  it("rolls the local day correctly when UTC is already on the next date", () => {
    // 2026-10-27 22:00 São Paulo == 2026-10-28 01:00 UTC; still the 27th locally.
    const { start, end } = zonedDayRange(new Date("2026-10-28T01:00:00.000Z"), "America/Sao_Paulo");
    expect(start.toISOString()).toBe("2026-10-27T03:00:00.000Z");
    expect(end.toISOString()).toBe("2026-10-28T03:00:00.000Z");
  });

  it("produces a span near 24h for a non-DST zone", () => {
    const { start, end } = zonedDayRange(new Date("2026-06-15T12:00:00.000Z"), "America/Sao_Paulo");
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
  });
});
