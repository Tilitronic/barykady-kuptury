import type { SupabaseClient } from "@supabase/supabase-js";

import { PUBLIC_DOCUMENTS_BUCKET } from "@/features/files/buckets";
import { SUPPORTED_LOCALES, type Locale } from "@/features/i18n/locales";
import type { Database, Json } from "@/types/database.types";

import {
  documentTranslationsForSave,
  emptyDocumentTranslation,
  type DocumentFormValues,
  type DocumentStatus,
  type DocumentTranslationDraft
} from "./documentForm";

/**
 * T-029 — the ONLY write path for organization documents.
 *
 * Design authority:
 *   - docs/architecture.md §3: data access stays behind a feature module.
 *   - docs/architecture.md §4: root metadata + one translation per locale.
 *   - docs/architecture.md §6.1: `documents:write` gates the table RPC and
 *     the `public-documents` storage writes.
 *   - T-045/T-028: the same paired transactional RPC pattern per entity:
 *     `save_document_v1` (root + complete translation set) and
 *     `transition_document_v1` (status + published_at together).
 *
 * The save RPC deliberately upserts only title/description, leaving the T-017
 * `body` column owned by the reader importer untouched.
 */

type DocumentRow =
  Database["public"]["Tables"]["organization_documents"]["Row"];
type DocumentTranslationRow =
  Database["public"]["Tables"]["organization_document_translations"]["Row"];

interface AdminDocumentRow extends DocumentRow {
  readonly organization_document_translations: readonly DocumentTranslationRow[];
}

export interface AdminDocument {
  readonly id: string;
  readonly slug: string;
  readonly status: DocumentStatus;
  readonly documentType: string;
  readonly language: Locale | null;
  readonly publicationDate: string | null;
  readonly storagePath: string | null;
  readonly mimeType: string | null;
  readonly sizeBytes: number | null;
  readonly sortOrder: number;
  readonly publishedAt: string | null;
  readonly updatedAt: string;
  readonly translations: Record<Locale, DocumentTranslationDraft>;
}

export type AdminDocumentFailureCode =
  | "unavailable"
  | "duplicate-slug"
  | "invalid-path"
  | "invalid-upload"
  | "failed";

export interface AdminDocumentFailure {
  readonly ok: false;
  readonly code: AdminDocumentFailureCode;
  readonly message?: string;
}

export type AdminDocumentMutationResult =
  | { readonly ok: true }
  | AdminDocumentFailure;

export type AdminDocumentSaveResult =
  | { readonly ok: true; readonly id: string }
  | AdminDocumentFailure;

export type AdminDocumentResult =
  | { readonly ok: true; readonly document: AdminDocument }
  | {
      readonly ok: false;
      readonly code: "not-found" | AdminDocumentFailureCode;
    };

export type AdminDocumentListResult =
  | { readonly ok: true; readonly documents: readonly AdminDocument[] }
  | AdminDocumentFailure;

const ADMIN_DOCUMENT_SELECT =
  "id, slug, status, document_type, language, publication_date, storage_path, mime_type, file_size_bytes, sort_order, published_at, updated_at, organization_document_translations(locale, title, description)";

const UNIQUE_VIOLATION = "23505";

const SAVE_DOCUMENT_RPC = "save_document_v1" as const;
const TRANSITION_DOCUMENT_RPC = "transition_document_v1" as const;

function failure(
  code: AdminDocumentFailureCode,
  message?: string
): AdminDocumentFailure {
  return message === undefined
    ? { ok: false, code }
    : { ok: false, code, message };
}

function nullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function translationsFromRows(
  rows: readonly DocumentTranslationRow[]
): Record<Locale, DocumentTranslationDraft> {
  const translations = Object.fromEntries(
    SUPPORTED_LOCALES.map(locale => [locale, emptyDocumentTranslation()])
  ) as Record<Locale, DocumentTranslationDraft>;

  for (const row of rows) {
    if ((SUPPORTED_LOCALES as readonly string[]).includes(row.locale)) {
      translations[row.locale] = {
        title: row.title,
        description: row.description ?? ""
      };
    }
  }

  return translations;
}

export function mapAdminDocument(row: AdminDocumentRow): AdminDocument {
  return {
    id: row.id,
    slug: row.slug,
    status: row.status,
    documentType: row.document_type,
    language: row.language,
    publicationDate: row.publication_date,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    sizeBytes: row.file_size_bytes,
    sortOrder: row.sort_order,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    translations: translationsFromRows(row.organization_document_translations)
  };
}

export async function fetchAdminDocuments(
  supabase: SupabaseClient<Database> | null
): Promise<AdminDocumentListResult> {
  if (!supabase) return failure("unavailable");

  const { data, error } = await supabase
    .from("organization_documents")
    .select(ADMIN_DOCUMENT_SELECT)
    .order("sort_order", { ascending: true })
    .overrideTypes<AdminDocumentRow[], { merge: false }>();

  if (error) return failure("failed", error.message);

  return { ok: true, documents: (data ?? []).map(mapAdminDocument) };
}

export async function fetchAdminDocument(
  supabase: SupabaseClient<Database> | null,
  id: string
): Promise<AdminDocumentResult> {
  if (!supabase) return { ok: false, code: "unavailable" };

  const { data, error } = await supabase
    .from("organization_documents")
    .select(ADMIN_DOCUMENT_SELECT)
    .eq("id", id)
    .maybeSingle()
    .overrideTypes<AdminDocumentRow, { merge: false }>();

  if (error) return { ok: false, code: "failed" };
  if (!data) return { ok: false, code: "not-found" };

  return { ok: true, document: mapAdminDocument(data) };
}

type DocumentSlugCheck =
  | { readonly ok: true; readonly available: boolean }
  | AdminDocumentFailure;

/** Internal pre-check that preserves a query failure (see publications). */
async function checkDocumentSlug(
  supabase: SupabaseClient<Database> | null,
  slug: string,
  excludeId?: string | null
): Promise<DocumentSlugCheck> {
  if (!supabase) return failure("unavailable");

  const { data, error } = await supabase
    .from("organization_documents")
    .select("id")
    .eq("slug", slug);

  if (error) return failure("failed", error.message);

  return {
    ok: true,
    available: !(data ?? []).some(row => row.id !== excludeId)
  };
}

export async function isDocumentSlugAvailable(
  supabase: SupabaseClient<Database> | null,
  slug: string,
  excludeId?: string | null
): Promise<boolean> {
  const result = await checkDocumentSlug(supabase, slug, excludeId);
  return result.ok ? result.available : false;
}

export interface SaveDocumentOptions {
  readonly existingPublishedAt?: string | null;
  readonly replaceStoragePaths?: readonly string[];
}

export async function saveDocument(
  supabase: SupabaseClient<Database> | null,
  values: DocumentFormValues,
  options: SaveDocumentOptions = {}
): Promise<AdminDocumentSaveResult> {
  if (!supabase) return failure("unavailable");

  const slug = values.slug.trim();
  if (
    values.storagePath !== null &&
    /^https?:\/\//iu.test(values.storagePath.trim())
  ) {
    return failure("invalid-path");
  }

  const availability = await checkDocumentSlug(supabase, slug, values.id);
  if (!availability.ok) return availability;
  if (!availability.available) return failure("duplicate-slug");

  const publishedAt =
    values.status === "published"
      ? (options.existingPublishedAt ?? new Date().toISOString())
      : null;

  const { data, error } = await supabase.rpc(SAVE_DOCUMENT_RPC, {
    p_id: values.id as unknown as string,
    p_slug: slug,
    p_status: values.status,
    p_document_type: values.documentType.trim(),
    p_language:
      values.language as unknown as Database["public"]["Enums"]["content_locale"],
    p_publication_date: nullable(values.publicationDate) as unknown as string,
    p_storage_path: nullable(values.storagePath ?? "") as unknown as string,
    p_mime_type: nullable(values.mimeType ?? "") as unknown as string,
    p_file_size_bytes: values.sizeBytes as unknown as number,
    p_sort_order: values.sortOrder as unknown as number,
    p_published_at: publishedAt as unknown as string,
    p_translations: documentTranslationsForSave(values) as unknown as Json
  });

  if (error) {
    return error.code === UNIQUE_VIOLATION
      ? failure("duplicate-slug")
      : failure("failed", error.message);
  }

  if (typeof data !== "string" || data.length === 0) {
    return failure("failed", "The saved document id was not returned.");
  }

  for (const path of options.replaceStoragePaths ?? []) {
    await removeDocumentObject(supabase, path);
  }

  return { ok: true, id: data };
}

export async function publishDocument(
  supabase: SupabaseClient<Database> | null,
  id: string,
  now: Date = new Date()
): Promise<AdminDocumentMutationResult> {
  return transitionDocument(supabase, id, "published", now.toISOString());
}

export async function unpublishDocument(
  supabase: SupabaseClient<Database> | null,
  id: string
): Promise<AdminDocumentMutationResult> {
  return transitionDocument(supabase, id, "draft", null);
}

async function transitionDocument(
  supabase: SupabaseClient<Database> | null,
  id: string,
  status: DocumentStatus,
  publishedAt: string | null
): Promise<AdminDocumentMutationResult> {
  if (!supabase) return failure("unavailable");

  const { error } = await supabase.rpc(TRANSITION_DOCUMENT_RPC, {
    p_id: id,
    p_status: status,
    p_published_at: publishedAt as unknown as string
  });

  return error ? failure("failed", error.message) : { ok: true };
}

export async function removeDocumentObject(
  supabase: SupabaseClient<Database> | null,
  path: string
): Promise<AdminDocumentMutationResult> {
  if (!supabase) return failure("unavailable");

  const { error } = await supabase.storage
    .from(PUBLIC_DOCUMENTS_BUCKET)
    .remove([path]);

  return error ? failure("failed", error.message) : { ok: true };
}

/**
 * Deletes the root row; translations cascade. The stored file is removed
 * best-effort first so a storage failure cannot block the delete.
 */
export async function deleteDocument(
  supabase: SupabaseClient<Database> | null,
  id: string,
  storagePath: string | null = null
): Promise<AdminDocumentMutationResult> {
  if (!supabase) return failure("unavailable");

  if (storagePath) {
    await removeDocumentObject(supabase, storagePath);
  }

  const { error } = await supabase
    .from("organization_documents")
    .delete()
    .eq("id", id);

  return error ? failure("failed", error.message) : { ok: true };
}
