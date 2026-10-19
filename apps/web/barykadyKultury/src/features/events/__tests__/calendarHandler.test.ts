import { describe, expect, it, vi } from "vitest";

import {
  createCalendarHandler,
  type CalendarHandlerOptions
} from "@/features/events/calendarHandler";
import type { GoogleCalendarEvent } from "@/features/events/normalize";

/**
 * Spec axis: docs/tickets/T-023-calendar-adapter.md — handler contract.
 *
 * The handler owns everything a browser can influence: query validation, the
 * bounded window/result count, cache policy and the stable error contract
 * (docs/architecture.md §5). Upstream access is injected, so no test touches
 * Google and every failure path can be exercised deterministically.
 */

const NOW = new Date("2030-05-01T00:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

const TIMED_EVENT: GoogleCalendarEvent = {
  id: "evt-1",
  status: "confirmed",
  summary: "Sample event",
  start: { dateTime: "2030-05-02T16:00:00+02:00", timeZone: "Europe/Warsaw" },
  end: { dateTime: "2030-05-02T18:00:00+02:00", timeZone: "Europe/Warsaw" },
  location: "Sample venue",
  description: "Sample description"
};

function request(path = "/.netlify/functions/calendar-events"): Request {
  return new Request(`https://example.test${path}`, { method: "GET" });
}

function createHandler(
  overrides: Partial<CalendarHandlerOptions> = {}
): (request: Request) => Promise<Response> {
  return createCalendarHandler({
    config: {
      calendarId: "public-calendar@example.org",
      apiKey: "server-side-key"
    },
    now: () => NOW,
    fetchUpstream: async () => [TIMED_EVENT],
    ...overrides
  });
}

async function body(response: Response): Promise<unknown> {
  return response.json();
}

describe("createCalendarHandler — success", () => {
  it("returns the normalized events and generatedAt", async () => {
    const response = await createHandler()(request());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "application/json; charset=utf-8"
    );
    expect(await body(response)).toEqual({
      calendarId: "public-calendar@example.org",
      events: [
        {
          id: "evt-1",
          title: "Sample event",
          start: "2030-05-02T16:00:00+02:00",
          end: "2030-05-02T18:00:00+02:00",
          allDay: false,
          timezone: "Europe/Warsaw",
          location: "Sample venue",
          description: "Sample description",
          registrationUrl: null
        }
      ],
      generatedAt: NOW.toISOString()
    });
  });

  it("sets the short public cache policy", async () => {
    const response = await createHandler()(request());

    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=300, stale-while-revalidate=600"
    );
  });

  it("defaults the window to now → now + 90 days and maxResults to 50", async () => {
    const fetchUpstream = vi.fn(async () => [TIMED_EVENT]);

    await createHandler({ fetchUpstream })(request());

    expect(fetchUpstream).toHaveBeenCalledTimes(1);
    expect(fetchUpstream).toHaveBeenCalledWith({
      calendarId: "public-calendar@example.org",
      apiKey: "server-side-key",
      timeMin: NOW.toISOString(),
      timeMax: new Date(NOW.getTime() + 90 * DAY).toISOString(),
      maxResults: 50
    });
  });

  it("honours a valid narrower window and maxResults", async () => {
    const fetchUpstream = vi.fn(async () => []);
    const from = "2030-05-10T00:00:00.000Z";
    const to = "2030-05-20T00:00:00.000Z";

    const response = await createHandler({ fetchUpstream })(
      request(
        "/.netlify/functions/calendar-events?from=" +
          encodeURIComponent(from) +
          "&to=" +
          encodeURIComponent(to) +
          "&maxResults=10"
      )
    );

    expect(response.status).toBe(200);
    expect(fetchUpstream).toHaveBeenCalledWith({
      calendarId: "public-calendar@example.org",
      apiKey: "server-side-key",
      timeMin: from,
      timeMax: to,
      maxResults: 10
    });
    expect(await body(response)).toMatchObject({
      calendarId: "public-calendar@example.org",
      events: []
    });
  });

  it("never lets the browser override the configured calendar id", async () => {
    const fetchUpstream = vi.fn(async () => []);

    const response = await createHandler({ fetchUpstream })(
      request(
        "/.netlify/functions/calendar-events?calendarId=attacker%40example.org" +
          "&key=attacker-key"
      )
    );

    expect(fetchUpstream).toHaveBeenCalledWith(
      expect.objectContaining({
        calendarId: "public-calendar@example.org",
        apiKey: "server-side-key"
      })
    );
    expect(await body(response)).toMatchObject({
      calendarId: "public-calendar@example.org"
    });
  });

  it("filters cancelled events out of the response", async () => {
    const response = await createHandler({
      fetchUpstream: async () => [
        TIMED_EVENT,
        { ...TIMED_EVENT, id: "evt-cancelled", status: "cancelled" }
      ]
    })(request());

    expect(await body(response)).toMatchObject({
      events: [expect.objectContaining({ id: "evt-1" })]
    });
  });
});

describe("createCalendarHandler — invalid requests", () => {
  it("rejects a window longer than 90 days", async () => {
    const fetchUpstream = vi.fn(async () => []);
    const from = NOW.toISOString();
    const to = new Date(NOW.getTime() + 91 * DAY).toISOString();

    const response = await createHandler({ fetchUpstream })(
      request(
        "/.netlify/functions/calendar-events?from=" +
          encodeURIComponent(from) +
          "&to=" +
          encodeURIComponent(to)
      )
    );

    expect(response.status).toBe(400);
    expect(await body(response)).toEqual({ error: "invalid_request" });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(fetchUpstream).not.toHaveBeenCalled();
  });

  it("rejects a window that extends beyond 90 days from now", async () => {
    const fetchUpstream = vi.fn(async () => []);
    const from = new Date(NOW.getTime() + 100 * DAY).toISOString();
    const to = new Date(NOW.getTime() + 110 * DAY).toISOString();

    const response = await createHandler({ fetchUpstream })(
      request(
        "/.netlify/functions/calendar-events?from=" +
          encodeURIComponent(from) +
          "&to=" +
          encodeURIComponent(to)
      )
    );

    expect(response.status).toBe(400);
    expect(fetchUpstream).not.toHaveBeenCalled();
  });

  it.each(["51", "0", "-1", "abc", "10.5", ""])(
    "rejects maxResults=%j",
    async value => {
      const fetchUpstream = vi.fn(async () => []);

      const response = await createHandler({ fetchUpstream })(
        request(
          "/.netlify/functions/calendar-events?maxResults=" +
            encodeURIComponent(value)
        )
      );

      expect(response.status).toBe(400);
      expect(await body(response)).toEqual({ error: "invalid_request" });
      expect(fetchUpstream).not.toHaveBeenCalled();
    }
  );

  it.each(["not-a-date", "2030-13-40", "2030-05-01T99:00:00Z"])(
    "rejects malformed from=%j",
    async value => {
      const response = await createHandler()(
        request(
          "/.netlify/functions/calendar-events?from=" +
            encodeURIComponent(value)
        )
      );

      expect(response.status).toBe(400);
      expect(await body(response)).toEqual({ error: "invalid_request" });
    }
  );

  it("rejects an inverted window", async () => {
    const from = new Date(NOW.getTime() + 5 * DAY).toISOString();
    const to = NOW.toISOString();

    const response = await createHandler()(
      request(
        "/.netlify/functions/calendar-events?from=" +
          encodeURIComponent(from) +
          "&to=" +
          encodeURIComponent(to)
      )
    );

    expect(response.status).toBe(400);
  });

  it("rejects non-GET methods", async () => {
    const fetchUpstream = vi.fn(async () => []);

    const response = await createHandler({ fetchUpstream })(
      new Request("https://example.test/.netlify/functions/calendar-events", {
        method: "POST"
      })
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, HEAD");
    expect(fetchUpstream).not.toHaveBeenCalled();
  });

  it("answers HEAD with the same status and cache headers but no body", async () => {
    const response = await createHandler()(
      new Request("https://example.test/.netlify/functions/calendar-events", {
        method: "HEAD"
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=300, stale-while-revalidate=600"
    );
    expect(await response.text()).toBe("");
  });
});

describe("createCalendarHandler — configuration", () => {
  it.each([
    [{ calendarId: undefined, apiKey: "key" }],
    [{ calendarId: "calendar", apiKey: undefined }],
    [{ calendarId: "", apiKey: "" }],
    [{ calendarId: "   ", apiKey: "key" }]
  ])(
    "returns 500 calendar_unavailable when the calendar is unconfigured (%j)",
    async config => {
      const fetchUpstream = vi.fn(async () => []);

      const response = await createHandler({ config, fetchUpstream })(
        request()
      );

      expect(response.status).toBe(500);
      expect(await body(response)).toEqual({
        error: "calendar_unavailable"
      });
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(fetchUpstream).not.toHaveBeenCalled();
    }
  );
});

describe("createCalendarHandler — upstream failure", () => {
  it("returns a stable 502 without leaking the thrown error", async () => {
    const response = await createHandler({
      fetchUpstream: async () => {
        throw new Error(
          "Google said 403: key=server-side-key payload=SECRET-EVENT-DATA"
        );
      }
    })(request());

    expect(response.status).toBe(502);
    expect(await body(response)).toEqual({ error: "calendar_unavailable" });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-type")).toBe(
      "application/json; charset=utf-8"
    );
  });

  it("does not leak a stack or upstream payload in the body", async () => {
    const response = await createHandler({
      fetchUpstream: async () => {
        throw new Error("SECRET-EVENT-DATA at /srv/function.ts:42");
      }
    })(request());

    const text = await response.text();

    expect(text).not.toContain("SECRET-EVENT-DATA");
    expect(text).not.toContain("/srv/function.ts");
    expect(text).not.toContain("server-side-key");
    expect(text).not.toContain("stack");
  });

  it("returns a stable 502 for a malformed upstream payload", async () => {
    const response = await createHandler({
      // A non-array payload cannot be normalized; the handler must not crash.
      fetchUpstream: async () =>
        ({ items: "not-an-array" }) as unknown as GoogleCalendarEvent[]
    })(request());

    expect(response.status).toBe(502);
    expect(await body(response)).toEqual({ error: "calendar_unavailable" });
  });
});
