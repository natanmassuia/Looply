import { describe, expect, it } from "vitest";
import {
  DEFAULT_DURATION_MIN,
  effectiveEnd,
  nextFreeSlots,
  overlaps,
  parseHm,
  withinBusinessHours,
  type BusinessHours,
} from "../src/services/scheduling";

const TZ = "America/Sao_Paulo"; // UTC-3, no DST since 2019
// Mon–Fri 09:00–18:00 local.
const hours: BusinessHours = { start: "09:00", end: "18:00", days: [1, 2, 3, 4, 5] };

describe("scheduling helpers", () => {
  it("effectiveEnd uses explicit end or default 60 min", () => {
    const s = new Date("2026-09-07T12:00:00Z");
    expect(effectiveEnd(s, null)).toEqual(new Date(s.getTime() + DEFAULT_DURATION_MIN * 60000));
    const e = new Date("2026-09-07T13:30:00Z");
    expect(effectiveEnd(s, e)).toBe(e);
  });

  it("overlaps is half-open (touching edges do not overlap)", () => {
    const a1 = new Date("2026-09-07T12:00:00Z");
    const a2 = new Date("2026-09-07T13:00:00Z");
    expect(overlaps(a1, a2, new Date("2026-09-07T12:30:00Z"), new Date("2026-09-07T13:30:00Z"))).toBe(true);
    expect(overlaps(a1, a2, a2, new Date("2026-09-07T14:00:00Z"))).toBe(false);
  });

  it("parseHm validates HH:MM", () => {
    expect(parseHm("09:30")).toBe(570);
    expect(parseHm("24:00")).toBeNull();
    expect(parseHm("9:30")).toBeNull();
    expect(parseHm(null)).toBeNull();
  });

  it("withinBusinessHours: unconfigured allows everything", () => {
    const empty: BusinessHours = { start: null, end: null, days: [] };
    const s = new Date("2026-09-06T03:00:00Z"); // Sunday 00:00 local
    expect(withinBusinessHours(s, effectiveEnd(s, null), empty, TZ)).toBe(true);
  });

  it("withinBusinessHours: inside window on an active weekday", () => {
    // Mon 2026-09-07 10:00 local = 13:00Z
    const s = new Date("2026-09-07T13:00:00Z");
    expect(withinBusinessHours(s, effectiveEnd(s, null), hours, TZ)).toBe(true);
  });

  it("withinBusinessHours: rejects before open, after close, and inactive day", () => {
    const early = new Date("2026-09-07T11:00:00Z"); // Mon 08:00 local
    expect(withinBusinessHours(early, effectiveEnd(early, null), hours, TZ)).toBe(false);
    const late = new Date("2026-09-07T20:30:00Z"); // Mon 17:30 local, +60min → 18:30 past close
    expect(withinBusinessHours(late, effectiveEnd(late, null), hours, TZ)).toBe(false);
    const sunday = new Date("2026-09-06T15:00:00Z"); // Sun 12:00 local
    expect(withinBusinessHours(sunday, effectiveEnd(sunday, null), hours, TZ)).toBe(false);
  });

  it("withinBusinessHours: ending exactly at close is allowed", () => {
    // Mon 17:00–18:00 local = 20:00Z–21:00Z
    const s = new Date("2026-09-07T20:00:00Z");
    expect(withinBusinessHours(s, new Date("2026-09-07T21:00:00Z"), hours, TZ)).toBe(true);
  });

  it("nextFreeSlots skips busy intervals and out-of-hours time", () => {
    const from = new Date("2026-09-07T13:00:00Z"); // Mon 10:00 local
    const busy = [{ start: new Date("2026-09-07T13:00:00Z"), end: new Date("2026-09-07T14:00:00Z") }];
    const slots = nextFreeSlots(from, 60, busy, hours, TZ, 2);
    expect(slots).toHaveLength(2);
    // First free is 11:00 local = 14:00Z (10:00 slot is busy).
    expect(slots[0]).toEqual(new Date("2026-09-07T14:00:00Z"));
    for (const s of slots) {
      expect(withinBusinessHours(s, effectiveEnd(s, null), hours, TZ)).toBe(true);
    }
  });
});
