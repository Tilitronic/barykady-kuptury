import { formatDate } from "@/features/i18n/format";
import type { Locale } from "@/features/i18n/locales";

import { allDayStartInstantMs, eventStartInstantMs } from "./sortEvents";
import type { NormalizedEvent } from "./normalize";

/**
 * Date-range rendering for the Events list (T-024).
 *
 * The wire contract (T-023) is explicit: timed values are offset-bearing ISO
 * strings kept verbatim, all-day values are date-only and never shifted. This
 * module turns exactly those strings into the two things the card needs —
 * human text in the requested locale, and the machine `datetime` attribute —
 * without ever re-serializing an instant.
 *
 * All-day ranges follow RFC 5545: Google's `end.date` is *exclusive*, so
 * 06-01 → 06-02 is the single day June 1. The rendered end is therefore
 * `end − 1 day`, and the `datetime` attribute carries that inclusive date so
 * the machine value matches what the reader sees.
 */

export interface EventWhenView {
  readonly allDay: boolean;
  /** Human-readable start (date, or date + local wall-clock time). */
  readonly startText: string;
  /** Valid `<time datetime>` value for the start (wire value verbatim). */
  readonly startAttr: string;
  /** Human-readable end, or `null` when there is no usable later end. */
  readonly endText: string | null;
  /** `<time datetime>` value for the end; `null` whenever `endText` is. */
  readonly endAttr: string | null;
}

const DATE_MEDIUM: Intl.DateTimeFormatOptions = { dateStyle: "medium" };

function timedText(value: string, locale: Locale, timeZone: string): string {
  return formatDate(new Date(value), locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone
  });
}

function timedTime(value: string, locale: Locale, timeZone: string): string {
  return formatDate(new Date(value), locale, {
    timeStyle: "short",
    timeZone
  });
}

/** Calendar day (`YYYY-MM-DD`) of a timed instant in the event timezone. */
function dayKey(value: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(value));

  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find(part => part.type === type)?.value ?? "";

  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

/** Shift a date-only string by whole days (UTC arithmetic — no tz drift). */
function shiftDateOnly(value: string, days: number): string | null {
  const instant = allDayStartInstantMs(value, "UTC");
  if (instant === null) return null;

  return new Date(instant + days * 86_400_000).toISOString().slice(0, 10);
}

function allDayText(value: string, locale: Locale): string {
  // Date-only values are formatted in UTC so the day never shifts by timezone.
  return formatDate(new Date(`${value}T00:00:00Z`), locale, {
    ...DATE_MEDIUM,
    timeZone: "UTC"
  });
}

/**
 * Formats the rendered date range for one event, or `null` when its start is
 * unparseable (such events are dropped by `sortEvents`; the guard keeps the
 * card from ever showing `Invalid Date`).
 */
export function formatEventWhen(
  event: NormalizedEvent,
  locale: Locale
): EventWhenView | null {
  if (eventStartInstantMs(event) === null) return null;

  if (event.allDay) {
    const inclusiveEnd = event.end ? shiftDateOnly(event.end, -1) : null;
    const showsEnd = inclusiveEnd !== null && inclusiveEnd > event.start;

    return {
      allDay: true,
      startText: allDayText(event.start, locale),
      startAttr: event.start,
      endText: showsEnd ? allDayText(inclusiveEnd, locale) : null,
      endAttr: showsEnd ? inclusiveEnd : null
    };
  }

  const base: EventWhenView = {
    allDay: false,
    startText: timedText(event.start, locale, event.timezone),
    startAttr: event.start,
    endText: null,
    endAttr: null
  };

  if (!event.end) return base;

  const endInstant = Date.parse(event.end);
  if (Number.isNaN(endInstant) || endInstant <= eventStartInstantMs(event)!) {
    return base;
  }

  const crossesDay =
    dayKey(event.end, event.timezone) !== dayKey(event.start, event.timezone);

  return {
    ...base,
    endText: crossesDay
      ? timedText(event.end, locale, event.timezone)
      : timedTime(event.end, locale, event.timezone),
    endAttr: event.end
  };
}

/**
 * Plain-text excerpt for the card. Descriptions arrive as single-line plain
 * text from the adapter, so this only collapses whitespace and cuts at the
 * last word boundary before `maxLength` — nothing is invented and nothing is
 * truncated mid-word with a dangling letter.
 */
export function excerptText(text: string, maxLength = 320): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= maxLength) return collapsed;

  const window = collapsed.slice(0, maxLength + 1);
  const boundary = window.lastIndexOf(" ");
  const cut =
    boundary > 0 ? window.slice(0, boundary) : window.slice(0, maxLength);

  return `${cut.trimEnd()}…`;
}
