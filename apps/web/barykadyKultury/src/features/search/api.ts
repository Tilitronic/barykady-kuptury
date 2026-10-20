import type { SupabaseClient } from "@supabase/supabase-js";

import type { Locale } from "@/features/i18n/locales";
import {
  fromModels,
  unavailable,
  type ContentResult
} from "@/shared/content/result";
import type { Database } from "@/types/database.types";

import type { ContentSearchResult, ContentSourceKind } from "./types";

/**
 * Content-search data access (T-039, D-26).
 *
 * The browser never touches the content tables for search: one SECURITY
 * INVOKER RPC (`public.search_published_content`) applies RLS plus an explicit
 * published filter and returns already-ranked rows. This module's only job is
 * to call that RPC and translate rows into locale-prefixed client routes,
 * because the RPC cannot know the route table (docs/tickets/T-039 §"Search
 * contract" — "The client builds routes").
 *
 * Route rules mirror the router and D-24 canonical slugs:
 *   page        → /{locale} (home page_key) or /{locale}/{page_key}
 *   project     → /{locale}/projects/{slug}
 *   publication → /{locale}/publications/{slug}
 *   document    → /{locale}/about/documents/{slug} (T-017 reader survives)
 *   team        → /{locale}/about#team (team has no slug, D-24)
 */

/** The RPC name is referenced once so a rename cannot drift silently. */
export const SEARCH_CONTENT_RPC = "search_published_content" as const;

/** Matches the RPC default; the composable does not need to pass it. */
export const DEFAULT_CONTENT_SEARCH_LIMIT = 20;

/** Database-backed kinds, in the contract's filter order. */
export const CONTENT_SOURCE_KINDS: readonly ContentSourceKind[] = [
  "page",
  "project",
  "publication",
  "document",
  "team"
];

export interface SearchContentOptions {
  /** Aborts the HTTP request when a newer keystroke supersedes this one. */
  readonly signal?: AbortSignal;
  /** 1–50; the RPC clamps out-of-range values as a second line of defence. */
  readonly limit?: number;
}

/**
 * Raw RPC row.
 *
 * WHY a local interface instead of the generated `Returns` type: PostgreSQL's
 * `RETURNS TABLE` cannot mark individual OUT columns nullable, so the generated
 * type declares `excerpt`/`slug`/`page_key` as `string` even though the
 * function emits NULL for kinds that have no slug (and for empty excerpts).
 * Modelling the nullable columns here keeps the mapper honest; the cast is the
 * single seam where the generator's limitation is acknowledged.
 */
interface SearchRpcRow {
  readonly kind: string;
  readonly entity_id: string;
  readonly title: string;
  readonly excerpt: string | null;
  readonly slug: string | null;
  readonly page_key: string | null;
  readonly rank: number;
}

/** Narrows an untrusted RPC `kind` string to a database search kind. */
export function isContentSourceKind(
  value: unknown
): value is ContentSourceKind {
  return (
    typeof value === "string" &&
    (CONTENT_SOURCE_KINDS as readonly string[]).includes(value)
  );
}

/** The detail/reader/section URL for a row, or `null` when it is unusable. */
export function contentSearchRoute(
  row: Pick<SearchRpcRow, "kind" | "slug" | "page_key">,
  locale: Locale
): string | null {
  switch (row.kind) {
    case "page":
      if (!row.page_key) return null;
      return row.page_key === "home"
        ? `/${locale}`
        : `/${locale}/${row.page_key}`;
    case "project":
      return row.slug ? `/${locale}/projects/${row.slug}` : null;
    case "publication":
      return row.slug ? `/${locale}/publications/${row.slug}` : null;
    case "document":
      return row.slug ? `/${locale}/about/documents/${row.slug}` : null;
    case "team":
      // The consolidated About page renders team inline (D-25); team has no
      // per-member URL after D-24.
      return `/${locale}/about#team`;
    default:
      return null;
  }
}

/** Maps one RPC row to a result, dropping unusable kinds/routes. */
export function mapContentSearchRow(
  row: SearchRpcRow,
  locale: Locale
): ContentSearchResult | null {
  if (!isContentSourceKind(row.kind)) return null;

  const route = contentSearchRoute(row, locale);
  if (!route) return null;

  return {
    id: `${row.kind}:${row.entity_id}`,
    kind: row.kind,
    title: row.title,
    excerpt: row.excerpt,
    route,
    rank: row.rank
  };
}

/**
 * Searches published database content.
 *
 * `kinds` semantics follow the RPC: `null`/`undefined` means every source,
 * while an empty array is an explicit "no database sources" (used by the
 * Events chip, whose results come from the calendar instead).
 */
export async function searchContent(
  supabase: SupabaseClient<Database> | null,
  query: string,
  locale: Locale,
  kinds?: readonly ContentSourceKind[] | null,
  options: SearchContentOptions = {}
): Promise<ContentResult<ContentSearchResult>> {
  const trimmed = query.trim();

  // Mirrors the RPC guard so the debounced client never issues a useless call.
  if (trimmed.length < 2) return { kind: "empty" };
  if (Array.isArray(kinds) && kinds.length === 0) return { kind: "empty" };
  if (!supabase) return unavailable();
  if (options.signal?.aborted) return unavailable();

  const selectedKinds =
    kinds === null || kinds === undefined
      ? null
      : [...new Set(kinds)].filter(isContentSourceKind);

  try {
    let request = supabase.rpc(SEARCH_CONTENT_RPC, {
      search_query: trimmed,
      result_locale: locale,
      ...(selectedKinds === null ? {} : { result_kinds: selectedKinds }),
      ...(options.limit === undefined ? {} : { result_limit: options.limit })
    });

    if (options.signal) {
      request = request.abortSignal(options.signal);
    }

    const { data, error } = await request;
    if (error) return unavailable();

    const rows = (data ?? []) as unknown as readonly SearchRpcRow[];
    return fromModels(
      rows
        .map(row => mapContentSearchRow(row, locale))
        .filter((result): result is ContentSearchResult => result !== null)
    );
  } catch {
    // Network failure, aborted request, malformed payload: unavailable, never
    // a thrown error into the composable/UI (T-039 failure-isolation rule).
    return unavailable();
  }
}

/* ── Publication years (T-039 review: real years feed the nav index) ─────── */

/**
 * Module cache: one years query per page session. The calendar/event search
 * uses the same pattern — the result is data the header cannot know, the
 * query is tiny, and every dialog opening reuses the first answer. A failed
 * query caches the empty answer for the session (degraded, never blocking).
 */
let publicationYearsCache: Promise<readonly number[]> | null = null;

/** Test seam: drop the cached promise so each test observes a fresh query. */
export function resetPublicationYearsCache(): void {
  publicationYearsCache = null;
}

/**
 * Distinct publication years of published rows, newest-first. RLS plus the
 * explicit published filter are the boundary (docs/architecture.md §6); the
 * projection is the date column only. Never throws: a failure is `[]`, which
 * simply means the nav index gets no year sections.
 */
export function fetchPublishedPublicationYears(
  supabase: SupabaseClient<Database> | null
): Promise<readonly number[]> {
  if (!supabase) return Promise.resolve([]);

  publicationYearsCache ??= (async (): Promise<readonly number[]> => {
    try {
      const { data } = await supabase
        .from("publications")
        .select("publication_date")
        .eq("status", "published");

      const years = new Set<number>();
      for (const row of (data ?? []) as readonly {
        publication_date: string | null;
      }[]) {
        const year = Number.parseInt(
          row.publication_date?.slice(0, 4) ?? "",
          10
        );
        if (Number.isInteger(year) && year > 0) {
          years.add(year);
        }
      }
      return [...years].sort((a, b) => b - a);
    } catch {
      return [];
    }
  })();

  return publicationYearsCache;
}
