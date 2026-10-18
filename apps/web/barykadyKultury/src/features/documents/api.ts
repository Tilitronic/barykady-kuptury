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
 * Organization documents data access (T-015; consumed by T-017).
 *
 * Only this module builds `organization_documents` queries
 * (docs/architecture.md §3). `document_type` is a free-form label; the page
 * resolves it to localized copy (docs/PRODUCT_REQUIREMENTS.md §4).
 */

type DocumentStatus = Database["public"]["Enums"]["content_status"];
type ContentLocale = Database["public"]["Enums"]["content_locale"];

type OrganizationDocumentRow =
  Database["public"]["Tables"]["organization_documents"]["Row"];
type OrganizationDocumentTranslationRow =
  Database["public"]["Tables"]["organization_document_translations"]["Row"];

export interface OrganizationDocumentRowWithTranslations extends OrganizationDocumentRow {
  readonly organization_document_translations: readonly OrganizationDocumentTranslationRow[];
}

/** Locale-resolved document metadata plus its storage location. */
export interface OrganizationDocument {
  readonly id: string;
  readonly status: DocumentStatus;
  readonly slug: string;
  readonly title: string;
  readonly description: string | null;
  readonly documentType: string;
  readonly language: ContentLocale;
  readonly publicationDate: string | null;
  readonly storagePath: string;
  readonly mimeType: string | null;
  readonly sizeBytes: number | null;
  readonly sortOrder: number;
  readonly isFallback: boolean;
  readonly updatedAt: string;
}

/** Description is optional; a title is required to list or link a document. */
export const DOCUMENT_REQUIRED_FIELDS = [
  "title"
] as const satisfies readonly (keyof OrganizationDocumentTranslationRow)[];

const DOCUMENT_SELECT =
  "id, status, document_type, language, publication_date, storage_path, mime_type, file_size_bytes, sort_order, updated_at, organization_document_translations(locale, slug, title, description)";

/** Maps one joined row to a domain model, or `null` without usable text. */
export function mapDocument(
  row: OrganizationDocumentRowWithTranslations,
  locale: Locale
): OrganizationDocument | null {
  const selected = selectTranslation(
    {
      status: row.status,
      translations: row.organization_document_translations
    },
    locale,
    { requiredFields: DOCUMENT_REQUIRED_FIELDS }
  );

  if (!selected) return null;

  const translation = selected.value;

  return {
    id: row.id,
    status: row.status,
    slug: translation.slug,
    title: translation.title,
    description: translation.description,
    documentType: row.document_type,
    language: row.language,
    publicationDate: row.publication_date,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    sizeBytes: row.file_size_bytes,
    sortOrder: row.sort_order,
    isFallback: selected.isFallback,
    updatedAt: row.updated_at
  };
}

/** Published documents for a locale (by `sort_order`), or an explicit state. */
export async function fetchPublishedDocuments(
  supabase: SupabaseClient<Database> | null,
  locale: Locale
): Promise<ContentResult<OrganizationDocument>> {
  if (!supabase) return unavailable();

  const query = supabase.from("organization_documents");
  const { data, error } = await query
    .select(DOCUMENT_SELECT)
    .eq("status", "published")
    .order("sort_order", { ascending: true })
    .overrideTypes<
      OrganizationDocumentRowWithTranslations[],
      { merge: false }
    >();

  if (error) return unavailable();

  return fromRows(data ?? [], row => mapDocument(row, locale));
}
