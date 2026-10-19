/**
 * Netlify Function entry: read-only Google Calendar adapter (T-023).
 *
 * This file is a *binding only* (docs/architecture.md §2/§5). All validation,
 * normalization and error shaping live in the app source so they are covered by
 * vitest, `pnpm typecheck`, oxlint and oxfmt:
 *
 *   src/features/events/calendarHandler.ts — HTTP contract
 *   src/features/events/normalize.ts       — event normalization
 *
 * It uses the Netlify Functions v2 Web-standard signature
 * (`export default (Request) => Response`) and Node 22+ globals, so no
 * `@netlify/functions` dependency is required. The public path remains
 * `/.netlify/functions/calendar-events`, which the E2E mocks intercept.
 *
 * Secrets: `GOOGLE_CALENDAR_ID` and `GOOGLE_CALENDAR_API_KEY` are read from
 * `process.env` at request time. They are never returned, logged, or bundled
 * into the browser build (the app source has no reference to these names).
 */

import {
  createCalendarHandler,
  type FetchUpstream,
  type UpstreamCalendarRequest
} from "../../apps/web/barykadyKultury/src/features/events/calendarHandler";
import type { GoogleCalendarEvent } from "../../apps/web/barykadyKultury/src/features/events/normalize";

const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

/**
 * Read-only listing against Google Calendar v3.
 *
 * `singleEvents=true` + `orderBy=startTime` expand recurring events so the
 * website never has to interpret recurrence rules. `showDeleted=false` keeps
 * deleted events out at the source; cancellation is still filtered again during
 * normalization because Google may include cancelled instances.
 *
 * Errors intentionally bubble up without a message rewrite: the handler catches
 * them and returns the stable 502 contract, so nothing from the upstream body
 * (which may mention the key) can reach the client.
 */
const fetchGoogleCalendar: FetchUpstream = async ({
  calendarId,
  apiKey,
  timeMin,
  timeMax,
  maxResults
}: UpstreamCalendarRequest): Promise<readonly GoogleCalendarEvent[]> => {
  const url = new URL(
    `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`
  );
  url.searchParams.set("key", apiKey);
  url.searchParams.set("timeMin", timeMin);
  url.searchParams.set("timeMax", timeMax);
  url.searchParams.set("maxResults", String(maxResults));
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("showDeleted", "false");

  const response = await fetch(url, {
    method: "GET",
    headers: { accept: "application/json" }
  });

  if (!response.ok) {
    // Do not include the status text/body: Google's error body can echo the key.
    throw new Error("Google Calendar request failed");
  }

  const payload: unknown = await response.json();

  if (typeof payload !== "object" || payload === null) {
    throw new Error("Google Calendar returned a non-object payload");
  }

  const { items } = payload as { items?: unknown };

  // Google omits `items` for an empty calendar; that is a valid empty result.
  if (items === undefined) return [];

  // A present-but-non-array `items` is a broken upstream contract. Returning an
  // empty list would disguise it as "no events", so let the handler emit 502.
  if (!Array.isArray(items)) {
    throw new Error("Google Calendar returned malformed items");
  }

  return items as GoogleCalendarEvent[];
};

/**
 * Netlify Functions v2 entry point.
 *
 * `process.env` is read per request rather than at module load: Netlify may
 * evaluate the module once per container and then serve many invocations, and
 * local tooling reloads `.env` without a restart. Reading it here also keeps the
 * "server-side only" boundary obvious — this file is the only place the
 * credential names appear.
 */
export default async function calendarEvents(
  request: Request
): Promise<Response> {
  return createCalendarHandler({
    config: {
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      apiKey: process.env.GOOGLE_CALENDAR_API_KEY
    },
    fetchUpstream: fetchGoogleCalendar,
    now: () => new Date()
  })(request);
}
