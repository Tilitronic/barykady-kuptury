import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import calendarEvents from "../../../../../netlify/functions/calendar-events";

/**
 * Spec axis: docs/tickets/T-023-calendar-adapter.md — the Netlify entry is a
 * thin binding, not business logic.
 *
 * Importing the real entry also pulls the repo-root `netlify/` tree into the
 * app TypeScript program (the app tsconfig only includes the app directory), so
 * `pnpm typecheck` proves the adapter stays type-safe.
 *
 * The assertions cover the boundary that matters for security: configuration is
 * read from `process.env` on the server at request time, and nothing the
 * browser sends can redirect the request to another calendar or expose a key.
 */

const CALENDAR_ID = "public-calendar@example.org";
const API_KEY = "server-side-api-key";

const GOOGLE_RESPONSE = {
  kind: "calendar#events",
  items: [
    {
      kind: "calendar#event",
      etag: '"etag"',
      id: "evt-adapter-1",
      status: "confirmed",
      summary: "Adapter event",
      start: {
        dateTime: "2030-05-02T16:00:00+02:00",
        timeZone: "Europe/Warsaw"
      },
      end: {
        dateTime: "2030-05-02T18:00:00+02:00",
        timeZone: "Europe/Warsaw"
      },
      htmlLink: "https://calendar.google.com/event?eid=internal"
    }
  ]
};

function googleOk(): Response {
  return new Response(JSON.stringify(GOOGLE_RESPONSE), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}

function request(path = "/.netlify/functions/calendar-events"): Request {
  return new Request(`https://example.test${path}`);
}

describe("netlify/functions/calendar-events", () => {
  const originalEnv = { ...process.env };
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env.GOOGLE_CALENDAR_ID = CALENDAR_ID;
    process.env.GOOGLE_CALENDAR_API_KEY = API_KEY;

    fetchMock = vi.fn(async () => googleOk());
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
  });

  it("delegates to the Google Calendar v3 events endpoint", async () => {
    const response = await calendarEvents(request());
    const payload = (await response.json()) as {
      calendarId: string;
      events: unknown[];
      generatedAt: string;
    };

    expect(response.status).toBe(200);
    expect(payload.calendarId).toBe(CALENDAR_ID);
    expect(payload.events).toHaveLength(1);
    expect(payload.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url).toBeInstanceOf(URL);
    expect(url.origin).toBe("https://www.googleapis.com");
    expect(url.pathname).toBe(
      `/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events`
    );
    expect(url.searchParams.get("key")).toBe(API_KEY);
    expect(url.searchParams.get("singleEvents")).toBe("true");
    expect(url.searchParams.get("orderBy")).toBe("startTime");
    expect(url.searchParams.get("showDeleted")).toBe("false");
    expect(init.method).toBe("GET");
  });

  it("returns normalized events without Google-internal fields", async () => {
    const response = await calendarEvents(request());
    const payload = (await response.json()) as {
      calendarId: string;
      events: Record<string, unknown>[];
    };

    expect(payload.calendarId).toBe(CALENDAR_ID);
    expect(payload.events[0]).toEqual({
      id: "evt-adapter-1",
      title: "Adapter event",
      start: "2030-05-02T16:00:00+02:00",
      end: "2030-05-02T18:00:00+02:00",
      allDay: false,
      timezone: "Europe/Warsaw",
      location: null,
      description: null,
      registrationUrl: null
    });
    // calendarId is a top-level scope, not duplicated on each event.
    expect(payload.events[0]).not.toHaveProperty("calendarId");
  });

  it("reads configuration from process.env at request time", async () => {
    process.env.GOOGLE_CALENDAR_ID = "another-calendar@example.org";

    await calendarEvents(request());

    const [url] = fetchMock.mock.calls[0] as [URL];
    expect(url.pathname).toContain(
      encodeURIComponent("another-calendar@example.org")
    );
  });

  it("never exposes the API key or upstream URL in the response", async () => {
    const text = await (await calendarEvents(request())).text();

    expect(text).not.toContain(API_KEY);
    expect(text).not.toContain("www.googleapis.com");
  });

  it("ignores browser attempts to override the calendar or key", async () => {
    await calendarEvents(
      request(
        "/.netlify/functions/calendar-events" +
          "?calendarId=attacker%40example.org&key=attacker-key"
      )
    );

    const [url] = fetchMock.mock.calls[0] as [URL];
    expect(url.pathname).toContain(encodeURIComponent(CALENDAR_ID));
    expect(url.pathname).not.toContain("attacker");
    expect(url.searchParams.get("key")).toBe(API_KEY);
  });

  it("fails closed with 500 calendar_unavailable when configuration is absent", async () => {
    delete process.env.GOOGLE_CALENDAR_ID;
    delete process.env.GOOGLE_CALENDAR_API_KEY;

    const response = await calendarEvents(request());

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "calendar_unavailable"
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps an upstream HTTP failure to the stable 502 contract", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(`{"error":{"message":"API key ${API_KEY} invalid"}}`, {
        status: 403
      })
    );

    const response = await calendarEvents(request());
    const text = await response.text();

    expect(response.status).toBe(502);
    expect(JSON.parse(text)).toEqual({ error: "calendar_unavailable" });
    expect(text).not.toContain(API_KEY);
    expect(text).not.toContain("API key");
  });

  it("maps a network rejection to the stable 502 contract", async () => {
    fetchMock.mockRejectedValueOnce(
      new Error(`network down while calling key=${API_KEY}`)
    );

    const response = await calendarEvents(request());
    const text = await response.text();

    expect(response.status).toBe(502);
    expect(JSON.parse(text)).toEqual({ error: "calendar_unavailable" });
    expect(text).not.toContain(API_KEY);
  });

  it("treats a successful Google response without items as an empty list", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ kind: "calendar#events" }), { status: 200 })
    );

    const response = await calendarEvents(request());
    const payload = (await response.json()) as { events: unknown[] };

    expect(response.status).toBe(200);
    expect(payload.events).toEqual([]);
  });

  it("treats a non-array items payload as a 502, not an empty calendar", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ items: "broken" }), { status: 200 })
    );

    const response = await calendarEvents(request());

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "calendar_unavailable" });
  });
});
