import type { SupabaseClient } from "@supabase/supabase-js";

import type { Locale } from "@/features/i18n/locales";
import { selectTranslation } from "@/shared/content/selectTranslation";
import {
  fromRows,
  unavailable,
  type ContentResult
} from "@/shared/content/result";
import type { Database } from "@/types/database.types";

/**
 * Editable organization pages data access (T-015; consumed by T-016).
 *
 * Only this module builds `site_pages` queries (docs/architecture.md §3). The
 * client is injected so tests use a typed fake with no network.
 */

type SitePageStatus = Database["public"]["Enums"]["content_status"];

type SitePageRow = Database["public"]["Tables"]["site_pages"]["Row"];
type SitePageTranslationRow =
  Database["public"]["Tables"]["site_page_translations"]["Row"];

export interface SitePageRowWithTranslations extends SitePageRow {
  readonly site_page_translations: readonly SitePageTranslationRow[];
}

/** A locale-resolved editable page (About, mission/history/values). */
export interface SitePageContent {
  readonly id: string;
  readonly status: SitePageStatus;
  readonly pageKey: string;
  readonly title: string;
  readonly body: string | null;
  readonly metaDescription: string | null;
  readonly isFallback: boolean;
  readonly needsReview: boolean;
  readonly updatedAt: string;
}

/** A page is complete once it has a title and a body (docs/architecture.md §4). */
export const SITE_PAGE_REQUIRED_FIELDS = [
  "title",
  "body"
] as const satisfies readonly (keyof SitePageTranslationRow)[];

const SITE_PAGE_SELECT =
  "id, page_key, status, updated_at, site_page_translations(locale, title, body, meta_description, needs_review)";

/** Maps one joined row to a domain model, or `null` without usable text. */
export function mapSitePage(
  row: SitePageRowWithTranslations,
  locale: Locale
): SitePageContent | null {
  const selected = selectTranslation(
    { status: row.status, translations: row.site_page_translations },
    locale,
    { requiredFields: SITE_PAGE_REQUIRED_FIELDS }
  );

  if (!selected) return null;

  const translation = selected.value;

  return {
    id: row.id,
    status: row.status,
    pageKey: row.page_key,
    title: translation.title,
    body: translation.body,
    metaDescription: translation.meta_description,
    isFallback: selected.isFallback,
    needsReview: translation.needs_review,
    updatedAt: row.updated_at
  };
}

/**
 * The single published page with the given stable key, in the requested locale.
 * The result holds at most one item: `empty` means the page is absent or
 * unpublished, and an unusable translation is treated the same way.
 */
export async function fetchPublishedPage(
  supabase: SupabaseClient<Database> | null,
  pageKey: string,
  locale: Locale
): Promise<ContentResult<SitePageContent>> {
  if (!supabase) return unavailable();

  const query = supabase.from("site_pages");
  const { data, error } = await query
    .select(SITE_PAGE_SELECT)
    .eq("page_key", pageKey)
    .eq("status", "published")
    .limit(1)
    .overrideTypes<SitePageRowWithTranslations[], { merge: false }>();

  if (error) return unavailable();

  return fromRows(data ?? [], row => mapSitePage(row, locale));
}
