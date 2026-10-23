import type { SupabaseClient } from "@supabase/supabase-js";

import { PUBLIC_DOCUMENTS_BUCKET } from "@/features/files/buckets";
import { SUPPORTED_LOCALES, type Locale } from "@/features/i18n/locales";
import type { Database, Json } from "@/types/database.types";

import {
  emptyPublicationTranslation,
  publicationFilesForSave,
  publicationTranslationsForSave,
  type PublicationFileDraft,
  type PublicationFormValues,
  type PublicationStatus,
  type PublicationTranslationDraft
} from "./publicationForm";

/**
 * T-029 — the ONLY write path for publications.
 *
 * Design authority:
 *   - docs/architecture.md §3: components never build queries.
 *   - docs/architecture.md §4: root metadata + one translation per locale +
 *     one file per language.
 *   - docs/architecture.md §6.1: `publications:write` gates the table RPC;
 *     publication files live in `public-documents`.
 *   - T-045/T-028: copy the paired transactional RPC pattern per entity rather
 *     than inventing a generic mutation framework. `save_publication_v1`
 *     carries root + translations + files in one transaction;
 *     `transition_publication_v1` moves status/published_at together.
 *
 * Storage paths are bucket-relative object keys, never public URLs. The
 * cleanup seams are deliberately separate from the transaction: a storage
 * delete is best-effort and a failure must not resurrect a deleted row.
 */

type PublicationRow = Database["public"]["Tables"]["publications"]["Row"];
type PublicationTranslationRow =
  Database["public"]["Tables"]["publication_translations"]["Row"];
type PublicationFileRow =
  Database["public"]["Tables"]["publication_files"]["Row"];

interface AdminPublicationRow extends PublicationRow {
  readonly publication_translations: readonly PublicationTranslationRow[];
  readonly publication_files: readonly PublicationFileRow[];
}

export interface AdminPublicationFile {
  readonly locale: Locale;
  readonly label: string;
  readonly storagePath: string;
  readonly mimeType: string | null;
  readonly sizeBytes: number | null;
}

export interface AdminPublication {
  readonly id: string;
  readonly slug: string;
  readonly status: PublicationStatus;
  readonly language: Locale | null;
  readonly publicationDate: string | null;
  readonly externalUrl: string | null;
  readonly sortOrder: number;
  readonly publishedAt: string | null;
  readonly updatedAt: string;
  readonly translations: Record<Locale, PublicationTranslationDraft>;
  readonly files: readonly AdminPublicationFile[];
}

export type AdminPublicationFailureCode =
  | "unavailable"
  | "duplicate-slug"
  | "invalid-upload"
  | "failed";

export interface AdminPublicationFailure {
  readonly ok: false;
  readonly code: AdminPublicationFailureCode;
  /** Stable diagnostic only — never rendered raw to the user. */
  readonly message?: string;
}

export type AdminPublicationMutationResult =
  | { readonly ok: true }
  | AdminPublicationFailure;

export type AdminPublicationSaveResult =
  | { readonly ok: true; readonly id: string }
  | AdminPublicationFailure;

export type AdminPublicationResult =
  | { readonly ok: true; readonly publication: AdminPublication }
  | {
      readonly ok: false;
      readonly code: "not-found" | AdminPublicationFailureCode;
    };

export type AdminPublicationListResult =
  | { readonly ok: true; readonly publications: readonly AdminPublication[] }
  | AdminPublicationFailure;

const ADMIN_PUBLICATION_SELECT =
  "id, slug, status, language, publication_date, external_url, sort_order, published_at, updated_at, publication_translations(locale, title, abstract, authors), publication_files(locale, label, storage_path, mime_type, file_size_bytes)";

const UNIQUE_VIOLATION = "23505";

const SAVE_PUBLICATION_RPC = "save_publication_v1" as const;
const TRANSITION_PUBLICATION_RPC = "transition_publication_v1" as const;

function failure(
  code: AdminPublicationFailureCode,
  message?: string
): AdminPublicationFailure {
  return message === undefined
    ? { ok: false, code }
    : { ok: false, code, message };
}

function nullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function translationsFromRows(
  rows: readonly PublicationTranslationRow[]
): Record<Locale, PublicationTranslationDraft> {
  const translations = Object.fromEntries(
    SUPPORTED_LOCALES.map(locale => [locale, emptyPublicationTranslation()])
  ) as Record<Locale, PublicationTranslationDraft>;

  for (const row of rows) {
    if ((SUPPORTED_LOCALES as readonly string[]).includes(row.locale)) {
      translations[row.locale] = {
        title: row.title,
        abstract: row.abstract ?? "",
        authors: row.authors ?? ""
      };
    }
  }

  return translations;
}

export function mapAdminPublication(
  row: AdminPublicationRow
): AdminPublication {
  return {
    id: row.id,
    slug: row.slug,
    status: row.status,
    language: row.language,
    publicationDate: row.publication_date,
    externalUrl: row.external_url,
    sortOrder: row.sort_order,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    translations: translationsFromRows(row.publication_translations),
    files: (row.publication_files ?? []).map(file => ({
      locale: file.locale,
      label: file.label ?? "",
      storagePath: file.storage_path,
      mimeType: file.mime_type,
      sizeBytes: file.file_size_bytes
    }))
  };
}

/** Admin list (drafts included; RLS grants `publications:write`). */
export async function fetchAdminPublications(
  supabase: SupabaseClient<Database> | null,
  options: { readonly status?: PublicationStatus | null } = {}
): Promise<AdminPublicationListResult> {
  if (!supabase) return failure("unavailable");

  let query = supabase.from("publications").select(ADMIN_PUBLICATION_SELECT);
  if (options.status) query = query.eq("status", options.status);

  const { data, error } = await query
    .order("updated_at", { ascending: false })
    .overrideTypes<AdminPublicationRow[], { merge: false }>();

  if (error) return failure("failed", error.message);

  return { ok: true, publications: (data ?? []).map(mapAdminPublication) };
}

export async function fetchAdminPublication(
  supabase: SupabaseClient<Database> | null,
  id: string
): Promise<AdminPublicationResult> {
  if (!supabase) return { ok: false, code: "unavailable" };

  const { data, error } = await supabase
    .from("publications")
    .select(ADMIN_PUBLICATION_SELECT)
    .eq("id", id)
    .maybeSingle()
    .overrideTypes<AdminPublicationRow, { merge: false }>();

  if (error) return { ok: false, code: "failed" };
  if (!data) return { ok: false, code: "not-found" };

  return { ok: true, publication: mapAdminPublication(data) };
}

type PublicationSlugCheck =
  | { readonly ok: true; readonly available: boolean }
  | AdminPublicationFailure;

/**
 * Advisory D-24 pre-check; the unique constraint remains authoritative.
 *
 * Unlike the public boolean wrapper, this internal form preserves a query
 * failure so `savePublication` cannot misreport a network error as "slug
 * already taken" (the same distinction T-027 made after review).
 */
async function checkPublicationSlug(
  supabase: SupabaseClient<Database> | null,
  slug: string,
  excludeId?: string | null
): Promise<PublicationSlugCheck> {
  if (!supabase) return failure("unavailable");

  const { data, error } = await supabase
    .from("publications")
    .select("id")
    .eq("slug", slug);

  if (error) return failure("failed", error.message);

  return {
    ok: true,
    available: !(data ?? []).some(row => row.id !== excludeId)
  };
}

/** Boolean convenience for live field feedback. */
export async function isPublicationSlugAvailable(
  supabase: SupabaseClient<Database> | null,
  slug: string,
  excludeId?: string | null
): Promise<boolean> {
  const result = await checkPublicationSlug(supabase, slug, excludeId);
  return result.ok ? result.available : false;
}

export interface SavePublicationOptions {
  readonly existingPublishedAt?: string | null;
  /** Object keys replaced by this save; removed only after the RPC commits. */
  readonly replaceStoragePaths?: readonly string[];
}

/**
 * Persists root + translations + files atomically.
 *
 * `p_files` is the complete intended file set: an omitted locale deletes that
 * language's row, which is exactly how "remove a version" and "replace removes
 * the old reference" work. The database additionally enforces one row per
 * `(publication_id, locale)` and the URL xor files invariant.
 */
export async function savePublication(
  supabase: SupabaseClient<Database> | null,
  values: PublicationFormValues,
  options: SavePublicationOptions = {}
): Promise<AdminPublicationSaveResult> {
  if (!supabase) return failure("unavailable");

  const slug = values.slug.trim();
  const availability = await checkPublicationSlug(supabase, slug, values.id);
  if (!availability.ok) return availability;
  if (!availability.available) return failure("duplicate-slug");

  const publishedAt =
    values.status === "published"
      ? (options.existingPublishedAt ?? new Date().toISOString())
      : null;

  const { data, error } = await supabase.rpc(SAVE_PUBLICATION_RPC, {
    p_id: values.id as unknown as string,
    p_slug: slug,
    p_status: values.status,
    p_language:
      values.language as unknown as Database["public"]["Enums"]["content_locale"],
    p_publication_date: nullable(values.publicationDate) as unknown as string,
    p_external_url: nullable(values.externalUrl) as unknown as string,
    p_sort_order: values.sortOrder as unknown as number,
    p_published_at: publishedAt as unknown as string,
    p_translations: publicationTranslationsForSave(values) as unknown as Json,
    p_files: publicationFilesForSave(values) as unknown as Json
  });

  if (error) {
    return error.code === UNIQUE_VIOLATION
      ? failure("duplicate-slug")
      : failure("failed", error.message);
  }

  if (typeof data !== "string" || data.length === 0) {
    return failure("failed", "The saved publication id was not returned.");
  }

  // Only now are the old objects unreachable.
  for (const path of options.replaceStoragePaths ?? []) {
    await removePublicationObject(supabase, path);
  }

  return { ok: true, id: data };
}

export async function publishPublication(
  supabase: SupabaseClient<Database> | null,
  id: string,
  now: Date = new Date()
): Promise<AdminPublicationMutationResult> {
  return transitionPublication(supabase, id, "published", now.toISOString());
}

export async function unpublishPublication(
  supabase: SupabaseClient<Database> | null,
  id: string
): Promise<AdminPublicationMutationResult> {
  return transitionPublication(supabase, id, "draft", null);
}

async function transitionPublication(
  supabase: SupabaseClient<Database> | null,
  id: string,
  status: PublicationStatus,
  publishedAt: string | null
): Promise<AdminPublicationMutationResult> {
  if (!supabase) return failure("unavailable");

  const { error } = await supabase.rpc(TRANSITION_PUBLICATION_RPC, {
    p_id: id,
    p_status: status,
    p_published_at: publishedAt as unknown as string
  });

  return error ? failure("failed", error.message) : { ok: true };
}

/** Removes one stored object. The caller decides whether to clear the row. */
export async function removePublicationObject(
  supabase: SupabaseClient<Database> | null,
  path: string
): Promise<AdminPublicationMutationResult> {
  if (!supabase) return failure("unavailable");

  const { error } = await supabase.storage
    .from(PUBLIC_DOCUMENTS_BUCKET)
    .remove([path]);

  return error ? failure("failed", error.message) : { ok: true };
}

/**
 * Deletes the root row; translations/files cascade (T-012). Objects are
 * removed best-effort first: a storage failure must not prevent the admin from
 * deleting the publication, and the database reference disappears with it.
 */
export async function deletePublication(
  supabase: SupabaseClient<Database> | null,
  id: string,
  filePaths: readonly string[] = []
): Promise<AdminPublicationMutationResult> {
  if (!supabase) return failure("unavailable");

  for (const path of filePaths) {
    await removePublicationObject(supabase, path);
  }

  const { error } = await supabase.from("publications").delete().eq("id", id);

  return error ? failure("failed", error.message) : { ok: true };
}

/** The file list for a form, preserving the stored type/size from the object. */
export function publicationFilesFromAdmin(
  publication: AdminPublication
): readonly PublicationFileDraft[] {
  return publication.files.map(file => ({
    locale: file.locale,
    label: file.label,
    storagePath: file.storagePath,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes
  }));
}
