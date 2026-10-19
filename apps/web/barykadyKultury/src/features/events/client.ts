import type { NormalizedEvent } from "./normalize";

/**
 * Browser-side client for the read-only Calendar adapter (T-024).
 *
 * Contract source: the T-023 ticket Log — `GET /.netlify/functions/calendar-events`
 * answers `200 { calendarId, events, generatedAt }` or a controlled
 * `{ error }` with 400/405/500/502. The rule the page depends on: **any**
 * non-200, unparseable or structurally wrong payload is the calendar-unavailable
 * state — the UI must never render a blank success (docs/PRODUCT_REQUIREMENTS.md §5).
 *
 * `fetchImpl` is injectable so tests (and the hook) control the transport;
 * the production call site uses the platform `fetch`.
 */

export const CALENDAR_EVENTS_ENDPOINT = "/.netlify/functions/calendar-events";

/** Calendar read outcome; `ok` additionally carries the join scope. */
export type CalendarEventsResult =
  | {
      readonly kind: "ok";
      readonly calendarId: string;
      readonly events: readonly NormalizedEvent[];
    }
  | { readonly kind: "empty" }
  | { readonly kind: "unavailable" };

export interface CalendarClientOptions {
  readonly fetchImpl?: typeof fetch;
}

function isNullableString(value: unknown): boolean {
  return value === null || typeof value === "string";
}

/** Field-level guard of the T-023 wire shape (no re-serialization). */
function isNormalizedEvent(value: unknown): value is NormalizedEvent {
  if (typeof value !== "object" || value === null) return false;

  const event = value as Record<string, unknown>;

  return (
    typeof event.id === "string" &&
    event.id !== "" &&
    typeof event.title === "string" &&
    event.title !== "" &&
    typeof event.start === "string" &&
    event.start !== "" &&
    typeof event.allDay === "boolean" &&
    typeof event.timezone === "string" &&
    isNullableString(event.end) &&
    isNullableString(event.location) &&
    isNullableString(event.description) &&
    isNullableString(event.registrationUrl)
  );
}

function parsePayload(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** `null` means "structurally wrong payload" → caller maps it to unavailable. */
function readPayload(
  raw: unknown
): { calendarId: string; events: NormalizedEvent[] } | null {
  if (typeof raw !== "object" || raw === null) return null;

  const payload = raw as Record<string, unknown>;
  if (typeof payload.calendarId !== "string" || payload.calendarId === "") {
    return null;
  }
  if (!Array.isArray(payload.events)) return null;

  // Individual malformed events are dropped rather than guessed at; the
  // adapter already excludes cancelled/deleted ones upstream.
  const events = payload.events.filter(isNormalizedEvent);

  return { calendarId: payload.calendarId, events };
}

export async function fetchCalendarEvents(
  options: CalendarClientOptions = {}
): Promise<CalendarEventsResult> {
  const fetchImpl = options.fetchImpl;

  try {
    const response = await (fetchImpl ?? globalThis.fetch)(
      CALENDAR_EVENTS_ENDPOINT,
      { headers: { accept: "application/json" } }
    );

    if (!response.ok) return { kind: "unavailable" };

    const parsed = readPayload(parsePayload(await response.text()));
    if (!parsed) return { kind: "unavailable" };

    return parsed.events.length === 0
      ? { kind: "empty" }
      : { kind: "ok", calendarId: parsed.calendarId, events: parsed.events };
  } catch {
    // Network failure, aborted request, anything: unavailable, never blank.
    return { kind: "unavailable" };
  }
}
