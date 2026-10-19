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
 * Endonyms (each language's own name). Used by the documents-reader language
 * tabs and as the screen-reader part of the header picker's labels. Autonyms
 * are intentionally not translated: a language is always listed in its own
 * language so a user who does not read the current locale can still find
 * theirs.
 */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  pl: "Polski",
  uk: "Українська"
};

/**
 * Short codes rendered next to the flags in the header language picker.
 *
 * These are *display* strings only. The app's locale identifier for Ukrainian
 * stays `uk` everywhere it is machine-read (URL segment, storage, catalogues,
 * `document.lang`) because `uk` is its BCP 47 code; the visible abbreviation
 * follows the country-code convention the user recognises on a flag (🇺🇦 → UA).
 * Renaming the `Locale` union to "match" the badge would break routing — do
 * not do it.
 */
export const LOCALE_DISPLAY_CODE: Record<Locale, string> = {
  en: "EN",
  pl: "PL",
  uk: "UA"
};

/**
 * Decorative flag glyphs for the language picker (paired with
 * {@link LOCALE_DISPLAY_CODE}). Rendered `aria-hidden` — the accessible name
 * comes from the autonym + display code, not from the emoji, because regional
 * indicator sequences are read inconsistently across screen readers.
 */
export const LOCALE_FLAGS: Record<Locale, string> = {
  en: "\u{1F1EC}\u{1F1E7}", // 🇬🇧
  pl: "\u{1F1F5}\u{1F1F1}", // 🇵🇱
  uk: "\u{1F1FA}\u{1F1E6}" // 🇺🇦
};

/** Narrows an untrusted value (URL param, storage, browser hint) to a locale. */
export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" &&
    (SUPPORTED_LOCALES as readonly string[]).includes(value)
  );
}
