import type { NormalizedEvent } from "../../src/features/events/normalize";

/**
 * Deterministic, clearly fictional calendar fixtures.
 *
 * These mirror the final normalized wire contract of the read-only Calendar
 * adapter function (T-023, docs/architecture.md §5) and contain no real NGO
 * content, personal data, or credentials. Timestamps are fixed so E2E
 * assertions never depend on the wall clock or a specific machine timezone
 * (docs/TESTING.md §2).
 *
 * Contract notes finalized by T-023:
 * - cancelled/deleted events are filtered server-side, so there is no
 *   `cancelled` field on the wire;
 * - all-day events carry date-only `start`/`end` (never shifted by timezone);
 * - absent optional values are `null`, not omitted;
 * - the project association is a Supabase join owned by T-024, so no
 *   `projectSlug` appears in the calendar payload.
 */

/**
 * A normalized public calendar event as exposed to the frontend.
 *
 * Typed by the adapter's own contract rather than a copy, so a future wire
 * change breaks the fixture at type-check time instead of letting the mocks
 * drift from the function (ticket T-023 REFACTOR step 5).
 */
export type CalendarEvent = NormalizedEvent;

/** Response body of `/.netlify/functions/calendar-events`. */
export interface CalendarEventsResponse {
  /** Configured calendar scope; T-024 joins links by `(calendarId, event.id)`. */
  calendarId: string;
  events: CalendarEvent[];
  /** ISO 8601 instant the function produced the response. */
  generatedAt: string;
}

/** Public (non-secret) fixture calendar id, deliberately fictional. */
export const CALENDAR_EVENTS_CALENDAR_ID = "fixture-calendar@example.org";

/** Fixed timestamp so the fixture body is byte-for-byte deterministic. */
export const CALENDAR_EVENTS_GENERATED_AT = "2030-04-30T12:00:00.000Z";

/** Stable fixture set reused by every E2E journey until T-032 expands it. */
export const CALENDAR_EVENTS_FIXTURE: CalendarEvent[] = [
  {
    id: "fixture-event-timed",
    title: "Sample timed event",
    start: "2030-05-14T16:00:00+02:00",
    end: "2030-05-14T18:00:00+02:00",
    allDay: false,
    timezone: "Europe/Warsaw",
    location: "Sample venue, Warszawa",
    description: "Deterministic E2E fixture. Not real content.",
    registrationUrl: "https://example.org/events/sample-timed"
  },
  {
    id: "fixture-event-all-day",
    title: "Sample all-day event",
    start: "2030-06-01",
    end: "2030-06-02",
    allDay: true,
    timezone: "Europe/Warsaw",
    location: null,
    description: null,
    registrationUrl: null
  }
];
