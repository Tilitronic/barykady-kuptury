import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import { fetchCalendarEvents } from "../../apps/web/barykadyKultury/src/features/events/client";
import { buildScenarioEvents, nextWarsawSpringForward } from "./fixtures";
import {
  CALENDAR_MOCK_CALENDAR_ID,
  CALENDAR_MOCK_PATH,
  DEFAULT_CALENDAR_MOCK_PORT,
  handleMockRequest,
  resolveMockPort,
  createCalendarMockServer
} from "./server";

/**
 * Contract tests for the Bun calendar mock (T-037, Lane B).
 *
 * The suite deliberately goes over HTTP and then through the browser client's
 * strict field guard, so a fixture that normalizes into a shape T-024 would
 * reject fails here rather than in the demo.
 */

const FIXED_NOW = new Date("2030-05-01T10:00:00.000Z");
const DEMO_REGISTRATION_URL = "https://example.invalid/demo/register";

interface WireEvent {
  id: string;
  title: string;
  start: string;
  end: string | null;
  allDay: boolean;
  timezone: string;
  location: string | null;
  description: string | null;
  registrationUrl: string | null;
}

interface WirePayload {
  calendarId: string;
  events: WireEvent[];
  generatedAt: string;
}

let server: ReturnType<typeof createCalendarMockServer>;
let baseUrl: string;

function endpoint(query = ""): string {
  return `${baseUrl}${CALENDAR_MOCK_PATH}${query}`;
}

async function readPayload(response: Response): Promise<WirePayload> {
  return (await response.json()) as WirePayload;
}

beforeAll(() => {
  server = createCalendarMockServer({ port: 0, now: () => FIXED_NOW });
  baseUrl = `http://127.0.0.1:${server.port}`;
});

afterAll(async () => {
  await server.stop(true);
});

describe("scenario fixtures", () => {
  it("are deterministic for a fixed clock", () => {
    expect(buildScenarioEvents("default", FIXED_NOW)).toEqual(
      buildScenarioEvents("default", FIXED_NOW)
    );
  });

  it("stay upcoming relative to whatever clock is injected", () => {
    const laterClock = new Date("2031-01-15T08:00:00.000Z");
    const events = buildScenarioEvents("default", laterClock);

    for (const event of events) {
      if (event.start?.dateTime !== undefined) {
        expect(Date.parse(event.start.dateTime)).toBeGreaterThan(
          laterClock.getTime()
        );
      } else {
        // All-day fixtures advance with the clock too (date-only compare).
        expect((event.start?.date ?? "") >= "2031-01-15").toBe(true);
      }
    }
  });

  it("uses the fixed demo calendar id and stable ids on the wire", async () => {
    const response = await fetch(endpoint());
    const payload = await readPayload(response);

    expect(payload.calendarId).toBe(CALENDAR_MOCK_CALENDAR_ID);
    expect(payload.events.map(event => event.id)).toEqual([
      "demo-evt-0001",
      "demo-evt-0002",
      "demo-evt-0003",
      "demo-evt-0004",
      "demo-evt-0005"
    ]);
  });
});

describe("default scenario", () => {
  it("returns five upcoming events, generated from the injected clock", async () => {
    const response = await fetch(endpoint());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=300, stale-while-revalidate=600"
    );

    const payload = await readPayload(response);

    expect(payload.generatedAt).toBe(FIXED_NOW.toISOString());
    expect(payload.events).toHaveLength(5);
    expect(new Set(payload.events.map(event => event.id)).size).toBe(5);

    for (const event of payload.events) {
      if (event.allDay) {
        expect(event.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(event.start >= "2030-05-01").toBe(true);
      } else {
        expect(Date.parse(event.start)).toBeGreaterThan(FIXED_NOW.getTime());
      }
    }
  });

  it("puts the three nearest events first for the homepage", async () => {
    const payload = await readPayload(await fetch(endpoint()));

    const timedStarts = payload.events
      .filter(event => !event.allDay)
      .map(event => Date.parse(event.start));

    expect(timedStarts).toEqual([...timedStarts].sort((a, b) => a - b));
    expect(payload.events.slice(0, 3).map(event => event.id)).toEqual([
      "demo-evt-0001",
      "demo-evt-0002",
      "demo-evt-0003"
    ]);
  });

  it("includes an all-day event with date-only start/end", async () => {
    const payload = await readPayload(await fetch(endpoint()));
    const allDay = payload.events.filter(event => event.allDay);

    expect(allDay).toHaveLength(1);
    expect(allDay[0]?.id).toBe("demo-evt-0004");
    expect(allDay[0]?.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(allDay[0]?.end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(allDay[0]?.end).not.toBe(allDay[0]?.start);
  });

  it("keeps location and extracts a validated http(s) registration URL", async () => {
    const payload = await readPayload(await fetch(endpoint()));
    const event = payload.events.find(item => item.id === "demo-evt-0002");

    expect(event?.location).toBe("Sala demo, ul. Przykładowa 2, Warszawa");
    expect(event?.registrationUrl).toBe(DEMO_REGISTRATION_URL);
    expect(event?.description).toContain("Zapisz się");
    expect(event?.description).not.toContain("<");
  });

  it("strips stubbed HTML and script bodies from descriptions", async () => {
    const payload = await readPayload(await fetch(endpoint()));
    const event = payload.events.find(item => item.id === "demo-evt-0003");

    expect(event?.description).toBe("Przynieś ziny do wymiany. Do zobaczenia!");
    expect(event?.description).not.toContain("alert");
    expect(event?.registrationUrl).toBeNull();
  });

  it("emits nulls (never omissions) for absent optional fields", async () => {
    const payload = await readPayload(await fetch(endpoint()));
    const event = payload.events.find(item => item.id === "demo-evt-0005");

    expect(event).toMatchObject({
      location: null,
      description: null,
      registrationUrl: null
    });
    expect(event?.timezone).toBe("Europe/Warsaw");
  });
});

describe("other scenarios", () => {
  it("empty returns a valid 200 with zero events", async () => {
    const response = await fetch(endpoint("?scenario=empty"));
    const payload = await readPayload(response);

    expect(response.status).toBe(200);
    expect(payload.events).toEqual([]);
    expect(payload.calendarId).toBe(CALENDAR_MOCK_CALENDAR_ID);
  });

  it("unavailable returns the real handler's 502 body without detail", async () => {
    const response = await fetch(endpoint("?scenario=unavailable"));
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(502);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toEqual({ error: "calendar_unavailable" });
    expect(JSON.stringify(body)).not.toContain("stack");
  });

  it("dense returns twenty ordered events for list stress", async () => {
    const response = await fetch(endpoint("?scenario=dense"));
    const payload = await readPayload(response);

    expect(response.status).toBe(200);
    expect(payload.events).toHaveLength(20);
    expect(payload.events.map(event => event.id)).toEqual(
      Array.from(
        { length: 20 },
        (_, index) => `demo-evt-${String(index + 1).padStart(4, "0")}`
      )
    );
    expect(payload.events.filter(event => event.allDay)).toHaveLength(2);
  });

  it("long carries long Polish and Ukrainian titles for 320 px", async () => {
    const response = await fetch(endpoint("?scenario=long"));
    const payload = await readPayload(response);

    expect(response.status).toBe(200);
    expect(payload.events).toHaveLength(5);
    expect(payload.events[0]?.title).toContain("Międzynarodowy");
    expect(payload.events[0]?.title.length).toBeGreaterThan(80);
    expect(payload.events[1]?.title).toContain("Міжнародний");
    expect(payload.events[1]?.title.length).toBeGreaterThan(80);
    expect(payload.events.filter(event => event.allDay)).toHaveLength(1);
  });

  it("dst straddles the Europe/Warsaw spring-forward offset change", async () => {
    const response = await fetch(endpoint("?scenario=dst"));
    const payload = await readPayload(response);
    const transition = nextWarsawSpringForward(FIXED_NOW);
    const first = payload.events[0];
    const last = payload.events[payload.events.length - 1];

    expect(response.status).toBe(200);
    expect(payload.events).toHaveLength(4);

    // Before the transition Warsaw is +01:00; after it is +02:00.
    expect(first?.start.endsWith("+01:00")).toBe(true);
    expect(last?.start.endsWith("+02:00")).toBe(true);

    const firstStart = Date.parse(first?.start ?? "");
    const lastStart = Date.parse(last?.start ?? "");

    expect(firstStart).toBeLessThan(transition.getTime());
    expect(lastStart).toBeGreaterThan(transition.getTime());
    expect(firstStart).toBeLessThan(lastStart);
  });

  it("rejects an unknown scenario with the stable 400 body", async () => {
    const response = await fetch(endpoint("?scenario=nope"));
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toEqual({ error: "invalid_request" });
  });
});

describe("CORS", () => {
  it("echoes both documented dev origins on GET", async () => {
    for (const origin of ["http://localhost:9000", "http://127.0.0.1:9000"]) {
      const response = await fetch(endpoint(), { headers: { origin } });

      expect(response.status).toBe(200);
      expect(response.headers.get("access-control-allow-origin")).toBe(origin);
      expect(response.headers.get("vary")).toContain("Origin");
      expect(
        response.headers.get("access-control-allow-credentials")
      ).toBeNull();
    }
  });

  it("answers OPTIONS preflight without invoking the production handler", async () => {
    const response = await fetch(endpoint(), {
      method: "OPTIONS",
      headers: {
        origin: "http://localhost:9000",
        "access-control-request-method": "GET"
      }
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:9000"
    );
    expect(response.headers.get("access-control-allow-methods")).toContain(
      "OPTIONS"
    );
    expect(response.headers.get("access-control-allow-headers")).toContain(
      "content-type"
    );
    expect(response.headers.get("access-control-max-age")).toBe("600");
  });

  it("does not grant an unlisted origin", async () => {
    const response = await fetch(endpoint(), {
      headers: { origin: "https://evil.example" }
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });
});

describe("production handler delegation", () => {
  it("still rejects POST with the handler's own 405 contract", async () => {
    const response = await fetch(endpoint(), { method: "POST" });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, HEAD");
    expect(body).toEqual({ error: "method_not_allowed" });
  });

  it("returns 404 for a non-production path", async () => {
    const response = await fetch(`${baseUrl}/not-the-adapter`);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
  });
});

describe("wire shape vs the browser client guard", () => {
  it("passes fetchCalendarEvents' strict field guard with no dropped events", async () => {
    const fetchImpl = (async (
      input: string | URL | Request,
      init?: RequestInit
    ) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;

      return fetch(new URL(url, baseUrl), init);
    }) as typeof fetch;

    const result = await fetchCalendarEvents({ fetchImpl });

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;

    expect(result.calendarId).toBe(CALENDAR_MOCK_CALENDAR_ID);
    // The client filters malformed events; five surviving events prove every
    // required field (id/title/start/allDay/timezone + nullable optionals)
    // is present and correctly typed.
    expect(result.events).toHaveLength(5);
    expect(result.events.map(event => event.id)).toEqual([
      "demo-evt-0001",
      "demo-evt-0002",
      "demo-evt-0003",
      "demo-evt-0004",
      "demo-evt-0005"
    ]);

    for (const event of result.events) {
      expect(typeof event.id).toBe("string");
      expect(event.id).not.toBe("");
      expect(typeof event.title).toBe("string");
      expect(event.title).not.toBe("");
      expect(typeof event.start).toBe("string");
      expect(event.start).not.toBe("");
      expect(typeof event.allDay).toBe("boolean");
      expect(typeof event.timezone).toBe("string");
      expect(event.end === null || typeof event.end === "string").toBe(true);
      expect(
        event.location === null || typeof event.location === "string"
      ).toBe(true);
      expect(
        event.description === null || typeof event.description === "string"
      ).toBe(true);
      expect(
        event.registrationUrl === null ||
          typeof event.registrationUrl === "string"
      ).toBe(true);
    }
  });
});

describe("clock injection and port resolution", () => {
  it("uses the injected clock for generatedAt and is stable across calls", async () => {
    const requestUrl = `http://127.0.0.1:8787${CALENDAR_MOCK_PATH}`;

    const first = await readPayload(
      await handleMockRequest(new Request(requestUrl), FIXED_NOW)
    );
    const second = await readPayload(
      await handleMockRequest(new Request(requestUrl), FIXED_NOW)
    );

    expect(first.generatedAt).toBe(FIXED_NOW.toISOString());
    expect(second.generatedAt).toBe(FIXED_NOW.toISOString());
    expect(second.events).toEqual(first.events);

    const otherClock = new Date("2030-05-02T10:00:00.000Z");
    const moved = await readPayload(
      await handleMockRequest(new Request(requestUrl), otherClock)
    );

    expect(moved.generatedAt).toBe(otherClock.toISOString());
    expect(moved.events).not.toEqual(first.events);
  });

  it("defaults the port to 8787 and ignores invalid overrides", () => {
    expect(DEFAULT_CALENDAR_MOCK_PORT).toBe(8787);
    expect(resolveMockPort("9999")).toBe(9999);
    expect(resolveMockPort("")).toBe(8787);
    expect(resolveMockPort("abc")).toBe(8787);
    expect(resolveMockPort("0")).toBe(8787);
    expect(resolveMockPort("70000")).toBe(8787);
  });
});
