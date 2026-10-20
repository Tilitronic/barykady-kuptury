/**
 * Instant navigation search index (T-039, D-26).
 *
 * The header search shows navigation results before any network call, because
 * page/section intent ("documents", "featured", "calendar") should never wait
 * for Postgres. The registry is deliberately static: the public route map is
 * code (src/router/routes.ts + the consolidated section anchors), not content.
 *
 * The registry is STRUCTURAL after the T-039 review: id, kind, path, keywords
 * (+ the data-driven year literal). Every display string resolves through the
 * injected `translate` against the `search.navEntries.*` catalogue keys —
 * interface chrome belongs to the i18n layer (AGENTS.md rule 9). Keywords stay
 * here as multilingual DATA: they are matching aliases in all three site
 * languages, never rendered.
 *
 * Degradation contract: with no `translate` injected (pure data-layer tests,
 * SSR before i18n boot) the row still routes correctly and its title falls
 * back to the structural id — the layer never ships its own prose.
 *
 * Section-link staleness (m5): entries like `projects-featured` point at
 * anchors that exist only when the destination page has the data (ranked
 * projects, authored About sections). A stale hash degrades to the page top —
 * the page itself always resolves; validating every cross-page anchor would
 * require the destination to be loaded, which a header search cannot know.
 *
 * Year sections are data-dependent (publications derive them from
 * `publication_date`), so they are appended only when the caller supplies the
 * year list — never invented here.
 */
import { DEFAULT_LOCALE, type Locale } from "@/features/i18n/locales";

import { searchTextMatches, tokenizeSearchText } from "./normalize";
import type { NavigationSearchKind, NavigationSearchResult } from "./types";

/** The contract caps the navigation section at five rows. */
export const MAX_NAVIGATION_RESULTS = 5;

/**
 * Resolves a catalogue key (dot path) for the ACTIVE locale, with optional
 * `{named}` interpolation. Missing keys return the key itself — the parity
 * test in `navigationIndex.test.ts` makes that state impossible to ship.
 */
export type NavigationTranslate = (
  key: string,
  named?: Record<string, string | number>
) => string;

interface NavigationEntry {
  readonly id: string;
  readonly kind: NavigationSearchKind;
  /** Path suffix without the locale prefix; `""` is the home route. */
  readonly path: string;
  /** Localized aliases, including the other site languages (match-only). */
  readonly keywords: readonly string[];
  /**
   * Data-driven title (publication years are digits, not chrome — the only
   * display text the registry may carry).
   */
  readonly year?: number;
}

export interface NavigationIndexOptions {
  /**
   * Publication years rendered as `#<year>` sections on the publications
   * page. The UI owns the publication query, so it passes the list here.
   */
  readonly publicationYears?: readonly number[];
  /** Catalogue resolver for display text; see `NavigationTranslate`. */
  readonly translate?: NavigationTranslate | undefined;
}

const PAGES: readonly NavigationEntry[] = [
  {
    id: "home",
    kind: "page",
    path: "",
    keywords: ["home", "homepage", "start", "strona", "główna", "головна"]
  },
  {
    id: "about",
    kind: "page",
    path: "about",
    keywords: ["about", "organization", "o nas", "organizacja", "про нас"]
  },
  {
    id: "projects",
    kind: "page",
    path: "projects",
    keywords: ["projects", "projekty", "проєкти", "project", "projekt"]
  },
  {
    id: "publications",
    kind: "page",
    path: "publications",
    keywords: [
      "publications",
      "publication",
      "publikacje",
      "публікації",
      "год",
      "rok"
    ]
  },
  {
    id: "events",
    kind: "page",
    path: "events",
    keywords: ["events", "event", "wydarzenia", "події", "calendar"]
  },
  {
    id: "support",
    kind: "page",
    path: "support",
    keywords: ["support", "donate", "wesprzyj", "wsparcie", "підтримка"]
  },
  {
    id: "contact",
    kind: "page",
    path: "contact",
    keywords: ["contact", "kontakt", "контакт", "email", "phone", "adres"]
  }
];

const ABOUT_SECTIONS: readonly NavigationEntry[] = [
  {
    id: "about-mission",
    kind: "section",
    path: "about#mission",
    keywords: ["mission", "misja", "місія", "story", "about"]
  },
  {
    id: "about-history",
    kind: "section",
    path: "about#history",
    keywords: ["history", "historia", "історія", "founded", "about"]
  },
  {
    id: "about-values",
    kind: "section",
    path: "about#values",
    keywords: ["values", "wartości", "цінності", "about"]
  },
  {
    id: "about-aims",
    kind: "section",
    path: "about#aims",
    keywords: ["aims", "goals", "cele", "цілі", "about"]
  },
  {
    id: "about-team",
    kind: "section",
    path: "about#team",
    keywords: ["team", "zespół", "команда", "people", "osoby", "about"]
  },
  {
    id: "about-documents",
    kind: "section",
    path: "about#documents",
    keywords: [
      "documents",
      "dokumenty",
      "документи",
      "regulations",
      "statute",
      "about"
    ]
  }
];

const AREA_SECTIONS: readonly NavigationEntry[] = [
  {
    id: "projects-featured",
    kind: "section",
    path: "projects#featured",
    keywords: ["featured", "wyróżnione", "вибрані", "projects", "projekty"]
  },
  {
    id: "projects-all",
    kind: "section",
    path: "projects#all",
    keywords: ["all", "wszystkie", "усі", "projects", "projekty"]
  },
  {
    id: "events-upcoming",
    kind: "section",
    path: "events#upcoming",
    keywords: ["upcoming", "next", "nadchodzące", "майбутні", "events"]
  },
  {
    id: "events-past",
    kind: "section",
    path: "events#past",
    keywords: ["past", "archive", "minione", "минулі", "events"]
  },
  {
    id: "events-calendar",
    kind: "section",
    path: "events#calendar",
    keywords: ["calendar", "kalendarz", "календар", "subscribe", "ics"]
  }
];

const HOME_SECTIONS: readonly NavigationEntry[] = [
  {
    id: "home-mission",
    kind: "section",
    path: "#mission",
    keywords: ["mission", "misja", "місія", "home"]
  },
  {
    id: "home-upcoming",
    kind: "section",
    path: "#upcoming",
    keywords: ["upcoming", "events", "nadchodzące", "майбутні", "home"]
  },
  {
    id: "home-featured",
    kind: "section",
    path: "#featured",
    keywords: ["featured", "projects", "wyróżnione", "вибрані", "home"]
  },
  {
    id: "home-explore",
    kind: "section",
    path: "#explore",
    keywords: ["explore", "odkrywaj", "досліджуйте", "links", "home"]
  }
];

const BASE_ENTRIES: readonly NavigationEntry[] = [
  ...PAGES,
  ...ABOUT_SECTIONS,
  ...AREA_SECTIONS,
  ...HOME_SECTIONS
];

/** Locale-prefixed route for an entry path suffix (`""` → home). */
export function navigationRoute(locale: Locale, path: string): string {
  if (path.length === 0) return `/${locale}`;
  // Homepage sections are pure fragments: `/en#mission`, never `/en/#mission`.
  if (path.startsWith("#")) return `/${locale}${path}`;
  return `/${locale}/${path}`;
}

/**
 * Publication year anchors (`/en/publications#2026`). Years come from the
 * publications data, so the caller supplies them; they are never guessed.
 */
export function publicationYearEntries(
  years: readonly number[]
): NavigationEntry[] {
  return [...new Set(years)]
    .filter(year => Number.isInteger(year) && year > 0)
    .sort((a, b) => b - a)
    .map(year => ({
      id: `publications-year-${year}`,
      kind: "section" as const,
      path: `publications#${year}`,
      keywords: [String(year), "publications", "publikacje", "публікації"],
      year
    }));
}

/** Registry in display order, optionally including publication years. */
export function buildNavigationIndex(
  options: NavigationIndexOptions = {}
): readonly NavigationEntry[] {
  return [
    ...BASE_ENTRIES,
    ...publicationYearEntries(options.publicationYears ?? [])
  ];
}

/** Catalogue title for an entry (year entries display their digit). */
function titleOf(
  entry: NavigationEntry,
  locale: Locale,
  options: NavigationIndexOptions
): string {
  if (entry.year !== undefined) return String(entry.year);
  return options.translate?.(`search.navEntries.${entry.id}.title`) ?? entry.id;
}

/** Catalogue description, or `null` when unresolvable (no translate). */
function descriptionOf(
  entry: NavigationEntry,
  options: NavigationIndexOptions
): string | null {
  if (!options.translate) return null;
  const key =
    entry.year !== undefined
      ? "search.navEntries.year.description"
      : `search.navEntries.${entry.id}.description`;
  const value = options.translate(key, { year: String(entry.year ?? "") });
  // An untranslated miss returns the key itself — treat it as absent.
  return value === key ? null : value;
}

function toResult(
  entry: NavigationEntry,
  locale: Locale,
  options: NavigationIndexOptions
): NavigationSearchResult {
  return {
    id: entry.id,
    kind: entry.kind,
    title: titleOf(entry, locale, options),
    description: descriptionOf(entry, options),
    route: navigationRoute(locale, entry.path),
    keywords: entry.keywords
  };
}

/**
 * Instant navigation matches for `query`, capped at five.
 *
 * Scoring: a title match outranks description/keyword matches; ties keep
 * registry order (pages before sections) so the result set is stable between
 * keystrokes. A blank query has no results — the dialog's idle state.
 */
export function searchNavigation(
  query: string,
  locale: Locale = DEFAULT_LOCALE,
  options: NavigationIndexOptions = {}
): NavigationSearchResult[] {
  const tokens = tokenizeSearchText(query);
  if (tokens.length === 0) return [];

  const scored: { entry: NavigationEntry; score: number; order: number }[] = [];

  for (const [order, entry] of buildNavigationIndex(options).entries()) {
    const title = titleOf(entry, locale, options);
    const description = descriptionOf(entry, options) ?? "";
    const keywordText = entry.keywords.join(" ");

    let score = 0;
    if (searchTextMatches(title, tokens)) score = 2;
    else if (searchTextMatches(`${description} ${keywordText}`, tokens)) {
      score = 1;
    }

    if (score > 0) scored.push({ entry, score, order });
  }

  scored.sort((a, b) => b.score - a.score || a.order - b.order);

  return scored
    .slice(0, MAX_NAVIGATION_RESULTS)
    .map(({ entry }) => toResult(entry, locale, options));
}
