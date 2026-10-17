import { DEFAULT_LOCALE, isLocale, type Locale } from "./locales";

/**
 * Inputs for locale resolution. The function is deliberately free of browser
 * globals so the precedence rules from docs/PRODUCT_REQUIREMENTS.md §2 can be
 * proven in isolation.
 */
export interface ResolveLocaleInput {
  /** Locale taken from the URL. Authoritative — always wins when supported. */
  url?: string | null;
  /** Previously saved explicit user choice (`bk.locale`). */
  saved?: string | null;
  /** `navigator.languages`, ordered by user preference. */
  languages?: readonly string[];
}

/**
 * Resolves the locale using the documented precedence:
 *
 * 1. an explicit URL locale (authoritative);
 * 2. a previously saved user choice;
 * 3. the first browser language matching `pl*`, `uk*` or `en*`;
 * 4. English.
 *
 * An *unsupported* URL value is ignored here rather than silently accepted —
 * the router's route table rejects unknown locale segments before this function
 * is consulted, so an invalid URL can never become this fallback path.
 */
export function resolveLocale(input: ResolveLocaleInput = {}): Locale {
  const { url = null, saved = null, languages = [] } = input;

  if (isLocale(url)) {
    return url;
  }
  if (isLocale(saved)) {
    return saved;
  }

  for (const language of languages) {
    const normalized = language.toLowerCase();
    if (normalized.startsWith("pl")) return "pl";
    if (normalized.startsWith("uk")) return "uk";
    if (normalized.startsWith("en")) return "en";
  }

  return DEFAULT_LOCALE;
}
