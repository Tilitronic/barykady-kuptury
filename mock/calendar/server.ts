/**
 * Bun mock for the production Google Calendar adapter (T-037, Lane B).
 *
 * It deliberately serves the *production path* (`/.netlify/functions/calendar-events`)
 * and delegates every request to the real T-023 handler factory. Validation,
 * normalization, cache headers and the 400/500/502 error contract therefore
 * cannot drift into a second implementation — the only mock-specific behavior
 * is scenario selection and CORS.
 *
 * No Google credential or network call exists here. The API key below is a
 * sentinel that satisfies the handler's configuration guard; it is never
 * returned (the handler only returns the public calendar id).
 */

import {
  createCalendarHandler,
  type FetchUpstream
} from "../../apps/web/barykadyKultury/src/features/events/calendarHandler";
import { buildScenarioEvents, isCalendarScenario } from "./fixtures";

export const CALENDAR_MOCK_PATH = "/.netlify/functions/calendar-events";
export const CALENDAR_MOCK_CALENDAR_ID = "demo-calendar@example.invalid";
export const DEFAULT_CALENDAR_MOCK_PORT = 8787;

/** Demo-only sentinel: satisfies `createCalendarHandler`'s config guard. */
const MOCK_API_KEY = "demo-calendar-mock-key";

/**
 * Same-origin in the browser thanks to the Vite dev proxy; these origins only
 * matter when the mock is opened directly (e.g. during `pnpm demo:check`).
 */
export const ALLOWED_ORIGINS = [
  "http://localhost:9000",
  "http://127.0.0.1:9000"
] as const;

const ALLOWED_ORIGIN_SET = new Set<string>(ALLOWED_ORIGINS);

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8"
} as const;

export interface CalendarMockServerOptions {
  /** 0 asks the OS for a free port (used by tests). */
  readonly port?: number;
  readonly hostname?: string;
  /** Injected clock keeps `generatedAt` and fixtures deterministic in tests. */
  readonly now?: () => Date;
}

/** Reads `CALENDAR_MOCK_PORT`, falling back on anything non-numeric. */
export function resolveMockPort(
  value: string | undefined = process.env.CALENDAR_MOCK_PORT
): number {
  if (value === undefined || value.trim() === "") {
    return DEFAULT_CALENDAR_MOCK_PORT;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    return DEFAULT_CALENDAR_MOCK_PORT;
  }

  return parsed;
}

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = { vary: "Origin" };

  if (origin !== null && ALLOWED_ORIGIN_SET.has(origin)) {
    headers["access-control-allow-origin"] = origin;
  }

  return headers;
}

/** Mock-owned errors only: unknown scenario / unknown path. */
function mockError(
  error: "invalid_request" | "not_found",
  status: number,
  cors: Record<string, string>
): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: {
      ...JSON_HEADERS,
      "cache-control": "no-store",
      ...cors
    }
  });
}

function withCors(response: Response, cors: Record<string, string>): Response {
  const headers = new Headers(response.headers);

  for (const [name, value] of Object.entries(cors)) {
    headers.set(name, value);
  }

  return new Response(response.body, { status: response.status, headers });
}

/**
 * One stateless request pipeline, exported so tests can drive it without a
 * listening socket. `now` is captured once per request and shared by
 * `generatedAt` and fixtures, which is what makes the clock injection exact.
 */
export async function handleMockRequest(
  request: Request,
  now: Date
): Promise<Response> {
  const url = new URL(request.url);
  const cors = corsHeaders(request.headers.get("origin"));

  // CORS preflight is transport-level and must not be validated by the
  // production handler (which correctly rejects OPTIONS with 405).
  if (request.method.toUpperCase() === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...cors,
        // The real handler answers GET/HEAD; POST/others are 405. The mock
        // advertises exactly what callers may use.
        "access-control-allow-methods": "GET, HEAD, OPTIONS",
        "access-control-allow-headers": "content-type, accept",
        "access-control-max-age": "600"
      }
    });
  }

  if (url.pathname !== CALENDAR_MOCK_PATH) {
    return mockError("not_found", 404, cors);
  }

  const scenarioParam = url.searchParams.get("scenario");
  const scenario = scenarioParam ?? "default";

  if (!isCalendarScenario(scenario)) {
    return mockError("invalid_request", 400, cors);
  }

  const fetchUpstream: FetchUpstream = async () => {
    if (scenario === "unavailable") {
      // Exercises the real handler's 502 path; no upstream detail escapes.
      throw new Error("demo calendar upstream unavailable");
    }

    return buildScenarioEvents(scenario, now);
  };

  const response = await createCalendarHandler({
    config: {
      calendarId: CALENDAR_MOCK_CALENDAR_ID,
      apiKey: MOCK_API_KEY
    },
    fetchUpstream,
    now: () => now
  })(request);

  return withCors(response, cors);
}

export function createCalendarMockServer(
  options: CalendarMockServerOptions = {}
): ReturnType<typeof Bun.serve> {
  const clock = options.now ?? (() => new Date());

  return Bun.serve({
    port: options.port ?? resolveMockPort(),
    hostname: options.hostname ?? "127.0.0.1",
    fetch(request) {
      return handleMockRequest(request, clock());
    }
  });
}

if (import.meta.main) {
  const server = createCalendarMockServer();

  console.log(
    `[calendar-mock] ${CALENDAR_MOCK_CALENDAR_ID} listening on ` +
      `http://127.0.0.1:${server.port}${CALENDAR_MOCK_PATH}`
  );
  console.log(
    "[calendar-mock] scenarios: default, empty, unavailable, dense, long, dst " +
      "via ?scenario=…"
  );
}
