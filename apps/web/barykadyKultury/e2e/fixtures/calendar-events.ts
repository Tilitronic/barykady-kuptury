/**
 * Deterministic, clearly fictional calendar fixtures.
 *
 * These mirror the normalized shape the read-only Calendar adapter function
 * returns (architecture.md §5) and contain no real NGO content, personal data,
 * or credentials. Timestamps are fixed so E2E assertions never depend on the
 * wall clock or a specific machine timezone (docs/TESTING.md §2). T-023 (the
 * adapter) and T-032 (journey matrix) replace this skeleton with the final
 * contract once the function exists.
 */

/** A normalized public calendar event as exposed to the frontend. */
export interface CalendarEvent {
  /** Stable Google Calendar event identifier. */
  id: string;
  title: string;
  /** ISO 8601 start; for all-day events this is a date at midnight. */
  start: string;
  /** ISO 8601 end. */
  end: string;
  allDay: boolean;
  /** Event's own timezone, otherwise the organization default. */
  timezone: string;
  cancelled: boolean;
  location?: string;
  description?: string;
  registrationUrl?: string;
  /** Slug of a linked published project, when one exists. */
  projectSlug?: string;
}

/** Response body of `/.netlify/functions/calendar-events`. */
export interface CalendarEventsResponse {
  events: CalendarEvent[];
}

/** Stable fixture set reused by every E2E journey until T-032 expands it. */
export const CALENDAR_EVENTS_FIXTURE: CalendarEvent[] = [
  {
    id: "fixture-event-timed",
    title: "Sample timed event",
    start: "2030-05-14T16:00:00+02:00",
    end: "2030-05-14T18:00:00+02:00",
    allDay: false,
    timezone: "Europe/Warsaw",
    cancelled: false,
    location: "Sample venue, Warszawa",
    description: "Deterministic E2E fixture. Not real content.",
    projectSlug: "fixture-project"
  },
  {
    id: "fixture-event-all-day",
    title: "Sample all-day event",
    start: "2030-06-01T00:00:00+02:00",
    end: "2030-06-02T00:00:00+02:00",
    allDay: true,
    timezone: "Europe/Warsaw",
    cancelled: false
  }
];
