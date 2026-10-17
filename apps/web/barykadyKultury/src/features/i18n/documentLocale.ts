import { LOCALE_DIRECTIONS, type Locale } from "./locales";

/**
 * Mirrors the active locale onto the document metadata required by
 * docs/DESIGN_SYSTEM.md §6 ("Language changes update document language
 * metadata"). Accepts `null` so the guard is safe in environments without a
 * `document` (e.g. a memory-history router during tests).
 */
export function applyDocumentLocale(
  doc: Document | null,
  locale: Locale
): void {
  if (!doc) return;

  const root = doc.documentElement;
  root.setAttribute("lang", locale);
  root.setAttribute("dir", LOCALE_DIRECTIONS[locale]);
}
