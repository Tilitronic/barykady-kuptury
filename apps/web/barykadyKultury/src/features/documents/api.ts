import type { SupabaseClient } from "@supabase/supabase-js";

import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type Locale
} from "@/features/i18n/locales";
import { selectTranslation } from "@/shared/content/selectTranslation";
import {
  fromRows,
  unavailable,
  type ContentResult
} from "@/shared/content/result";
import type { Database } from "@/types/database.types";

/**
 * Organization documents data access (T-015; text reading added by T-017).
 *
 * Only this module builds `organization_documents` queries
 * (docs/architecture.md §3). A document has two modes (D-12): file-based
 * (`storage_path`/`language` set) or in-app readable text (`body` on each
 * translation). `document_type` is a free-form label; the page resolves it to
 * localized copy (docs/PRODUCT_REQUIREMENTS.md §4).
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

/** A locale-tagged translation projection shared by the listing and reader. */
export interface OrganizationDocumentTranslation {
  readonly locale: Locale;
  readonly slug: string;
  readonly title: string;
  readonly description: string | null;
  readonly body: string | null;
}

/** Locale-resolved document metadata for the listing. */
export interface OrganizationDocument {
  readonly id: string;
  readonly status: DocumentStatus;
  readonly slug: string;
  readonly title: string;
  readonly description: string | null;
  readonly documentType: string;
  /** Language of the uploaded file; `null` for an in-app text document. */
  readonly language: ContentLocale | null;
  readonly publicationDate: string | null;
  /** Storage path of the uploaded file; `null` for an in-app text document. */
  readonly storagePath: string | null;
  readonly mimeType: string | null;
  readonly sizeBytes: number | null;
  readonly sortOrder: number;
  /** Localized body of the resolved translation (text documents only). */
  readonly body: string | null;
  /** Locales whose translation carries readable text (drives the switcher). */
  readonly availableLocales: readonly Locale[];
  readonly isFallback: boolean;
  readonly updatedAt: string;
}

/**
 * Reader model: one logical document with every translation it has. The reader
 * needs all translations at once so the in-view language switcher can render a
 * different locale without a navigation (the URL slug stays stable).
 */
export interface OrganizationDocumentReader {
  readonly id: string;
  readonly documentType: string;
  readonly language: ContentLocale | null;
  readonly publicationDate: string | null;
  readonly storagePath: string | null;
  readonly availableLocales: readonly Locale[];
  readonly translations: readonly OrganizationDocumentTranslation[];
}

/** A translation is only listable/linkable when it has a title. */
export const DOCUMENT_REQUIRED_FIELDS = [
  "title"
] as const satisfies readonly (keyof OrganizationDocumentTranslation)[];

/** A readable translation needs both a title (heading) and a body. */
export const READER_REQUIRED_FIELDS = [
  "title",
  "body"
] as const satisfies readonly (keyof OrganizationDocumentTranslation)[];

const DOCUMENT_SELECT =
  "id, status, document_type, language, publication_date, storage_path, mime_type, file_size_bytes, sort_order, updated_at, organization_document_translations(locale, slug, title, description, body)";

/** Navigation order for locales, so the switcher order never depends on rows. */
const LOCALE_ORDER: readonly Locale[] = SUPPORTED_LOCALES;

/** Whether a translation carries readable text rather than only metadata. */
export function hasDocumentBody(
  translation: OrganizationDocumentTranslation
): boolean {
  return (
    typeof translation.body === "string" && translation.body.trim().length > 0
  );
}

/**
 * Locales that carry readable text, in navigation order. Sorting here (rather
 * than relying on row order) keeps the switcher order stable regardless of how
 * PostgREST returns the embedded rows.
 */
function availableBodyLocales(
  translations: readonly OrganizationDocumentTranslation[]
): readonly Locale[] {
  return translations
    .filter(hasDocumentBody)
    .map(translation => translation.locale)
    .sort((a, b) => LOCALE_ORDER.indexOf(a) - LOCALE_ORDER.indexOf(b));
}

function toTranslation(
  row: OrganizationDocumentTranslationRow
): OrganizationDocumentTranslation {
  return {
    locale: row.locale,
    slug: row.slug,
    title: row.title,
    description: row.description,
    body: row.body
  };
}

/** Maps one joined row to a listing model, or `null` without usable text. */
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

  const translations =
    row.organization_document_translations.map(toTranslation);

  return {
    id: row.id,
    status: row.status,
    slug: selected.value.slug,
    title: selected.value.title,
    description: selected.value.description,
    documentType: row.document_type,
    language: row.language,
    publicationDate: row.publication_date,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    sizeBytes: row.file_size_bytes,
    sortOrder: row.sort_order,
    body: selected.value.body,
    availableLocales: availableBodyLocales(translations),
    isFallback: selected.isFallback,
    updatedAt: row.updated_at
  };
}

/** Maps one joined row to the reader model (no locale resolution yet). */
export function mapDocumentReader(
  row: OrganizationDocumentRowWithTranslations
): OrganizationDocumentReader {
  const translations =
    row.organization_document_translations.map(toTranslation);

  return {
    id: row.id,
    documentType: row.document_type,
    language: row.language,
    publicationDate: row.publication_date,
    storagePath: row.storage_path,
    availableLocales: availableBodyLocales(translations),
    translations
  };
}

/**
 * Finds the document whose translations match `slug`.
 *
 * Slugs are unique per locale, so a match is (locale, slug). The requested
 * locale is preferred; when it has no such slug the English slug is tried
 * (docs/PRODUCT_REQUIREMENTS.md §2.6 — English is the documented fallback).
 * Never a pl↔uk substitution.
 */
export function findDocumentBySlug(
  rows: readonly OrganizationDocumentRowWithTranslations[],
  slug: string,
  locale: Locale
): OrganizationDocumentRowWithTranslations | null {
  const matches = (candidate: Locale): boolean =>
    rows.some(row =>
      row.organization_document_translations.some(
        translation =>
          translation.locale === candidate && translation.slug === slug
      )
    );

  if (matches(locale)) {
    return (
      rows.find(row =>
        row.organization_document_translations.some(
          translation =>
            translation.locale === locale && translation.slug === slug
        )
      ) ?? null
    );
  }

  if (locale !== DEFAULT_LOCALE && matches(DEFAULT_LOCALE)) {
    return (
      rows.find(row =>
        row.organization_document_translations.some(
          translation =>
            translation.locale === DEFAULT_LOCALE && translation.slug === slug
        )
      ) ?? null
    );
  }

  return null;
}

/** The document reader's resolved translation plus its fallback flag. */
export interface SelectedDocumentTranslation {
  readonly translation: OrganizationDocumentTranslation;
  readonly isFallback: boolean;
}

/**
 * Resolves the translation a reader should render.
 *
 * Initial load (`allowFallback: true`, the default) follows the shared rule:
 * requested locale → English, flagged as a fallback. An explicit language switch
 * passes `allowFallback: false`: the chosen locale is rendered or nothing is —
 * never a silent substitution (docs/PRODUCT_REQUIREMENTS.md §2.6).
 */
export function selectReaderTranslation(
  reader: OrganizationDocumentReader,
  locale: Locale,
  options: { readonly allowFallback?: boolean } = {}
): SelectedDocumentTranslation | null {
  const selected = selectTranslation(
    { translations: reader.translations },
    locale,
    {
      requiredFields: READER_REQUIRED_FIELDS,
      allowFallback: options.allowFallback ?? true
    }
  );

  return selected
    ? { translation: selected.value, isFallback: selected.isFallback }
    : null;
}

/** Published documents with every translation, or an explicit state. */
async function fetchPublishedDocumentRows(
  supabase: SupabaseClient<Database>
): Promise<ContentResult<OrganizationDocumentRowWithTranslations>> {
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

  return fromRows(data ?? [], row => row);
}

/** Published documents for a locale (by `sort_order`), or an explicit state. */
export async function fetchPublishedDocuments(
  supabase: SupabaseClient<Database> | null,
  locale: Locale
): Promise<ContentResult<OrganizationDocument>> {
  if (!supabase) return unavailable();

  const rows = await fetchPublishedDocumentRows(supabase);
  if (rows.kind !== "ok") return rows;

  return fromRows(rows.items, row => mapDocument(row, locale));
}

/**
 * The published document reachable at `slug` for a reader, in a single result.
 *
 * Slug resolution happens in process against the published rows because
 * embedded-resource filtering cannot both select the parent by a translation
 * column and return all of its translations in one PostgREST request. The
 * published document set is small by construction, so this stays a single query
 * (docs/architecture.md §3: one module owns the query shape).
 */
export async function fetchPublishedDocumentBySlug(
  supabase: SupabaseClient<Database> | null,
  slug: string,
  locale: Locale
): Promise<ContentResult<OrganizationDocumentReader>> {
  if (!supabase) return unavailable();

  const rows = await fetchPublishedDocumentRows(supabase);
  if (rows.kind !== "ok") return rows;

  const row = findDocumentBySlug(rows.items, slug, locale);
  if (!row) return { kind: "empty" };

  return { kind: "ok", items: [mapDocumentReader(row)] };
}
