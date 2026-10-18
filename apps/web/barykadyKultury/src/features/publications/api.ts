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
 * Publications data access (T-015; consumed by T-020).
 *
 * Only this module builds `publications` queries (docs/architecture.md §3). A
 * publication may carry one file version per language (`publication_files`) or a
 * single external URL; both are surfaced on the domain model so the page never
 * renders a broken action (docs/PRODUCT_REQUIREMENTS.md §4).
 */

type PublicationStatus = Database["public"]["Enums"]["content_status"];
type ContentLocale = Database["public"]["Enums"]["content_locale"];

type PublicationRow = Database["public"]["Tables"]["publications"]["Row"];
type PublicationTranslationRow =
  Database["public"]["Tables"]["publication_translations"]["Row"];
type PublicationFileRow =
  Database["public"]["Tables"]["publication_files"]["Row"];

export interface PublicationRowWithTranslations extends PublicationRow {
  readonly publication_translations: readonly PublicationTranslationRow[];
  readonly publication_files: readonly PublicationFileRow[];
}

/** One downloadable language version of a publication. */
export interface PublicationFile {
  readonly locale: ContentLocale;
  readonly label: string | null;
  readonly storagePath: string;
  readonly mimeType: string | null;
  readonly sizeBytes: number | null;
}

/** Locale-resolved publication metadata plus its downloadable files. */
export interface PublicationSummary {
  readonly id: string;
  readonly status: PublicationStatus;
  readonly slug: string;
  readonly title: string;
  readonly abstract: string | null;
  readonly authors: string | null;
  readonly language: ContentLocale | null;
  readonly publicationDate: string | null;
  readonly externalUrl: string | null;
  readonly sortOrder: number;
  readonly files: readonly PublicationFile[];
  readonly isFallback: boolean;
  readonly updatedAt: string;
}

/** Only the title is required; abstract/authors are optional (architecture §4). */
export const PUBLICATION_REQUIRED_FIELDS = [
  "title"
] as const satisfies readonly (keyof PublicationTranslationRow)[];

const PUBLICATION_SELECT =
  "id, status, language, publication_date, external_url, sort_order, updated_at, publication_translations(locale, slug, title, abstract, authors), publication_files(locale, label, storage_path, mime_type, file_size_bytes)";

function mapFile(row: PublicationFileRow): PublicationFile {
  return {
    locale: row.locale,
    label: row.label,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    sizeBytes: row.file_size_bytes
  };
}

/** Maps one joined row to a domain model, or `null` without usable text. */
export function mapPublication(
  row: PublicationRowWithTranslations,
  locale: Locale
): PublicationSummary | null {
  const selected = selectTranslation(
    { status: row.status, translations: row.publication_translations },
    locale,
    { requiredFields: PUBLICATION_REQUIRED_FIELDS }
  );

  if (!selected) return null;

  const translation = selected.value;

  return {
    id: row.id,
    status: row.status,
    slug: translation.slug,
    title: translation.title,
    abstract: translation.abstract,
    authors: translation.authors,
    language: row.language,
    publicationDate: row.publication_date,
    externalUrl: row.external_url,
    sortOrder: row.sort_order,
    files: (row.publication_files ?? []).map(mapFile),
    isFallback: selected.isFallback,
    updatedAt: row.updated_at
  };
}

/** Published publications for a locale (newest first), or an explicit state. */
export async function fetchPublishedPublications(
  supabase: SupabaseClient<Database> | null,
  locale: Locale
): Promise<ContentResult<PublicationSummary>> {
  if (!supabase) return unavailable();

  const query = supabase.from("publications");
  const { data, error } = await query
    .select(PUBLICATION_SELECT)
    .eq("status", "published")
    .order("publication_date", { ascending: false, nullsFirst: false })
    .overrideTypes<PublicationRowWithTranslations[], { merge: false }>();

  if (error) return unavailable();

  return fromRows(data ?? [], row => mapPublication(row, locale));
}
