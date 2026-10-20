import type { Locale } from "@/features/i18n/locales";
import {
  fetchCalendarEvents,
  type CalendarClientOptions,
  type CalendarEventsResult
} from "@/features/events/client";
import type { NormalizedEvent } from "@/features/events/normalize";
import { fromModels, type ContentResult } from "@/shared/content/result";

import { searchTextMatches, tokenizeSearchText } from "./normalize";
import type { ContentSearchResult } from "./types";

/**
 * Calendar-event search (T-039, D-26).
 *
 * Events are not stored in Postgres, so the Content section merges them from
 * the existing calendar client. Two rules drive this module:
 *
 * 1. **Fetch once per page session.** The calendar is remote and unrelated to
 *    the query, so the normalized result is cached at module level and every
 *    keystroke filters the cached list. `force` is the retry path.
 * 2. **Never throw.** The composable receives a `ContentResult`; a failed
 *    calendar degrades to `unavailable` and the Postgres/navigation sections
 *    keep working (failure isolation is an explicit T-039 acceptance rule).
 *
 * Matching mirrors the navigation index (case/diacritic-insensitive token
 * prefixes) over the event title, description and location. Results link to
 * the stable card anchor `/{locale}/events#event-<googleEventId>`.
 */

/** Calendar rows are capped like the RPC default (the calendar is small). */
export const EVENT_SEARCH_LIMIT = 20;

/** Excerpt cap mirrors the database RPC contract (≤ 180 characters). */
const EXCERPT_MAX_LENGTH = 180;

export interface SearchEventsOptions extends CalendarClientOptions {
  /** Bypasses the module cache — used by the dialog's retry control. */
  readonly force?: boolean;
}

/**
 * Module-level cache: one calendar request shared by every dialog opening in
 * the page session. Cleared by tests and by the explicit retry path.
 */
let cachedCalendar: Promise<CalendarEventsResult> | null = null;

/** Test/retry hook; production retry uses `force` instead. */
export function resetEventsSearchCache(): void {
  cachedCalendar = null;
}

function loadCalendar(
  options: SearchEventsOptions
): Promise<CalendarEventsResult> {
  if (!cachedCalendar || options.force) {
    // `fetchCalendarEvents` already converts every failure into a state; the
    // catch is defence in depth for an unexpected rejection (e.g. a mock).
    cachedCalendar = fetchCalendarEvents(
      // exactOptionalPropertyTypes: omit the key rather than passing undefined.
      options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}
    ).catch((): CalendarEventsResult => ({ kind: "unavailable" }));
  }
  return cachedCalendar;
}

/** Collapses whitespace and truncates to the shared excerpt contract. */
function toExcerpt(text: string | null): string | null {
  if (!text) return null;
  const collapsed = text.replace(/\s+/gu, " ").trim();
  if (collapsed.length === 0) return null;
  return collapsed.slice(0, EXCERPT_MAX_LENGTH);
}

function eventHaystack(event: NormalizedEvent): string {
  return [event.title, event.location ?? "", event.description ?? ""].join(" ");
}

/** Title matches rank above description/location matches. */
function eventRank(event: NormalizedEvent, tokens: readonly string[]): number {
  if (searchTextMatches(event.title, tokens)) return 3;
  return searchTextMatches(eventHaystack(event), tokens) ? 2 : 0;
}

/** Pure filter/map step, exported so tests can prove the merge without I/O. */
export function mapEventsToSearchResults(
  events: readonly NormalizedEvent[],
  query: string,
  locale: Locale
): ContentSearchResult[] {
  const tokens = tokenizeSearchText(query);
  if (tokens.length === 0) return [];

  const results: ContentSearchResult[] = [];

  for (const event of events) {
    const rank = eventRank(event, tokens);
    if (rank === 0) continue;

    results.push({
      id: `event:${event.id}`,
      kind: "event",
      title: event.title,
      excerpt: toExcerpt(event.description),
      // The event card id is `event-<googleEventId>` (T-039 page contract).
      route: `/${locale}/events#event-${event.id}`,
      rank
    });
  }

  return results
    .sort(
      (a, b) =>
        b.rank - a.rank ||
        a.title.localeCompare(b.title, locale, { sensitivity: "base" })
    )
    .slice(0, EVENT_SEARCH_LIMIT);
}

/**
 * Searches the cached calendar for `query`. A blank or one-character query
 * returns `empty` without touching the network, matching the RPC guard.
 */
export async function searchEvents(
  query: string,
  locale: Locale,
  options: SearchEventsOptions = {}
): Promise<ContentResult<ContentSearchResult>> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return { kind: "empty" };

  const calendar = await loadCalendar(options);
  if (calendar.kind === "unavailable") return { kind: "unavailable" };
  if (calendar.kind === "empty") return { kind: "empty" };

  return fromModels(mapEventsToSearchResults(calendar.events, trimmed, locale));
}
