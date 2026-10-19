import type { Locale } from "./locales";

/** Values accepted by the formatting helpers: an instant or an epoch millis. */
export type DateInput = Date | number;

/**
 * Intl *display* tag per app locale (T-024 review finding D1).
 *
 * English renders in the European convention — "14 May 2030, 16:00", not the
 * US "May 14, 2030, 4:00 PM" — because the readership of a Polish NGO's
 * English pages expects day-first dates and 24-hour time. The mapping is
 * confined to this single formatting choke point: the app's locale identifier
 * ("en" in URLs, storage, catalogues and `document.lang`) never changes.
 */
const INTL_DISPLAY_TAGS: Record<Locale, string> = {
  en: "en-GB",
  pl: "pl",
  uk: "uk"
};

const DEFAULT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  dateStyle: "medium"
};

/**
 * Locale-aware date formatting bound to the active locale
 * (docs/PRODUCT_REQUIREMENTS.md §2 item 7). Intl is constructed per call so the
 * locale is always the explicitly supplied one, never the runtime default.
 */
export function formatDate(
  value: DateInput,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = DEFAULT_DATE_OPTIONS
): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(INTL_DISPLAY_TAGS[locale], options).format(
    date
  );
}

/**
 * Locale-aware number formatting bound to the active locale, e.g. the Polish
 * decimal comma (`3,5`).
 */
export function formatNumber(
  value: number,
  locale: Locale,
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat(INTL_DISPLAY_TAGS[locale], options).format(
    value
  );
}
