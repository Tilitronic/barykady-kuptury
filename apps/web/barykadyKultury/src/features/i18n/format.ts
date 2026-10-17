import type { Locale } from "./locales";

/** Values accepted by the formatting helpers: an instant or an epoch millis. */
export type DateInput = Date | number;

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
  return new Intl.DateTimeFormat(locale, options).format(date);
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
  return new Intl.NumberFormat(locale, options).format(value);
}
