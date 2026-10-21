import type { SupabaseClient } from "@supabase/supabase-js";

import { SUPPORTED_LOCALES, type Locale } from "@/features/i18n/locales";
import { unavailable, type ContentResult } from "@/shared/content/result";
import type { Database, Json } from "@/types/database.types";

import type {
  ReaderAsset,
  ReaderDocumentModel,
  ReaderDocumentV1,
  ReaderEntityKind,
  ReaderTranslation
} from "./types";

/**
 * Reader data access (T-040).
 *
 * One published row (canonical slug, D-24) plus every translation and every
 * owner asset. Locale selection is deliberately NOT done here: D-38's
 * requested → UI → EN → first fallback belongs to the composable so a language
 * switch never refetches the document.
 *
 * T-044 privacy: provider paths and external IDs are admin/server metadata
 * (T-041/T-042 signed downloads). They must never be selected by a public
 * reader query, so they are absent from the row types, SELECT lists and the
 * returned model.
 *
 * RLS is the access boundary; the explicit `.eq("status", "published")` is a
 * second guard and makes the resolver's "row-level strictness" visible in the
 * query itself. Draft/archived slugs are `empty`, never a cross-locale match.
 */

type DocumentRow = {
  id: string;
  slug: string;
  document_type: string;
  language: Database["public"]["Enums"]["content_locale"] | null;
  publication_date: string | null;
  updated_at: string;
  allow_original_download: boolean;
  organization_document_translations: DocumentTranslationRow[];
};

type DocumentTranslationRow = {
  locale: Locale;
  title: string;
  description: string | null;
  body: string | null;
  body_ast: Json | null;
  body_ast_version: number | null;
};

type PublicationRow = {
  id: string;
  slug: string;
  language: Database["public"]["Enums"]["content_locale"] | null;
  publication_date: string | null;
  external_url: string | null;
  updated_at: string;
  allow_original_download: boolean;
  publication_translations: PublicationTranslationRow[];
};

type PublicationTranslationRow = {
  locale: Locale;
  title: string;
  abstract: string | null;
  body: string | null;
  body_ast: Json | null;
  body_ast_version: number | null;
};

type AssetRow = {
  id: string;
  locale: Locale;
  storage_path: string;
  mime_type: string;
  width: number;
  height: number;
  sha256: string;
  size_bytes: number | null;
};

const DOCUMENT_SELECT = [
  "id",
  "slug",
  "document_type",
  "language",
  "publication_date",
  "updated_at",
  "allow_original_download",
  "organization_document_translations(locale, title, description, body, body_ast, body_ast_version)"
].join(", ");

const PUBLICATION_SELECT = [
  "id",
  "slug",
  "language",
  "publication_date",
  "external_url",
  "updated_at",
  "allow_original_download",
  "publication_translations(locale, title, abstract, body, body_ast, body_ast_version)"
].join(", ");

const ASSET_SELECT =
  "id, locale, storage_path, mime_type, width, height, sha256, size_bytes";

/**
 * Client-side precheck for a supported AST (D-37: UX only; the DB trigger is
 * the authority). An unsupported/malformed value is treated as absent so the
 * translation is excluded from `availableLocales` rather than rendered
 * partially.
 */
export function parseReaderAst(
  value: unknown,
  version: number | null
): ReaderDocumentV1 | null {
  if (version !== 1) return null;
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (candidate.kind !== "document" || !Array.isArray(candidate.blocks)) {
    return null;
  }

  return value as ReaderDocumentV1;
}

function readableTranslation(
  row: {
    locale: Locale;
    title: string;
    body: string | null;
    body_ast: Json | null;
    body_ast_version: number | null;
  },
  description: string | null
): ReaderTranslation {
  const bodyAst = parseReaderAst(row.body_ast, row.body_ast_version);
  const body = row.body;

  return {
    locale: row.locale,
    title: row.title,
    description,
    bodyAst,
    body,
    hasReadableContent:
      bodyAst !== null || (typeof body === "string" && body.trim().length > 0)
  };
}

/** Supported-locale order, independent of row order. */
function availableLocales(
  translations: readonly ReaderTranslation[]
): readonly Locale[] {
  const readable = new Set(
    translations
      .filter(translation => translation.hasReadableContent)
      .map(translation => translation.locale)
  );

  return SUPPORTED_LOCALES.filter(locale => readable.has(locale));
}

function mapAsset(row: AssetRow): ReaderAsset {
  return {
    id: row.id,
    locale: row.locale,
    storagePath: row.storage_path,
    // The DB check constraint guarantees one of the three raster types.
    mimeType: row.mime_type as ReaderAsset["mimeType"],
    width: row.width,
    height: row.height,
    sha256: row.sha256,
    sizeBytes: row.size_bytes
  };
}

function mapDocument(
  row: DocumentRow,
  assets: readonly AssetRow[]
): ReaderDocumentModel {
  const translations = row.organization_document_translations.map(translation =>
    readableTranslation(translation, translation.description)
  );

  return {
    id: row.id,
    kind: "document",
    slug: row.slug,
    translations,
    availableLocales: availableLocales(translations),
    assets: assets.map(mapAsset),
    documentType: row.document_type,
    language: row.language,
    publicationDate: row.publication_date,
    externalUrl: null,
    updatedAt: row.updated_at,
    allowOriginalDownload: row.allow_original_download === true
  };
}

function mapPublication(
  row: PublicationRow,
  assets: readonly AssetRow[]
): ReaderDocumentModel {
  const translations = row.publication_translations.map(translation =>
    readableTranslation(translation, translation.abstract)
  );

  return {
    id: row.id,
    kind: "publication",
    slug: row.slug,
    translations,
    availableLocales: availableLocales(translations),
    assets: assets.map(mapAsset),
    documentType: null,
    language: row.language,
    publicationDate: row.publication_date,
    externalUrl: row.external_url,
    updatedAt: row.updated_at,
    allowOriginalDownload: row.allow_original_download === true
  };
}

async function fetchDocument(
  supabase: SupabaseClient<Database>,
  slug: string
): Promise<ContentResult<ReaderDocumentModel>> {
  const { data, error } = await supabase
    .from("organization_documents")
    .select(DOCUMENT_SELECT)
    .eq("slug", slug)
    .eq("status", "published")
    .limit(1)
    .overrideTypes<DocumentRow[], { merge: false }>();

  if (error) return unavailable();

  const row = data?.[0];
  if (!row) return { kind: "empty" };

  const { data: assets, error: assetError } = await supabase
    .from("content_assets")
    .select(ASSET_SELECT)
    .eq("organization_document_id", row.id)
    .order("locale", { ascending: true })
    .overrideTypes<AssetRow[], { merge: false }>();

  if (assetError) return unavailable();

  return { kind: "ok", items: [mapDocument(row, assets ?? [])] };
}

async function fetchPublication(
  supabase: SupabaseClient<Database>,
  slug: string
): Promise<ContentResult<ReaderDocumentModel>> {
  const { data, error } = await supabase
    .from("publications")
    .select(PUBLICATION_SELECT)
    .eq("slug", slug)
    .eq("status", "published")
    .limit(1)
    .overrideTypes<PublicationRow[], { merge: false }>();

  if (error) return unavailable();

  const row = data?.[0];
  if (!row) return { kind: "empty" };

  const { data: assets, error: assetError } = await supabase
    .from("content_assets")
    .select(ASSET_SELECT)
    .eq("publication_id", row.id)
    .order("locale", { ascending: true })
    .overrideTypes<AssetRow[], { merge: false }>();

  if (assetError) return unavailable();

  return { kind: "ok", items: [mapPublication(row, assets ?? [])] };
}

/**
 * Fetches a published document or publication by its canonical slug.
 *
 * Null client → `unavailable` (the app is not configured); no row → `empty`.
 * Any query failure collapses to `unavailable`, never a thrown error into the
 * page shell (the reader's state machine handles both explicitly).
 */
export async function fetchReaderDocument(
  supabase: SupabaseClient<Database> | null,
  kind: ReaderEntityKind,
  slug: string
): Promise<ContentResult<ReaderDocumentModel>> {
  if (!supabase) return unavailable();

  const canonicalSlug = slug.trim();
  if (canonicalSlug.length === 0) return { kind: "empty" };

  try {
    return kind === "document"
      ? await fetchDocument(supabase, canonicalSlug)
      : await fetchPublication(supabase, canonicalSlug);
  } catch {
    return unavailable();
  }
}
