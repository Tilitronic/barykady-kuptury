import { isLocale, type Locale } from "./locales";

/**
 * Rewrites the leading locale segment of a path while preserving the rest of
 * the route — including path params such as `/pl/projects/42`.
 *
 * Language switching must keep the user on the same page
 * (docs/PRODUCT_REQUIREMENTS.md §2 item 3). Operating on the raw path keeps this
 * independent of the route table, so adding pages needs no switcher change.
 */
export function replaceLocaleInPath(path: string, locale: Locale): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const segments = normalized.split("/");

  // segments[0] is the empty string before the leading slash.
  if (isLocale(segments[1])) {
    segments[1] = locale;
    return segments.join("/");
  }

  return normalized === "/" ? `/${locale}` : `/${locale}${normalized}`;
}
