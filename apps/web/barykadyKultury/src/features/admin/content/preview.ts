import { SITE_PAGE_REQUIRED_FIELDS } from "@/features/content/api";
import { SUPPORTED_LOCALES, type Locale } from "@/features/i18n/locales";
import { selectTranslation } from "@/shared/content/selectTranslation";

import type { AdminSitePage } from "./api";

/**
 * T-028 — resolve an admin page to the same localized view the public About
 * page renders.
 *
 * Design authority:
 *   - docs/PRODUCT_REQUIREMENTS.md §6: administrators preview content before
 *     publishing.
 *   - docs/architecture.md §4: a translation is usable only when complete
 *     (title + body); the requested locale falls back to English, never to
 *     another locale.
 *   - T-018/T-027 precedent: the preview must use the SAME selector as the
 *     public read path, or it can show content the public page would 404.
 *
 * The public selector rejects every non-published root. A preview's whole
 * purpose is to show drafts, so the status gate is deliberately bypassed here
 * (the route is admin-guarded); completeness and fallback are unchanged.
 */
export interface SitePagePreviewView {
  readonly title: string;
  readonly body: string;
  readonly isFallback: boolean;
}

export function resolveSitePagePreview(
  page: AdminSitePage,
  locale: Locale
): SitePagePreviewView | null {
  const selected = selectTranslation(
    {
      status: null,
      translations: SUPPORTED_LOCALES.map(candidate => ({
        locale: candidate,
        ...page.translations[candidate]
      }))
    },
    locale,
    { requiredFields: SITE_PAGE_REQUIRED_FIELDS }
  );

  if (!selected) return null;

  return {
    title: selected.value.title,
    body: selected.value.body ?? "",
    isFallback: selected.isFallback
  };
}
