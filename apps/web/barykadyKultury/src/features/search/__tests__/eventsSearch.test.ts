import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchCalendarEvents } from "@/features/events/client";
import type { NormalizedEvent } from "@/features/events/normalize";
import {
  mapEventsToSearchResults,
  resetEventsSearchCache,
  searchEvents
} from "@/features/search/eventsSearch";

vi.mock("@/features/events/client", () => ({
  fetchCalendarEvents: vi.fn()
}));

const fetchCalendarEventsMock = vi.mocked(fetchCalendarEvents);

function event(overrides: Partial<NormalizedEvent> = {}): NormalizedEvent {
  return {
    id: "fixture-event-1",
    title: "Sample event",
    start: "2030-05-14T16:00:00+02:00",
    end: "2030-05-14T18:00:00+02:00",
    allDay: false,
    timezone: "Europe/Warsaw",
    location: null,
    description: null,
    registrationUrl: null,
    ...overrides
  };
}

function calendarOk(events: readonly NormalizedEvent[]) {
  return {
    kind: "ok" as const,
    calendarId: "fixture-calendar@example.org",
    events
  };
}

describe("mapEventsToSearchResults", () => {
  it("matches title, description and location, ranking title matches first", () => {
    const results = mapEventsToSearchResults(
      [
        event({
          id: "title",
          title: "Warsztat ceramiki",
          description: null,
          location: null
        }),
        event({
          id: "description",
          title: "Open day",
          description: "Warsztat dla rodzin",
          location: null
        }),
        event({
          id: "location",
          title: "Concert",
          description: null,
          location: "Warsztatowa 1"
        }),
        event({ id: "other", title: "Unrelated", description: "nothing" })
      ],
      "warsztat",
      "en"
    );

    // Title ranks 3; description and location tie at 2 and fall back to
    // alphabetical title order ("Concert" before "Open day").
    expect(results.map(result => result.id)).toEqual([
      "event:title",
      "event:location",
      "event:description"
    ]);
    expect(results[0]?.rank).toBe(3);
    expect(results[1]?.rank).toBe(2);
    expect(results[2]?.rank).toBe(2);
  });

  it("links to the stable event card anchor under the active locale", () => {
    const [result] = mapEventsToSearchResults(
      [event({ id: "abc_123", title: "Koncert" })],
      "koncert",
      "pl"
    );

    expect(result).toMatchObject({
      kind: "event",
      route: "/pl/events#event-abc_123",
      excerpt: null
    });
  });

  it("is diacritic-insensitive", () => {
    const results = mapEventsToSearchResults(
      [event({ title: "Łódź cultural evening" })],
      "lodz",
      "en"
    );

    expect(results).toHaveLength(1);
  });

  it("caps excerpts at 180 characters and collapses whitespace", () => {
    const [result] = mapEventsToSearchResults(
      [
        event({
          title: "Long event",
          description: `warsztat\n\n${"x".repeat(400)}`
        })
      ],
      "warsztat",
      "en"
    );

    expect(result?.excerpt?.length).toBeLessThanOrEqual(180);
    expect(result?.excerpt).not.toContain("\n");
  });

  it("returns no rows for a blank query", () => {
    expect(mapEventsToSearchResults([event()], "", "en")).toEqual([]);
  });

  it("caps the merged event section at 20 rows", () => {
    const events = Array.from({ length: 25 }, (_, index) =>
      event({ id: `event-${index}`, title: `Warsztat ${index}` })
    );

    expect(mapEventsToSearchResults(events, "warsztat", "en")).toHaveLength(20);
  });
});

describe("searchEvents", () => {
  beforeEach(() => {
    resetEventsSearchCache();
    fetchCalendarEventsMock.mockReset();
  });

  it("does not touch the network for queries shorter than two characters", async () => {
    const result = await searchEvents(" w ", "en");

    expect(result).toEqual({ kind: "empty" });
    expect(fetchCalendarEventsMock).not.toHaveBeenCalled();
  });

  it("fetches the calendar once and filters the cached list", async () => {
    fetchCalendarEventsMock.mockResolvedValue(
      calendarOk([
        event({ id: "one", title: "Warsztat ceramiki" }),
        event({ id: "two", title: "Koncert" })
      ])
    );

    const first = await searchEvents("warsztat", "en");
    const second = await searchEvents("koncert", "en");

    expect(fetchCalendarEventsMock).toHaveBeenCalledTimes(1);
    expect(first.kind).toBe("ok");
    expect(second.kind).toBe("ok");
    if (second.kind === "ok") {
      expect(second.items.map(item => item.id)).toEqual(["event:two"]);
    }
  });

  it("refetches when force is set (retry path)", async () => {
    fetchCalendarEventsMock.mockResolvedValue(
      calendarOk([event({ title: "Warsztat" })])
    );

    await searchEvents("warsztat", "en");
    await searchEvents("warsztat", "en", { force: true });

    expect(fetchCalendarEventsMock).toHaveBeenCalledTimes(2);
  });

  it("returns unavailable when the calendar is unavailable (never throws)", async () => {
    fetchCalendarEventsMock.mockResolvedValue({ kind: "unavailable" });

    await expect(searchEvents("warsztat", "en")).resolves.toEqual({
      kind: "unavailable"
    });
  });

  it("collapses an empty calendar to empty", async () => {
    fetchCalendarEventsMock.mockResolvedValue({ kind: "empty" });

    await expect(searchEvents("warsztat", "en")).resolves.toEqual({
      kind: "empty"
    });
  });

  it("isolates an unexpected rejection", async () => {
    fetchCalendarEventsMock.mockRejectedValue(new Error("boom"));

    await expect(searchEvents("warsztat", "en")).resolves.toEqual({
      kind: "unavailable"
    });
  });
});
