/**
 * Locale domain for the public site.
 *
 * Supported locales and precedence are fixed by docs/PRODUCT_REQUIREMENTS.md §2
 * and docs/architecture.md §8. This module is the single source of truth for
 * the locale union, the route-param pattern and the document direction, so the
 * router, the guard and the switcher cannot drift apart.
 */

/** Supported locales, in navigation order. `en` is the default/fallback. */
export const SUPPORTED_LOCALES = ["en", "pl", "uk"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

/** Fallback when neither the URL, a saved choice nor the browser selects one. */
export const DEFAULT_LOCALE: Locale = "en";

/**
 * Regex source embedded in the locale route segment (`:locale(en|pl|uk)`).
 * Keeping it derived from {@link SUPPORTED_LOCALES} means the URL contract can
 * never accept a locale the catalogues do not ship.
 */
export const LOCALE_ROUTE_PATTERN = SUPPORTED_LOCALES.join("|");

/**
 * Writing direction per locale. All three current locales are left-to-right,
 * but the map exists so the document `dir` attribute is set from data rather
 * than a hard-coded assumption (docs/DESIGN_SYSTEM.md §6).
 */
export const LOCALE_DIRECTIONS: Record<Locale, "ltr" | "rtl"> = {
  en: "ltr",
  pl: "ltr",
  uk: "ltr"
};

/**
 * Endonyms shown in the language selector. Autonyms are intentionally not
 * translated: a language is always listed in its own language so a user who
 * does not read the current locale can still find theirs.
 */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  pl: "Polski",
  uk: "Українська"
};

/** Narrows an untrusted value (URL param, storage, browser hint) to a locale. */
export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" &&
    (SUPPORTED_LOCALES as readonly string[]).includes(value)
  );
}
