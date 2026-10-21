import type { SupabaseClient } from "@supabase/supabase-js";

import { SUPPORTED_LOCALES, type Locale } from "@/features/i18n/locales";
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

/** List rows select only card metadata; the reader body stays on detail. */
type OrganizationDocumentListTranslationRow = Pick<
  OrganizationDocumentTranslationRow,
  "locale" | "title" | "description"
>;

export interface OrganizationDocumentListRow extends Omit<
  OrganizationDocumentRowWithTranslations,
  "organization_document_translations"
> {
  readonly organization_document_translations: readonly OrganizationDocumentListTranslationRow[];
}

/** A locale-tagged translation projection shared by the listing and reader. */
export interface OrganizationDocumentTranslation {
  readonly locale: Locale;
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

const DOCUMENT_LIST_SELECT =
  "id, slug, status, document_type, language, publication_date, storage_path, mime_type, file_size_bytes, sort_order, updated_at, organization_document_translations(locale, title, description)";

const DOCUMENT_DETAIL_SELECT =
  "id, slug, status, document_type, language, publication_date, storage_path, mime_type, file_size_bytes, sort_order, updated_at, organization_document_translations(locale, title, description, body)";

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
    title: row.title,
    description: row.description,
    body: row.body
  };
}

/**
 * Maps a lean list row to the card model. The list query omits `body`, so the
 * model exposes `body: null`; for a text document (`storage_path` null) all
 * translation locales remain "readable" for the card's reader affordance —
 * the reader itself resolves the actual readable translation and fallback.
 */
export function mapDocument(
  row: OrganizationDocumentListRow,
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

  const availableLocales =
    row.storage_path === null
      ? row.organization_document_translations
          .map(translation => translation.locale)
          .sort((a, b) => LOCALE_ORDER.indexOf(a) - LOCALE_ORDER.indexOf(b))
      : [];

  return {
    id: row.id,
    status: row.status,
    slug: row.slug,
    title: selected.value.title,
    description: selected.value.description,
    documentType: row.document_type,
    language: row.language,
    publicationDate: row.publication_date,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    sizeBytes: row.file_size_bytes,
    sortOrder: row.sort_order,
    body: null,
    availableLocales,
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
 * Finds the published document reachable at the canonical root `slug`.
 *
 * T-038/D-24 keeps the root slug as the only identity: resolution matches a
 * published row by slug alone. Documents intentionally retain D-12 behavior —
 * the reader then resolves requested locale → English and flags the fallback,
 * so a missing requested translation still renders readable text rather than a
 * 404. Unknown, draft and archived rows stay unresolved.
 */
export function findDocumentBySlug(
  rows: readonly OrganizationDocumentRowWithTranslations[],
  slug: string
): OrganizationDocumentRowWithTranslations | null {
  return (
    rows.find(row => row.status === "published" && row.slug === slug) ?? null
  );
}

/** The document reader's resolved translation plus its fallback flag. */
export interface SelectedDocumentTranslation {
  readonly translation: OrganizationDocumentTranslation;
  readonly isFallback: boolean;
}

/**
 * Resolves the translation a reader should render.
 *
 * The default (`allowFallback: true`) follows the documented D-12 rule:
 * requested locale → English, flagged as a fallback. Callers that must render
 * an exact locale can pass `allowFallback: false`; the reader itself navigates
 * on an in-view switch, so each render is a fresh requested→English resolution
 * and never silently substitutes a different non-default locale.
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

/**
 * Published documents with every translation. `slug` narrows to the canonical
 * root identity for the reader; the listing omits it.
 */
async function fetchPublishedDocumentRows(
  supabase: SupabaseClient<Database>,
  select: string,
  slug?: string
): Promise<ContentResult<OrganizationDocumentRowWithTranslations>> {
  let query = supabase
    .from("organization_documents")
    .select(select)
    .eq("status", "published");

  if (slug !== undefined) query = query.eq("slug", slug);

  const { data, error } = await query
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

  const rows = await fetchPublishedDocumentRows(supabase, DOCUMENT_LIST_SELECT);
  if (rows.kind !== "ok") return rows;

  return fromRows(rows.items, row => mapDocument(row, locale));
}

/**
 * The published document reachable at the canonical `slug`, in one query.
 *
 * The slug lives on the parent row (T-038/D-24) and every translation is
 * embedded, so locale resolution belongs to the reader
 * (`selectReaderTranslation`) rather than to this fetch.
 */
export async function fetchPublishedDocumentBySlug(
  supabase: SupabaseClient<Database> | null,
  slug: string
): Promise<ContentResult<OrganizationDocumentReader>> {
  if (!supabase) return unavailable();

  const rows = await fetchPublishedDocumentRows(
    supabase,
    DOCUMENT_DETAIL_SELECT,
    slug
  );
  if (rows.kind !== "ok") return rows;

  const row = findDocumentBySlug(rows.items, slug);
  if (!row) return { kind: "empty" };

  return { kind: "ok", items: [mapDocumentReader(row)] };
}
