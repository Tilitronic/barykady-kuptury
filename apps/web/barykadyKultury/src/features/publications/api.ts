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
  "id, slug, status, language, publication_date, external_url, sort_order, updated_at, publication_translations(locale, title, abstract, authors), publication_files(locale, label, storage_path, mime_type, file_size_bytes)";

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
    slug: row.slug,
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

  const rows = await fetchPublishedPublicationRows(supabase);
  if (rows.kind !== "ok") return rows;

  return fromRows(rows.items, row => mapPublication(row, locale));
}

/**
 * Finds the published publication reachable at the canonical root `slug`.
 *
 * T-038/D-24 replaces the T-019 per-locale slug rule: the published row must
 * carry the root slug AND have a translation for the requested locale. A draft
 * row is never resolvable even if a misconfigured payload leaks it
 * (docs/PRODUCT_REQUIREMENTS.md §8; RLS remains the real boundary, proven in
 * `rls_content_matrix_test.sql`).
 */
export function findPublicationBySlug(
  rows: readonly PublicationRowWithTranslations[],
  slug: string,
  locale: Locale
): PublicationRowWithTranslations | null {
  return (
    rows.find(
      row =>
        row.status === "published" &&
        row.slug === slug &&
        row.publication_translations.some(
          translation => translation.locale === locale
        )
    ) ?? null
  );
}

/**
 * The published publication reachable at the canonical `slug` for the locale.
 *
 * The slug is on the parent row, so the query filters by it directly and still
 * returns every translation. Empty means "no such public page" — the page
 * renders 404 content, never a cross-locale fallback.
 */
export async function fetchPublishedPublicationBySlug(
  supabase: SupabaseClient<Database> | null,
  slug: string,
  locale: Locale
): Promise<ContentResult<PublicationSummary>> {
  if (!supabase) return unavailable();

  const rows = await fetchPublishedPublicationRows(supabase, slug);
  if (rows.kind !== "ok") return rows;

  const row = findPublicationBySlug(rows.items, slug, locale);
  if (!row) return { kind: "empty" };

  const publication = mapPublication(row, locale);
  return publication ? { kind: "ok", items: [publication] } : { kind: "empty" };
}

/**
 * Shared published-rows query for the listing and the by-slug detail read.
 * `slug` narrows to the canonical root identity; the listing omits it.
 */
async function fetchPublishedPublicationRows(
  supabase: SupabaseClient<Database>,
  slug?: string
): Promise<ContentResult<PublicationRowWithTranslations>> {
  let query = supabase
    .from("publications")
    .select(PUBLICATION_SELECT)
    .eq("status", "published");

  if (slug !== undefined) query = query.eq("slug", slug);

  const { data, error } = await query
    .order("publication_date", { ascending: false, nullsFirst: false })
    .overrideTypes<PublicationRowWithTranslations[], { merge: false }>();

  if (error) return unavailable();

  return fromRows(data ?? [], row => row);
}
