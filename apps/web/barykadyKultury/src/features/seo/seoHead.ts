import {
  DEFAULT_LOCALE,
  isLocale,
  SUPPORTED_LOCALES,
  type Locale
} from "@/features/i18n/locales";
import type { MessageKey } from "@/features/i18n/messageKey";
import type { LocalePageMeta } from "@/features/i18n/pageMeta";

/**
 * T-034 — canonical, alternate-language and Open Graph metadata.
 *
 * WHY a pure builder plus a thin DOM writer:
 * - The link graph is a product/SEO contract (docs/architecture.md §8), so it
 *   is decided by an injectable function and pinned by unit tests instead of
 *   being assembled inline inside the navigation guard.
 * - The guard only supplies route facts (locale, path, noindex) and a
 *   translator; it does not know how a canonical URL is shaped.
 *
 * Canonical shape (D-24): one slug is shared by every locale, so an alternate
 * is a pure prefix swap of the first path segment. No per-locale slug map is
 * needed and the graph cannot drift from the URL contract.
 *
 * Query strings are deliberately excluded: the reader's content language is a
 * `?lang=` parameter (D-27), not a distinct document. `to.path` is passed in,
 * so the canonical never forks per content language.
 *
 * Admin and 404 surfaces are noindex; for those the canonical graph is omitted
 * entirely (a noindex page must not advertise alternate URLs).
 */

/** One `hreflang` alternate: the same route expressed in another locale. */
export interface HreflangAlternate {
  readonly locale: Locale;
  readonly href: string;
}

export interface OpenGraphMetadata {
  readonly title: string;
  readonly description: string;
  /** Absent when the route is noindex or has no locale prefix. */
  readonly url: string | null;
  readonly type: "website";
  readonly siteName: string;
  readonly locale: Locale;
}

export interface SeoHead {
  readonly title: string;
  readonly description: string;
  readonly canonical: string | null;
  readonly alternates: readonly HreflangAlternate[];
  /** Language-neutral fallback alternate (`hreflang="x-default"`). */
  readonly xDefault: string | null;
  readonly noindex: boolean;
  readonly og: OpenGraphMetadata;
}

export interface SeoHeadInput {
  /** Route metadata keys (single source of truth: `meta.pageMeta`). */
  readonly pageMeta: LocalePageMeta;
  /** Locale resolved from the URL prefix (falls back to the saved/browser one). */
  readonly locale: Locale;
  /** Route path WITHOUT query/hash, e.g. `/pl/projects`. */
  readonly path: string;
  /** Route declares itself non-indexable (`meta.noindex`, admin/404). */
  readonly noindex: boolean;
  /**
   * Absolute site origin for absolute URLs. `null` disables the canonical
   * graph (e.g. a non-browser test with no configured origin). Production
   * wiring prefers `VITE_SITE_URL` and falls back to `location.origin`.
   */
  readonly siteUrl: string | null;
  readonly translate: (key: MessageKey) => string;
}

/** Removes trailing slashes; keeps the empty root form intact. */
function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}

/** Locale segment of a path (`/pl/projects` → `pl`), or `null`. */
function localeSegmentOf(path: string): Locale | null {
  const first = path.split("/").filter(Boolean)[0];
  return first !== undefined && isLocale(first) ? first : null;
}

/**
 * Re-expresses a locale-prefixed path in another locale. Returns `null` for
 * paths that are not locale-scoped (global 404, unknown prefix) — those have no
 * alternate graph because their canonical is itself undefined.
 */
function localisedPath(path: string, locale: Locale): string | null {
  const segments = path.split("/").filter(Boolean);
  const [first] = segments;
  if (first === undefined || !isLocale(first)) return null;

  segments[0] = locale;
  return `/${segments.join("/")}`;
}

function originOf(siteUrl: string | null): string | null {
  const trimmed = siteUrl?.trim() ?? "";
  if (trimmed === "") return null;

  // Accept values configured with or without a trailing slash; both are common
  // in Netlify env UIs and neither should leak into the output.
  return trimTrailingSlashes(trimmed);
}

export function buildSeoHead(input: SeoHeadInput): SeoHead {
  const title = input.translate(input.pageMeta.titleKey);
  const description = input.translate(input.pageMeta.descriptionKey);
  const origin = originOf(input.siteUrl);
  const path = trimTrailingSlashes(input.path);

  // A noindex route and a route without a locale prefix share one rule: no
  // canonical and no alternates, because there is no shareable localized
  // document to point search engines (or previews) at.
  const indexable = !input.noindex && localeSegmentOf(path) !== null;
  const canonical =
    indexable && origin !== null
      ? `${origin}${path === "" ? "/" : path}`
      : null;

  const alternates: HreflangAlternate[] = [];
  if (indexable && origin !== null) {
    for (const locale of SUPPORTED_LOCALES) {
      const href = localisedPath(path, locale);
      if (href !== null) {
        alternates.push({ locale, href: `${origin}${href}` });
      }
    }
  }

  const xDefault =
    alternates.find(alternate => alternate.locale === DEFAULT_LOCALE)?.href ??
    null;

  return {
    title,
    description,
    canonical,
    alternates,
    xDefault,
    noindex: input.noindex,
    og: {
      title,
      description,
      url: canonical,
      type: "website",
      // The verified organization name from the catalogue — never a tagline
      // invented for previews (AGENTS.md rule 6).
      siteName: input.translate("app.name"),
      // Bare language subtag: the site asserts a language, not a territory
      // (the flag glyphs in the picker are decorative, see LOCALE_FLAGS).
      locale: input.locale
    }
  };
}

/** Marker so re-navigation can replace only head nodes this module owns. */
const SEO_ATTRIBUTE = "data-bk-seo";

function createLink(
  doc: Document,
  rel: string,
  href: string,
  extra: Record<string, string> = {}
): HTMLLinkElement {
  const link = doc.createElement("link");
  link.setAttribute("rel", rel);
  link.setAttribute("href", href);
  for (const [name, value] of Object.entries(extra)) {
    link.setAttribute(name, value);
  }
  link.setAttribute(SEO_ATTRIBUTE, "");
  return link;
}

function createMeta(
  doc: Document,
  attribute: "name" | "property",
  key: string,
  content: string
): HTMLMetaElement {
  const meta = doc.createElement("meta");
  meta.setAttribute(attribute, key);
  meta.setAttribute("content", content);
  meta.setAttribute(SEO_ATTRIBUTE, "");
  return meta;
}

/**
 * Writes the SEO link/meta graph for the active route.
 *
 * Idempotent across client-side navigation: every node carries
 * `data-bk-seo`, so the previous route's canonical/alternates/OG tags are
 * removed before the current ones are appended. Title and description are NOT
 * written here — `applyPageMeta` owns them; duplicating the write would give
 * two sources of truth for the same tag.
 */
export function applySeoHead(doc: Document | null, head: SeoHead): void {
  if (!doc) return;

  doc.querySelectorAll(`[${SEO_ATTRIBUTE}]`).forEach(node => node.remove());

  const fragment = doc.createDocumentFragment();

  if (head.canonical !== null) {
    fragment.appendChild(createLink(doc, "canonical", head.canonical));
  }

  for (const alternate of head.alternates) {
    fragment.appendChild(
      createLink(doc, "alternate", alternate.href, {
        hreflang: alternate.locale
      })
    );
  }

  if (head.xDefault !== null) {
    fragment.appendChild(
      createLink(doc, "alternate", head.xDefault, { hreflang: "x-default" })
    );
  }

  fragment.appendChild(createMeta(doc, "property", "og:title", head.og.title));
  fragment.appendChild(
    createMeta(doc, "property", "og:description", head.og.description)
  );
  fragment.appendChild(createMeta(doc, "property", "og:type", head.og.type));
  fragment.appendChild(
    createMeta(doc, "property", "og:site_name", head.og.siteName)
  );
  fragment.appendChild(
    createMeta(doc, "property", "og:locale", head.og.locale)
  );
  if (head.og.url !== null) {
    fragment.appendChild(createMeta(doc, "property", "og:url", head.og.url));
  }

  if (head.noindex) {
    fragment.appendChild(
      createMeta(doc, "name", "robots", "noindex, nofollow")
    );
  }

  doc.head.appendChild(fragment);
}
