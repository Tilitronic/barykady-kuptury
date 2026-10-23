import { DEFAULT_LOCALE, type Locale } from "@/features/i18n/locales";

import type { EventProjectLink } from "./api";

/**
 * T-038/D-24: a project has one canonical slug, so the entity segment never
 * changes by locale. The prefix follows the language whose text is actually
 * rendered: a same-locale event project stays on the current prefix, while an
 * English fallback title links under /en. This prevents a fallback card from
 * pointing at a strict detail route that 404s for the requested locale.
 */
export function eventProjectPath(
  link: EventProjectLink | null,
  currentLocale: Locale
): string | null {
  if (!link) return null;

  return projectPath(link.slug, link.isFallback, currentLocale);
}

/**
 * The detail path for one project translation. Extracted for T-031 so the
 * admin public-link policy uses the exact same fallback-prefix rule instead of
 * re-deriving it (the two views must never disagree).
 */
export function projectPath(
  slug: string,
  isFallback: boolean,
  currentLocale: Locale
): string {
  const owningLocale = isFallback ? DEFAULT_LOCALE : currentLocale;

  return `/${owningLocale}/projects/${slug}`;
}
