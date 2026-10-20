/**
 * Site search domain types (T-039, D-26).
 *
 * These names and fields are the frozen contract between the search data
 * modules and the header-search UI lane (docs/tickets/T-039-consolidated-
 * pages-search.md §"Search contract"). The UI imports them instead of
 * redeclaring shapes, so a route or kind change fails type-checking in one
 * place rather than drifting between the dialog and the data layer.
 */

/** A page or an in-page section in the instant client-side index. */
export type NavigationSearchKind = "page" | "section";

/** Result of the client-side navigation index (no network, shown first). */
export interface NavigationSearchResult {
  /** Stable registry id, e.g. `projects-featured`. */
  readonly id: string;
  readonly kind: NavigationSearchKind;
  /** Localized label for the active locale. */
  readonly title: string;
  readonly description: string | null;
  /** Locale-prefixed route plus anchor, e.g. `/en/projects#featured`. */
  readonly route: string;
  readonly keywords: readonly string[];
}

/**
 * Database-backed content kinds. `event` is deliberately part of the union but
 * not of the Postgres RPC: events come from the existing calendar feed and are
 * merged client-side (D-26 — there is no event table).
 */
export type ContentSearchKind =
  | "page"
  | "project"
  | "publication"
  | "document"
  | "team"
  | "event";

/** The kinds the RPC can return (everything except calendar events). */
export type ContentSourceKind = Exclude<ContentSearchKind, "event">;

/**
 * Filter chips from the frozen contract. `pages` maps to the `page` kind;
 * plurals are UI vocabulary, singulars are database vocabulary.
 */
export type SiteSearchFilter =
  | "all"
  | "pages"
  | "projects"
  | "publications"
  | "documents"
  | "team"
  | "events";

/** One content hit, ready for a result row (route already locale-prefixed). */
export interface ContentSearchResult {
  readonly id: string;
  readonly kind: ContentSearchKind;
  readonly title: string;
  /** Whitespace-collapsed preview; never longer than 180 characters. */
  readonly excerpt: string | null;
  /** Detail/reader URL or section anchor, e.g. `/en/about#team`. */
  readonly route: string;
  readonly rank: number;
}

/**
 * Composable state machine. `ready` with an empty `contentResults` is the
 * empty state (the contract has no separate `empty` member).
 */
export type SiteSearchStatus = "idle" | "loading" | "ready" | "error";
