import { DEFAULT_LOCALE, type Locale } from "@/features/i18n/locales";

import type { EventProjectLink } from "./api";

/**
 * The single implementation of the T-019 strict-slug rule for event→project
 * links (T-024 Events page, T-025 homepage): a link whose text stands in
 * from English carries the English slug, so the URL always contains its own
 * locale's slug and can never dead-end on a missing translation.
 */
export function eventProjectPath(
  link: EventProjectLink | null,
  currentLocale: Locale
): string | null {
  if (!link) return null;

  const owningLocale = link.isFallback ? DEFAULT_LOCALE : currentLocale;
  return `/${owningLocale}/projects/${link.slug}`;
}
