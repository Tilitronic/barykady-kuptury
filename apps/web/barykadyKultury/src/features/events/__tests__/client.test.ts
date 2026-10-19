import { describe, expect, it, vi } from "vitest";

import {
  CALENDAR_EVENTS_ENDPOINT,
  fetchCalendarEvents
} from "@/features/events/client";

/**
 * Feature-layer calendar client (T-024). The brief is blunt: **any** non-200,
 * unparseable or structurally wrong payload is the unavailable state — the
 * page must never render a blank success. Individual malformed events are
 * dropped, not guessed at (the adapter contract in T-023's ticket Log defines
 * the expected shape).
 */

const OK_EVENT = {
  id: "fixture-event-timed",
  title: "Sample timed event",
  start: "2030-05-14T16:00:00+02:00",
  end: "2030-05-14T18:00:00+02:00",
  allDay: false,
  timezone: "Europe/Warsaw",
  location: "Sample venue",
  description: "Deterministic E2E fixture.",
  registrationUrl: "https://example.org/register"
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function fetchReturning(response: Response) {
  return vi.fn(async () => response) as unknown as typeof fetch;
}

describe("fetchCalendarEvents", () => {
  it("resolves the ok payload with the calendar scope for the join", async () => {
    const fetchImpl = fetchReturning(
      jsonResponse({
        calendarId: "fixture-calendar@example.org",
        events: [OK_EVENT],
        generatedAt: "2030-04-30T12:00:00.000Z"
      })
    );

    const result = await fetchCalendarEvents({ fetchImpl });

    expect(result).toEqual({
      kind: "ok",
      calendarId: "fixture-calendar@example.org",
      events: [OK_EVENT]
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      CALENDAR_EVENTS_ENDPOINT,
      expect.anything()
    );
  });

  it("collapses an empty event list to the empty kind", async () => {
    const result = await fetchCalendarEvents({
      fetchImpl: fetchReturning(
        jsonResponse({
          calendarId: "c@example.org",
          events: [],
          generatedAt: "2030-04-30T12:00:00.000Z"
        })
      )
    });

    expect(result).toEqual({ kind: "empty" });
  });

  it("treats every non-200 (400/500/502) as unavailable", async () => {
    for (const status of [400, 500, 502, 404]) {
      const result = await fetchCalendarEvents({
        fetchImpl: fetchReturning(jsonResponse({ error: "x" }, status))
      });
      expect(result, `status ${status}`).toEqual({ kind: "unavailable" });
    }
  });

  it("treats an unparseable body as unavailable, never a blank success", async () => {
    const result = await fetchCalendarEvents({
      fetchImpl: fetchReturning(
        new Response("<html>not json</html>", {
          status: 200,
          headers: { "content-type": "text/html" }
        })
      )
    });

    expect(result).toEqual({ kind: "unavailable" });
  });

  it("treats a structurally wrong payload as unavailable", async () => {
    const cases: unknown[] = [
      null,
      "a string",
      { events: "not-an-array", calendarId: "c" },
      { calendarId: 42, events: [OK_EVENT] },
      { events: [OK_EVENT] }
    ];

    for (const body of cases) {
      const result = await fetchCalendarEvents({
        fetchImpl: fetchReturning(jsonResponse(body))
      });
      expect(result, JSON.stringify(body)).toEqual({ kind: "unavailable" });
    }
  });

  it("drops individual malformed events but keeps the usable ones", async () => {
    const result = await fetchCalendarEvents({
      fetchImpl: fetchReturning(
        jsonResponse({
          calendarId: "c@example.org",
          events: [
            OK_EVENT,
            { title: "no id", start: "2030-06-01T10:00:00+02:00" },
            { id: "no start", title: "T" },
            { id: "bad type", title: "T", start: 12345 }
          ],
          generatedAt: "2026-01-01T00:00:00.000Z"
        })
      )
    });

    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.events).toEqual([OK_EVENT]);
    }
  });

  it("treats a network rejection as unavailable", async () => {
    const result = await fetchCalendarEvents({
      fetchImpl: vi.fn(async () => {
        throw new TypeError("network down");
      }) as unknown as typeof fetch
    });

    expect(result).toEqual({ kind: "unavailable" });
  });
});
