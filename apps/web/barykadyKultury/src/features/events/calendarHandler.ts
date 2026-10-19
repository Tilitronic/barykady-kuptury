import {
  normalizeEvents,
  type GoogleCalendarEvent,
  type NormalizedEvent
} from "./normalize";

/**
 * Read-only Calendar adapter handler (T-023).
 *
 * The handler is a factory with injected upstream/env/clock so the entire HTTP
 * contract is testable without Google or a real clock. It is deliberately the
 * only place that validates browser input and shapes errors:
 *
 * - the browser may narrow the time window and result count, but never choose
 *   the calendar or credentials (docs/architecture.md §5);
 * - the window is bounded to `now … now + 90 days` and results to 50, so one
 *   request cannot ask Google for an unbounded history;
 * - failures collapse to stable JSON codes, never an upstream payload or stack.
 *
 * The Netlify entry (`netlify/functions/calendar-events.ts`) only wires
 * `process.env` and a `fetch`-based upstream into this factory.
 */

/** Server-only configuration. Never read from a request. */
export interface CalendarConfig {
  readonly calendarId?: string | undefined;
  readonly apiKey?: string | undefined;
}

/** Everything the upstream fetcher needs; built only from validated input. */
export interface UpstreamCalendarRequest {
  readonly calendarId: string;
  readonly apiKey: string;
  /** ISO 8601 instant, inclusive lower bound. */
  readonly timeMin: string;
  /** ISO 8601 instant, exclusive upper bound. */
  readonly timeMax: string;
  readonly maxResults: number;
}

/** A read-only Google Calendar listing, as raw events. */
export type FetchUpstream = (
  request: UpstreamCalendarRequest
) => Promise<readonly GoogleCalendarEvent[]>;

export interface CalendarHandlerOptions {
  /**
   * Server-derived configuration. The handler never reads `process.env` itself,
   * so credential names stay confined to the Netlify entry and cannot leak into
   * the browser bundle (T-023 verification greps for them outside tests).
   */
  readonly config: CalendarConfig;
  readonly fetchUpstream: FetchUpstream;
  /** Injected clock keeps `generatedAt` and window defaults deterministic. */
  readonly now: () => Date;
}

/** Response body on success. */
export interface CalendarEventsPayload {
  /**
   * Configured calendar scope (not a secret). T-024 joins Supabase
   * `calendar_event_links` on `(calendarId, event.id)`.
   */
  readonly calendarId: string;
  readonly events: readonly NormalizedEvent[];
  /** ISO 8601 instant the response was produced. */
  readonly generatedAt: string;
}

/** Stable error body; no message, no upstream detail. */
export interface CalendarErrorPayload {
  readonly error:
    | "invalid_request"
    | "calendar_unavailable"
    | "method_not_allowed";
}

export const CALENDAR_CACHE_CONTROL =
  "public, max-age=300, stale-while-revalidate=600";

/** Max look-ahead the browser may request (docs/architecture.md §5). */
export const MAX_WINDOW_DAYS = 90;

/** Max events returned by one request. */
export const MAX_RESULTS = 50;

const DAY_MS = 24 * 60 * 60 * 1000;

const ISO_INSTANT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/;

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8"
} as const;

function jsonResponse(
  body: CalendarEventsPayload | CalendarErrorPayload,
  status: number,
  cacheControl: string,
  extraHeaders: Readonly<Record<string, string>> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...JSON_HEADERS,
      "cache-control": cacheControl,
      ...extraHeaders
    }
  });
}

function errorResponse(
  error: CalendarErrorPayload["error"],
  status: number,
  extraHeaders: Readonly<Record<string, string>> = {}
): Response {
  return jsonResponse({ error }, status, "no-store", extraHeaders);
}

/** Parses an ISO 8601 instant, rejecting values `Date.parse` would coerce. */
function parseInstant(value: string): number | null {
  if (!ISO_INSTANT.test(value)) return null;

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

interface RequestedWindow {
  readonly timeMin: string;
  readonly timeMax: string;
  readonly maxResults: number;
}

/**
 * Validates the browser-controlled query. `calendarId`/`key` are deliberately
 * not read: unknown parameters are ignored, so they cannot influence the
 * upstream request.
 */
function parseQuery(url: URL, nowMs: number): RequestedWindow | null {
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  const maxResultsParam = url.searchParams.get("maxResults");

  const fromMs = fromParam === null ? nowMs : parseInstant(fromParam);
  if (fromMs === null) return null;

  const toMs =
    toParam === null ? nowMs + MAX_WINDOW_DAYS * DAY_MS : parseInstant(toParam);
  if (toMs === null) return null;

  // A past `from` is clamped to now rather than rejected: the UI only shows
  // upcoming events (T-024), and a client clock may legitimately be behind.
  const effectiveFromMs = Math.max(fromMs, nowMs);
  const latestToMs = nowMs + MAX_WINDOW_DAYS * DAY_MS;

  if (toMs <= effectiveFromMs) return null;
  if (toMs > latestToMs) return null;

  let maxResults = MAX_RESULTS;

  if (maxResultsParam !== null) {
    if (!/^\d+$/.test(maxResultsParam)) return null;

    maxResults = Number.parseInt(maxResultsParam, 10);
    if (maxResults < 1 || maxResults > MAX_RESULTS) return null;
  }

  return {
    timeMin: new Date(effectiveFromMs).toISOString(),
    timeMax: new Date(toMs).toISOString(),
    maxResults
  };
}

function isGoogleEvent(value: unknown): value is GoogleCalendarEvent {
  return typeof value === "object" && value !== null;
}

/**
 * Builds the Web-standard request handler.
 *
 * `HEAD` is supported because Netlify/monitors may probe the endpoint; it
 * returns the same status and headers as `GET` with no body, including on the
 * error paths. Every other method is rejected before any upstream call.
 */
export function createCalendarHandler(
  options: CalendarHandlerOptions
): (request: Request) => Promise<Response> {
  const { config, fetchUpstream, now } = options;

  async function handle(request: Request): Promise<Response> {
    const method = request.method.toUpperCase();

    if (method !== "GET" && method !== "HEAD") {
      return errorResponse("method_not_allowed", 405, {
        allow: "GET, HEAD"
      });
    }

    const calendarId = config.calendarId?.trim() ?? "";
    const apiKey = config.apiKey?.trim() ?? "";

    // Missing server configuration is a server fault, not a client error: it is
    // a 500 with the same stable `calendar_unavailable` body the UI already
    // handles, and it is never cached.
    if (calendarId === "" || apiKey === "") {
      return errorResponse("calendar_unavailable", 500);
    }

    const nowDate = now();
    const window = parseQuery(new URL(request.url), nowDate.getTime());

    if (!window) {
      return errorResponse("invalid_request", 400);
    }

    let rawEvents: readonly GoogleCalendarEvent[];

    try {
      const result: unknown = await fetchUpstream({
        calendarId,
        apiKey,
        timeMin: window.timeMin,
        timeMax: window.timeMax,
        maxResults: window.maxResults
      });

      // A malformed upstream body is a failure, not an empty calendar. Treating
      // it as `[]` would hide a broken integration behind a valid empty state.
      if (!Array.isArray(result) || !result.every(isGoogleEvent)) {
        return errorResponse("calendar_unavailable", 502);
      }

      rawEvents = result;
    } catch {
      // Deliberately no logging of the caught error: it may contain the API key
      // or event payload (docs/architecture.md §5, AGENTS.md rule 4).
      return errorResponse("calendar_unavailable", 502);
    }

    return jsonResponse(
      {
        calendarId,
        events: normalizeEvents(rawEvents),
        generatedAt: nowDate.toISOString()
      },
      200,
      CALENDAR_CACHE_CONTROL
    );
  }

  return async function handleRequest(request: Request): Promise<Response> {
    const response = await handle(request);

    // The Fetch standard forbids a body on HEAD; strip it here so error paths
    // behave the same as success and no server runtime has to special-case it.
    if (request.method.toUpperCase() !== "HEAD") return response;

    return new Response(null, {
      status: response.status,
      headers: response.headers
    });
  };
}
