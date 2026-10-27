// Pure scheduling helpers (no DB). Business hours are a single daily window per
// company, applied to the active weekdays; appointments without an explicit end
// are treated as lasting DEFAULT_DURATION_MIN minutes.

export const DEFAULT_DURATION_MIN = 60;
const DAY_MIN = 24 * 60;
const SLOT_STEP_MIN = 30; // suggestion granularity
const SUGGEST_HORIZON_DAYS = 14;

export interface BusinessHours {
  start: string | null; // "HH:MM" local time
  end: string | null; // "HH:MM" local time
  days: number[]; // active weekdays, 0=Sunday … 6=Saturday
}

export interface BusyInterval {
  start: Date;
  end: Date; // effective end (explicit or start + default duration)
}

export function effectiveEnd(startsAt: Date, endsAt?: Date | null): Date {
  if (endsAt) return endsAt;
  return new Date(startsAt.getTime() + DEFAULT_DURATION_MIN * 60_000);
}

// Half-open interval overlap: [aStart, aEnd) ∩ [bStart, bEnd) ≠ ∅.
export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

// Minutes-from-midnight ("HH:MM" → number), or null when malformed.
export function parseHm(value: string | null | undefined): number | null {
  if (!value) return null;
  const m = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

// Minutes the IANA `timezone` is ahead of UTC at the instant `date` (DST-aware).
function tzOffsetMinutes(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  let hour = get("hour");
  if (hour === 24) hour = 0; // some engines render midnight as "24"
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), hour, get("minute"), get("second"));
  return (asUtc - date.getTime()) / 60000;
}

// [start, end) UTC instants bounding the local calendar day of `now` in `timezone`.
// DST-aware: end is computed from the next calendar day, not now + 24h.
export function zonedDayRange(now: Date, timezone: string): { start: Date; end: Date } {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const [y, m, d] = ymd.split("-").map(Number);
  const midnightUtc = (yy: number, mm: number, dd: number) => {
    const guess = Date.UTC(yy, mm - 1, dd);
    return new Date(guess - tzOffsetMinutes(new Date(guess), timezone) * 60000);
  };
  const start = midnightUtc(y, m, d);
  const next = new Date(Date.UTC(y, m - 1, d) + 24 * 60 * 60 * 1000);
  const end = midnightUtc(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
  return { start, end };
}

// Local weekday (0-6) and minutes-from-midnight for a UTC instant in an IANA tz.
export function localParts(date: Date, timezone: string): { weekday: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const weekday = weekdayMap[get("weekday")] ?? 0;
  let hour = Number(get("hour"));
  if (hour === 24) hour = 0; // some engines render midnight as "24"
  const minutes = hour * 60 + Number(get("minute"));
  return { weekday, minutes };
}

export function isBusinessHoursConfigured(hours: BusinessHours): boolean {
  return parseHm(hours.start) !== null && parseHm(hours.end) !== null && hours.days.length > 0;
}

// True when [startsAt, end) fits entirely inside the configured window on an
// active weekday. When hours are not configured, everything is allowed.
export function withinBusinessHours(
  startsAt: Date,
  end: Date,
  hours: BusinessHours,
  timezone: string,
): boolean {
  if (!isBusinessHoursConfigured(hours)) return true;
  const openMin = parseHm(hours.start)!;
  const closeMin = parseHm(hours.end)!;
  if (closeMin <= openMin) return false; // misconfigured / overnight unsupported in MVP

  const s = localParts(startsAt, timezone);
  // End is exclusive: use the last covered instant so an appointment ending
  // exactly at close is allowed and stays on the same local day.
  const lastInstant = new Date(end.getTime() - 1);
  const e = localParts(lastInstant, timezone);

  if (!hours.days.includes(s.weekday)) return false;
  if (e.weekday !== s.weekday) return false; // crosses local midnight
  return s.minutes >= openMin && e.minutes < closeMin;
}

// Next free slot starts (up to `count`) at or after `from`, each `durationMin`
// long, inside business hours and not overlapping any busy interval. Stepped on
// a fixed grid and bounded to SUGGEST_HORIZON_DAYS so the search always ends.
export function nextFreeSlots(
  from: Date,
  durationMin: number,
  busy: BusyInterval[],
  hours: BusinessHours,
  timezone: string,
  count = 3,
): Date[] {
  const slots: Date[] = [];
  const stepMs = SLOT_STEP_MIN * 60_000;
  const durMs = durationMin * 60_000;
  const horizon = from.getTime() + SUGGEST_HORIZON_DAYS * DAY_MIN * 60_000;
  // Align the first candidate up to the grid.
  let t = Math.ceil(from.getTime() / stepMs) * stepMs;
  while (t <= horizon && slots.length < count) {
    const start = new Date(t);
    const end = new Date(t + durMs);
    if (
      withinBusinessHours(start, end, hours, timezone) &&
      !busy.some((b) => overlaps(start, end, b.start, b.end))
    ) {
      slots.push(start);
    }
    t += stepMs;
  }
  return slots;
}
