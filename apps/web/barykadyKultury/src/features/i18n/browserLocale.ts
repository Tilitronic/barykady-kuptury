/**
 * Reads the browser's ordered language preferences.
 *
 * Isolated from {@link module:resolveLocale} so resolution stays pure and
 * testable: the guard injects this reader, tests inject a literal list.
 * Returns an empty list in non-browser environments (no SSR surprise).
 */
export function getBrowserLanguages(): readonly string[] {
  if (typeof navigator === "undefined") {
    return [];
  }

  if (navigator.languages && navigator.languages.length > 0) {
    return navigator.languages;
  }

  return navigator.language ? [navigator.language] : [];
}
