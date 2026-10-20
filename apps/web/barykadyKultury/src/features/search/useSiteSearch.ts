import type { SupabaseClient } from "@supabase/supabase-js";
import { computed, onScopeDispose, ref, watch } from "vue";
import type { ComputedRef, Ref } from "vue";

import type { Locale } from "@/features/i18n/locales";
import type { ContentResult } from "@/shared/content/result";
import type { Database } from "@/types/database.types";

import { searchContent } from "./api";
import { searchEvents } from "./eventsSearch";
import { searchNavigation, type NavigationTranslate } from "./navigationIndex";
import type {
  ContentSearchResult,
  ContentSourceKind,
  NavigationSearchResult,
  SiteSearchFilter,
  SiteSearchStatus
} from "./types";

// Convenience for the UI lane: the frozen snippet imports the filter type from
// the composable module. `types.ts` remains the canonical definition.
export type { SiteSearchFilter } from "./types";

/**
 * Header-search composable (T-039, D-26).
 *
 * The contract with the UI lane (frozen in the ticket):
 *   - navigation results are computed synchronously from the static index;
 *   - content results are debounced (~200 ms) and run against the RPC plus,
 *     for `all`/`events`, the cached calendar feed;
 *   - a stale response can never overwrite a newer query (generation token +
 *     `AbortController` on the PostgREST request);
 *   - a content failure sets `error` but leaves `navigationResults` usable.
 *
 * `error` is a stable machine code, not English prose: the UI lane owns the
 * localized message (AGENTS.md rule 9 — no hard-coded user-facing strings in
 * the data layer). Known codes are exported below.
 *
 * `reset()` is an additive extra beyond the frozen shape: the contract says a
 * user filter override lasts "until the dialog closes/route changes", and the
 * listed fields have no close hook. The UI may call it on close; route changes
 * reset the filter automatically even if it does not.
 */

/** Debounce for the server/calendar section; navigation stays instant. */
export const SEARCH_DEBOUNCE_MS = 200;

/** Stable error codes for the UI to localize. */
export const SEARCH_CONTENT_ERROR = "content-unavailable";
export const SEARCH_EVENTS_ERROR = "events-unavailable";

/** Maps a chip to the RPC kind list (`null` = every database source). */
export function filterToSourceKinds(
  filter: SiteSearchFilter
): readonly ContentSourceKind[] | null {
  switch (filter) {
    case "all":
      return null;
    case "pages":
      return ["page"];
    case "projects":
      return ["project"];
    case "publications":
      return ["publication"];
    case "documents":
      return ["document"];
    case "team":
      return ["team"];
    case "events":
      // Events come from the calendar, never from the RPC.
      return [];
  }
}

/** Route → default chip (T-039: area pages preselect their own kind). */
export function filterForRoute(
  routeName: string | null | undefined
): SiteSearchFilter {
  switch (routeName) {
    case "projects":
    case "project-detail":
      return "projects";
    case "publications":
    case "publication-detail":
      return "publications";
    case "events":
      return "events";
    default:
      return "all";
  }
}

export interface UseSiteSearchOptions {
  readonly locale: Ref<Locale>;
  readonly routeName: Ref<string | null | undefined>;
  readonly supabase: SupabaseClient<Database> | null;
  /**
   * Additive option: publication years render as `#<year>` navigation
   * sections. The UI owns the publications data, so it passes the list; when
   * omitted the registry simply has no year entries (never invented years).
   */
  readonly publicationYears?: Ref<readonly number[]>;
  /**
   * Additive option (T-039 review): catalogue resolver for navigation
   * display text. The registry is structural; titles/descriptions come from
   * the i18n layer through this function.
   */
  readonly translate?: NavigationTranslate;
}

function sortContentResults(
  results: readonly ContentSearchResult[],
  locale: Locale
): ContentSearchResult[] {
  return [...results].sort(
    (a, b) =>
      b.rank - a.rank ||
      a.title.localeCompare(b.title, locale, { sensitivity: "base" })
  );
}

export function useSiteSearch(options: UseSiteSearchOptions): {
  query: Ref<string>;
  filter: Ref<SiteSearchFilter>;
  setFilter: (f: SiteSearchFilter) => void;
  navigationResults: ComputedRef<NavigationSearchResult[]>;
  contentResults: Ref<ContentSearchResult[]>;
  status: Ref<SiteSearchStatus>;
  error: Ref<string | null>;
  retry: () => void;
  /** Additive: clears the query and restores the route-derived chip. */
  reset: () => void;
} {
  const query = ref("");
  const filter = ref<SiteSearchFilter>(filterForRoute(options.routeName.value));
  const status = ref<SiteSearchStatus>("idle");
  const error = ref<string | null>(null);
  const contentResults = ref<ContentSearchResult[]>([]);

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: AbortController | null = null;
  let generation = 0;

  /** Instant, no network, always available — even while content fails. */
  const navigationResults = computed<NavigationSearchResult[]>(() =>
    searchNavigation(query.value, options.locale.value, {
      publicationYears: options.publicationYears?.value ?? [],
      translate: options.translate
    })
  );

  function cancelPending(): void {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    inFlight?.abort();
    inFlight = null;
  }

  function resetContent(): void {
    contentResults.value = [];
    error.value = null;
    status.value = "idle";
  }

  async function run(
    runGeneration: number,
    forceEvents = false
  ): Promise<void> {
    const trimmed = query.value.trim();
    if (trimmed.length < 2 || runGeneration !== generation) return;

    const activeFilter = filter.value;
    const locale = options.locale.value;
    const kinds = filterToSourceKinds(activeFilter);
    const needsEvents = activeFilter === "all" || activeFilter === "events";

    inFlight?.abort();
    const controller = new AbortController();
    inFlight = controller;

    const databaseRequest: Promise<ContentResult<ContentSearchResult>> =
      // `null` means every database source; `[]` (Events chip) means none.
      kinds === null || kinds.length > 0
        ? searchContent(options.supabase, trimmed, locale, kinds, {
            signal: controller.signal
          })
        : Promise.resolve({ kind: "empty" });

    const eventsRequest: Promise<ContentResult<ContentSearchResult> | null> =
      needsEvents
        ? searchEvents(trimmed, locale, forceEvents ? { force: true } : {})
        : Promise.resolve(null);

    let database: ContentResult<ContentSearchResult>;
    let events: ContentResult<ContentSearchResult> | null;

    try {
      [database, events] = await Promise.all([databaseRequest, eventsRequest]);
    } catch {
      // Both helpers convert their own failures, so this is defence in depth:
      // a rejected transport must still become a retry-able error state, never
      // an unhandled rejection out of the composable.
      if (runGeneration !== generation || controller.signal.aborted) return;
      inFlight = null;
      contentResults.value = [];
      error.value = SEARCH_CONTENT_ERROR;
      status.value = "error";
      return;
    }

    // A newer keystroke/filter/locale owns the UI now; drop this response.
    if (runGeneration !== generation || controller.signal.aborted) return;
    inFlight = null;

    const eventItems = events?.kind === "ok" ? events.items : [];

    if (database.kind === "unavailable") {
      // Postgres failed: keep whatever the calendar produced (it is an
      // independent source) but surface retry-able error state.
      contentResults.value = sortContentResults(eventItems, locale);
      error.value = SEARCH_CONTENT_ERROR;
      status.value = "error";
      return;
    }

    if (events?.kind === "unavailable" && activeFilter === "events") {
      // For the Events chip the calendar is the only source, so its failure
      // is a visible content failure. In `all`, Postgres results stand.
      contentResults.value = [];
      error.value = SEARCH_EVENTS_ERROR;
      status.value = "error";
      return;
    }

    const merged = [
      ...(database.kind === "ok" ? database.items : []),
      ...eventItems
    ];

    contentResults.value = sortContentResults(merged, locale);
    error.value = null;
    // `ready` + empty results is the contract's empty state.
    status.value = "ready";
  }

  watch(
    [query, filter, options.locale],
    () => {
      cancelPending();
      generation += 1;
      const currentGeneration = generation;
      const trimmed = query.value.trim();

      if (trimmed.length < 2) {
        resetContent();
        return;
      }

      status.value = "loading";
      error.value = null;
      contentResults.value = [];

      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        void run(currentGeneration);
      }, SEARCH_DEBOUNCE_MS);
    },
    { immediate: true }
  );

  // A route change re-applies the route-derived chip (user override ends).
  watch(options.routeName, routeName => {
    filter.value = filterForRoute(routeName);
  });

  onScopeDispose(cancelPending);

  function setFilter(nextFilter: SiteSearchFilter): void {
    filter.value = nextFilter;
  }

  function retry(): void {
    cancelPending();
    generation += 1;
    const currentGeneration = generation;
    const trimmed = query.value.trim();

    if (trimmed.length < 2) {
      resetContent();
      return;
    }

    status.value = "loading";
    error.value = null;
    void run(currentGeneration, true);
  }

  function reset(): void {
    cancelPending();
    generation += 1;
    query.value = "";
    filter.value = filterForRoute(options.routeName.value);
    resetContent();
  }

  return {
    query,
    filter,
    setFilter,
    navigationResults,
    contentResults,
    status,
    error,
    retry,
    reset
  };
}
