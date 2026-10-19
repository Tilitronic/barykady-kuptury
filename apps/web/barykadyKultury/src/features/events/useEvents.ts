import { inject, ref, watchEffect, type Ref } from "vue";

import { SUPABASE_CLIENT_KEY } from "@/features/content/supabaseInjection";
import type { Locale } from "@/features/i18n/locales";
import {
  fromModels,
  unavailable,
  type ContentResult
} from "@/shared/content/result";

import { fetchCalendarEvents, type CalendarClientOptions } from "./client";
import { sortEvents } from "./sortEvents";
import { fetchPublishedEventProjectLinks, type EventProjectLink } from "./api";
import type { NormalizedEvent } from "./normalize";

/**
 * Reactive data source for the Events page (T-024).
 *
 * Mirrors `useProjects`/`usePublications` — inject the Supabase client, expose
 * a reactive `ContentResult`, discard stale responses, re-fetch on locale
 * change — and keeps the reviewed boundary rule: components receive plain
 * view models only, so the calendar fetch, the link query and the
 * `(calendarId, googleEventId)` join all live here.
 *
 * Independence is the failure-isolation contract (docs/architecture.md §4):
 * the calendar function and the link query run as separate requests, each
 * with its own outcome. A failed link query degrades to "events without
 * links"; a failed calendar degrades to `unavailable` — never a blank
 * success, because `ok` requires at least one upcoming event.
 */
type MaybeRef<T> = Ref<T> | T;

/** A calendar event plus its joined published-project link (`null` → none). */
export interface EventView extends NormalizedEvent {
  readonly project: EventProjectLink | null;
}

export interface UseEventsOptions extends CalendarClientOptions {
  /** Clock seam for deterministic tests; production uses the real clock. */
  readonly now?: () => Date;
}

/** Composite key for the join; NUL keeps calendar ids collision-free. */
function linkKey(calendarId: string, googleEventId: string): string {
  return `${calendarId}\u0000${googleEventId}`;
}

/**
 * Joins events to links and orders them soonest-first. Pure so the hook and
 * its tests share one implementation of the published-only/partial-data rule.
 */
export function joinEventsAndLinks(
  calendar: {
    readonly calendarId: string;
    readonly events: readonly NormalizedEvent[];
  },
  links: readonly EventProjectLink[],
  now: Date
): EventView[] {
  const byEvent = new Map<string, EventProjectLink>();
  for (const link of links) {
    const key = linkKey(link.calendarId, link.googleEventId);
    if (!byEvent.has(key)) byEvent.set(key, link);
  }

  return sortEvents(calendar.events, now).map(event => ({
    ...event,
    project: byEvent.get(linkKey(calendar.calendarId, event.id)) ?? null
  }));
}

export function useEvents(
  locale: MaybeRef<Locale>,
  options: UseEventsOptions = {}
): {
  readonly result: Ref<ContentResult<EventView>>;
  /** Re-runs both fetches (the calendar-unavailable retry control). */
  readonly retry: () => void;
} {
  const supabase = inject(SUPABASE_CLIENT_KEY, null);
  const result = ref<ContentResult<EventView>>({ kind: "loading" });
  const attempt = ref(0);

  watchEffect(onInvalidate => {
    const activeLocale = typeof locale === "string" ? locale : locale.value;
    // Read `attempt` so retry() re-triggers the effect.
    void attempt.value;

    result.value = { kind: "loading" };

    let stale = false;
    onInvalidate(() => {
      stale = true;
    });

    void (async () => {
      // Independent by design: neither request gates the other; each module
      // already converts its own failure into a safe value.
      const [calendar, links] = await Promise.all([
        fetchCalendarEvents(options),
        fetchPublishedEventProjectLinks(supabase, activeLocale)
      ]);

      if (stale) return;

      if (calendar.kind !== "ok") {
        result.value =
          calendar.kind === "empty"
            ? { kind: "empty" }
            : unavailable<EventView>();
        return;
      }

      const joined = joinEventsAndLinks(
        calendar,
        links.kind === "ok" ? links.items : [],
        (options.now ?? (() => new Date()))()
      );

      result.value = fromModels(joined);
    })();
  });

  function retry(): void {
    attempt.value += 1;
  }

  return { result, retry };
}
