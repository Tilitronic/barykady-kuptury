import type { NormalizedEvent } from "./normalize";

/**
 * Upcoming-event ordering (T-024).
 *
 * The rule set is small but full of traps, so it lives here as pure functions
 * with an injected `now` (docs/PRODUCT_REQUIREMENTS.md §4: soonest first, past
 * excluded, equal starts stable; docs/architecture.md §5 / D-11: the event's
 * own timezone, else Europe/Warsaw):
 *
 * - timed events parse their offset-bearing ISO string directly — Google's
 *   verbatim offset *is* the instant, so DST cannot shift it;
 * - all-day events are date-only by contract. Their instant is midnight in
 *   the event's own timezone, computed with `Intl` offsets rather than by
 *   appending a fake UTC time, so the *displayed* date never shifts;
 * - unparseable dates are dropped, never rendered as `Invalid Date`;
 * - ties keep input order via an explicit index tie-break — not by trusting
 *   `Array.prototype.sort` stability.
 */

/** The three fields an ordering decision may look at. */
export type SortableInstant = Pick<
  NormalizedEvent,
  "start" | "allDay" | "timezone"
>;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function parseDateOnlyParts(value: string): [number, number, number] | null {
  if (!DATE_ONLY.test(value)) return null;

  const [year, month, day] = value.split("-").map(Number) as [
    number,
    number,
    number
  ];
  const utc = Date.UTC(year, month - 1, day);
  const probe = new Date(utc);

  // Reject 2030-02-30 style strings: the round-trip must reproduce the parts.
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }

  return [year, month, day];
}

/**
 * Offset (ms east of UTC) of `timeZone` at `instantMs`, derived from `Intl`
 * wall-clock parts. `hourCycle: "h23"` avoids the `24:00` quirk of `h24`
 * formatters at midnight.
 */
function timezoneOffsetMs(instantMs: number, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

  const parts: Record<string, number> = {};
  for (const { type, value } of formatter.formatToParts(new Date(instantMs))) {
    if (type !== "literal") parts[type] = Number(value);
  }

  const asUtc = Date.UTC(
    parts.year ?? 0,
    (parts.month ?? 1) - 1,
    parts.day ?? 1,
    parts.hour ?? 0,
    parts.minute ?? 0,
    parts.second ?? 0
  );

  return asUtc - instantMs;
}

/**
 * Instant of the *start of the day* `dateOnly` in `timeZone`.
 *
 * Two-pass correction: the first guess (naive UTC midnight) yields the offset
 * at that point, and the corrected instant is re-checked so a DST boundary
 * inside the day cannot leave the result an hour off.
 */
export function allDayStartInstantMs(
  dateOnly: string,
  timeZone: string
): number | null {
  const parts = parseDateOnlyParts(dateOnly);
  if (!parts) return null;

  const [year, month, day] = parts;
  const naive = Date.UTC(year, month - 1, day);

  let instant = naive - timezoneOffsetMs(naive, timeZone);
  instant = naive - timezoneOffsetMs(instant, timeZone);

  return instant;
}

/** The comparable instant of an event start, or `null` when unusable. */
export function eventStartInstantMs(event: SortableInstant): number | null {
  if (event.allDay) {
    return allDayStartInstantMs(event.start, event.timezone);
  }

  const instant = Date.parse(event.start);
  return Number.isNaN(instant) ? null : instant;
}

/**
 * Soonest-first upcoming events. Past events (start strictly before `now`)
 * and unparseable dates are excluded; equal instants keep their input order
 * through the index tie-break.
 */
export function sortEvents(
  events: readonly NormalizedEvent[],
  now: Date | number | string
): NormalizedEvent[] {
  const nowMs = typeof now === "number" ? now : new Date(now).getTime();
  if (Number.isNaN(nowMs)) return [];

  const dated: {
    readonly event: NormalizedEvent;
    readonly instant: number;
    readonly index: number;
  }[] = [];

  events.forEach((event, index) => {
    const instant = eventStartInstantMs(event);
    if (instant !== null && instant >= nowMs) {
      dated.push({ event, instant, index });
    }
  });

  dated.sort((a, b) =>
    a.instant === b.instant ? a.index - b.index : a.instant - b.instant
  );

  return dated.map(entry => entry.event);
}
