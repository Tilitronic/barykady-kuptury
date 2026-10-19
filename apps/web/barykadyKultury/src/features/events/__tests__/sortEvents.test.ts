import { describe, expect, it } from "vitest";

import {
  eventStartInstantMs,
  sortEvents,
  type SortableInstant
} from "@/features/events/sortEvents";
import type { NormalizedEvent } from "@/features/events/normalize";

/**
 * Sorting axis (T-024): soonest first, past excluded, ties stable by input
 * order, invalid dates dropped rather than rendered as `Invalid Date`, and
 * all-day events ordered on their actual instant (midnight in the event's
 * own timezone, Europe/Warsaw fallback — D-11) without shifting the
 * displayed date. `now` is injected so every assertion is deterministic.
 */

function event(overrides: Partial<NormalizedEvent> = {}): NormalizedEvent {
  return {
    id: "event-1",
    title: "Event",
    start: "2030-06-01T10:00:00+02:00",
    end: null,
    allDay: false,
    timezone: "Europe/Warsaw",
    location: null,
    description: null,
    registrationUrl: null,
    ...overrides
  };
}

describe("eventStartInstantMs", () => {
  it("parses an offset-bearing timed start verbatim", () => {
    expect(
      eventStartInstantMs(
        event({ start: "2030-05-14T16:00:00+02:00" }) as SortableInstant
      )
    ).toBe(Date.UTC(2030, 4, 14, 14, 0, 0));
  });

  it("resolves an all-day start to midnight in the event timezone (+02:00 in June)", () => {
    expect(
      eventStartInstantMs(
        event({
          start: "2030-06-01",
          allDay: true,
          timezone: "Europe/Warsaw"
        }) as SortableInstant
      )
    ).toBe(Date.UTC(2030, 5, 1) - 2 * 60 * 60 * 1000);
  });

  it("resolves an all-day start with the winter offset (+01:00 in January)", () => {
    expect(
      eventStartInstantMs(
        event({
          start: "2030-01-15",
          allDay: true,
          timezone: "Europe/Warsaw"
        }) as SortableInstant
      )
    ).toBe(Date.UTC(2030, 0, 15) - 60 * 60 * 1000);
  });

  it("honours a non-Warsaw event timezone (EDT is UTC-4 in June)", () => {
    expect(
      eventStartInstantMs(
        event({
          start: "2030-06-01",
          allDay: true,
          timezone: "America/New_York"
        }) as SortableInstant
      )
    ).toBe(Date.UTC(2030, 5, 1) + 4 * 60 * 60 * 1000);
  });

  it("returns null for unparseable values instead of NaN", () => {
    expect(
      eventStartInstantMs(event({ start: "not-a-date" }) as SortableInstant)
    ).toBeNull();
    expect(
      eventStartInstantMs(
        event({ start: "2030-13-45", allDay: true }) as SortableInstant
      )
    ).toBeNull();
    expect(
      eventStartInstantMs(event({ start: "" }) as SortableInstant)
    ).toBeNull();
  });
});

describe("sortEvents", () => {
  const now = Date.UTC(2030, 4, 1);

  it("orders events by soonest start first", () => {
    const sorted = sortEvents(
      [
        event({ id: "later", start: "2030-07-01T10:00:00+02:00" }),
        event({ id: "soonest", start: "2030-06-01T10:00:00+02:00" }),
        event({ id: "middle", start: "2030-06-15T10:00:00+02:00" })
      ],
      now
    );

    expect(sorted.map(e => e.id)).toEqual(["soonest", "middle", "later"]);
  });

  it("excludes events that already started", () => {
    const sorted = sortEvents(
      [
        event({ id: "past", start: "2030-04-30T23:00:00+02:00" }),
        event({ id: "future", start: "2030-06-01T10:00:00+02:00" })
      ],
      now
    );

    expect(sorted.map(e => e.id)).toEqual(["future"]);
  });

  it("keeps an event starting exactly at now (not yet past)", () => {
    const sorted = sortEvents(
      [event({ id: "exact", start: "2030-05-01T02:00:00+02:00" })],
      now
    );

    expect(sorted.map(e => e.id)).toEqual(["exact"]);
  });

  it("keeps input order for equal starts, in either input order", () => {
    const a = event({ id: "a", start: "2030-06-01T10:00:00+02:00" });
    const b = event({ id: "b", start: "2030-06-01T10:00:00+02:00" });

    expect(sortEvents([a, b], now).map(e => e.id)).toEqual(["a", "b"]);
    expect(sortEvents([b, a], now).map(e => e.id)).toEqual(["b", "a"]);
  });

  it("drops events with invalid dates rather than rendering Invalid Date", () => {
    const sorted = sortEvents(
      [
        event({ id: "broken", start: "to-be-or-not-to-be" }),
        event({ id: "fine", start: "2030-06-01T10:00:00+02:00" })
      ],
      now
    );

    expect(sorted.map(e => e.id)).toEqual(["fine"]);
  });

  it("orders an all-day event on its Warsaw midnight instant, not its string", () => {
    // All-day 2030-06-01 starts 2030-05-31T22:00Z; a timed event at
    // 2030-05-31T23:00+02:00 (= 21:00Z) is earlier even though "2030-05-31…"
    // sorts before "2030-06-01" as text and the all-day string sorts first.
    const sorted = sortEvents(
      [
        event({ id: "all-day", start: "2030-06-01", allDay: true }),
        event({ id: "late-evening", start: "2030-05-31T23:00:00+02:00" }),
        event({ id: "morning", start: "2030-06-01T09:00:00+02:00" })
      ],
      now
    );

    expect(sorted.map(e => e.id)).toEqual([
      "late-evening",
      "all-day",
      "morning"
    ]);
  });

  it("accepts an ISO string for now", () => {
    const sorted = sortEvents(
      [
        event({ id: "past", start: "2030-01-01T10:00:00+02:00" }),
        event({ id: "next", start: "2030-06-01T10:00:00+02:00" })
      ],
      "2030-03-01T00:00:00Z"
    );

    expect(sorted.map(e => e.id)).toEqual(["next"]);
  });

  it("returns an empty list when nothing is upcoming", () => {
    expect(
      sortEvents(
        [event({ id: "past", start: "2029-01-01T10:00:00+02:00" })],
        now
      )
    ).toEqual([]);
  });
});
