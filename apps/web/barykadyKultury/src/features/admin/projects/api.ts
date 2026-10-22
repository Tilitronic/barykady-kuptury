import type { SupabaseClient } from "@supabase/supabase-js";

import {
  validateUpload,
  type UploadFileLike
} from "@/features/files/validateUpload";
import { SUPPORTED_LOCALES, type Locale } from "@/features/i18n/locales";
import { PROJECT_COVER_BUCKET } from "@/features/projects/cover";
import type { Database } from "@/types/database.types";

import {
  emptyTranslation,
  type ProjectFormValues,
  type ProjectStatus,
  type TranslationDraft
} from "./projectForm";

/**
 * T-027 — the ONLY write path for projects.
 *
 * Architecture gate (docs/architecture.md §3, T-027 review gate): mutations
 * live in a feature module, never in a component. Every function here takes the
 * injected client, returns a discriminated result, and lets the page decide how
 * to announce it. No optimistic state: callers await, then re-read.
 *
 * Security boundary: these calls run as the signed-in admin. PostgreSQL RLS
 * (`projects_insert_admin` / `projects_update_admin` / `projects_delete_admin`,
 * T-013) is the authorization authority; the route guard is only navigation
 * UX (docs/PRODUCT_REQUIREMENTS.md §6, docs/architecture.md §6).
 */

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
type ProjectTranslationRow =
  Database["public"]["Tables"]["project_translations"]["Row"];

interface AdminProjectRowWithTranslations extends ProjectRow {
  readonly project_translations: readonly ProjectTranslationRow[];
}

export interface AdminProjectTranslation {
  readonly title: string;
  readonly summary: string;
  readonly body: string;
}

/** Locale-independent lifecycle plus the full per-locale edit surface. */
export interface AdminProject {
  readonly id: string;
  readonly slug: string;
  readonly status: ProjectStatus;
  readonly featured: boolean;
  readonly featuredRank: number | null;
  readonly coverPath: string | null;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly publishedAt: string | null;
  readonly updatedAt: string;
  readonly translations: Record<Locale, AdminProjectTranslation>;
}

export type AdminFailureCode =
  | "unavailable"
  | "duplicate-slug"
  | "invalid-upload"
  | "failed";

export interface AdminFailure {
  readonly ok: false;
  readonly code: AdminFailureCode;
  /** Stable diagnostic only — never rendered raw to the user. */
  readonly message?: string;
}

export type AdminMutationResult =
  | { readonly ok: true; readonly id?: string }
  | AdminFailure;

export type AdminSaveResult =
  | { readonly ok: true; readonly id: string }
  | AdminFailure;

export type AdminProjectResult =
  | { readonly ok: true; readonly project: AdminProject }
  | {
      readonly ok: false;
      readonly code: "not-found" | "unavailable" | "failed";
    };

export type AdminProjectListResult =
  | { readonly ok: true; readonly projects: readonly AdminProject[] }
  | AdminFailure;

const ADMIN_PROJECT_SELECT =
  "id, slug, status, featured_rank, cover_path, start_date, end_date, published_at, updated_at, project_translations(locale, title, summary, body)";

/** PostgREST's unique-violation code (the D-24 constraint's final word). */
const UNIQUE_VIOLATION = "23505";

/** Image MIME types accepted for a project cover (T-014 storage policy). */
const COVER_MIME_PREFIX = "image/";

function failure(code: AdminFailureCode, message?: string): AdminFailure {
  return message === undefined
    ? { ok: false, code }
    : { ok: false, code, message };
}

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

function nullable(value: string): string | null {
  return isBlank(value) ? null : value;
}

function translationsFromRow(
  rows: readonly ProjectTranslationRow[]
): Record<Locale, AdminProjectTranslation> {
  const translations = Object.fromEntries(
    SUPPORTED_LOCALES.map(locale => [locale, emptyTranslation()])
  ) as Record<Locale, TranslationDraft>;

  for (const row of rows) {
    // The generated enum is exactly the Locale union; the guard keeps a
    // malformed payload from creating an off-contract key.
    if ((SUPPORTED_LOCALES as readonly string[]).includes(row.locale)) {
      translations[row.locale] = {
        title: row.title,
        summary: row.summary ?? "",
        body: row.body ?? ""
      };
    }
  }

  return translations;
}

export function mapAdminProject(
  row: AdminProjectRowWithTranslations
): AdminProject {
  return {
    id: row.id,
    slug: row.slug,
    status: row.status,
    featured: row.featured_rank !== null,
    featuredRank: row.featured_rank,
    coverPath: row.cover_path,
    startDate: row.start_date,
    endDate: row.end_date,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    translations: translationsFromRow(row.project_translations)
  };
}

/** Admin list (drafts included — RLS grants admins the full table). */
export async function fetchAdminProjects(
  supabase: SupabaseClient<Database> | null,
  options: { readonly status?: ProjectStatus | null } = {}
): Promise<AdminProjectListResult> {
  if (!supabase) return failure("unavailable");

  let query = supabase.from("projects").select(ADMIN_PROJECT_SELECT);
  if (options.status) query = query.eq("status", options.status);

  const { data, error } = await query
    .order("updated_at", { ascending: false })
    .overrideTypes<AdminProjectRowWithTranslations[], { merge: false }>();

  if (error) return failure("failed", error.message);

  return { ok: true, projects: (data ?? []).map(mapAdminProject) };
}

/** One project with every translation (admin edit/preview). */
export async function fetchAdminProject(
  supabase: SupabaseClient<Database> | null,
  id: string
): Promise<AdminProjectResult> {
  if (!supabase) return { ok: false, code: "unavailable" };

  const { data, error } = await supabase
    .from("projects")
    .select(ADMIN_PROJECT_SELECT)
    .eq("id", id)
    .maybeSingle()
    .overrideTypes<AdminProjectRowWithTranslations, { merge: false }>();

  if (error) return { ok: false, code: "failed" };
  if (!data) return { ok: false, code: "not-found" };

  return { ok: true, project: mapAdminProject(data) };
}

/**
 * D-24 global uniqueness pre-check. The database constraint remains the real
 * authority (`saveProject` maps 23505 to the same field error).
 *
 * The boolean overload is for the edit page's live feedback; `saveProject`
 * uses the error-preserving internal form so a network failure is not
 * misreported as "this slug is taken".
 */
export async function isSlugAvailable(
  supabase: SupabaseClient<Database> | null,
  slug: string,
  excludeId?: string | null
): Promise<boolean> {
  const result = await checkSlug(supabase, slug, excludeId);
  return result.ok ? result.available : false;
}

type SlugCheck =
  | { readonly ok: true; readonly available: boolean }
  | AdminFailure;

async function checkSlug(
  supabase: SupabaseClient<Database> | null,
  slug: string,
  excludeId?: string | null
): Promise<SlugCheck> {
  if (!supabase) return failure("unavailable");

  const { data, error } = await supabase
    .from("projects")
    .select("id")
    .eq("slug", slug);

  if (error) return failure("failed", error.message);

  return {
    ok: true,
    available: !(data ?? []).some(row => row.id !== excludeId)
  };
}

export interface SaveProjectOptions {
  readonly id?: string | null;
  /** Preserves the T-030 ordering slot when the featured flag is unchanged. */
  readonly existingFeaturedRank?: number | null;
  /** Preserves the original publication time on a later content edit. */
  readonly existingPublishedAt?: string | null;
}

/**
 * Persists the root row and every non-empty translation.
 *
 * A locale row exists only when it has a title (the column is NOT NULL);
 * summary/body may be blank in a draft, which is exactly what makes an
 * incomplete draft savable (T-027 acceptance criterion 1). Clearing a title
 * removes that locale's row so stale text cannot silently survive.
 *
 * @returns the project id on success; `duplicate-slug` is a recoverable field
 *   error (both the pre-check and the unique constraint map to it).
 */
export async function saveProject(
  supabase: SupabaseClient<Database> | null,
  values: ProjectFormValues,
  options: SaveProjectOptions = {}
): Promise<AdminSaveResult> {
  if (!supabase) return failure("unavailable");

  const slug = values.slug.trim();
  const availability = await checkSlug(supabase, slug, options.id ?? null);
  if (!availability.ok) return availability;
  if (!availability.available) return failure("duplicate-slug");

  const id = options.id ?? null;
  const publishedAt =
    values.status === "published"
      ? (options.existingPublishedAt ?? new Date().toISOString())
      : null;

  const root: Database["public"]["Tables"]["projects"]["Insert"] = {
    slug,
    status: values.status,
    featured_rank: values.featured ? (options.existingFeaturedRank ?? 1) : null,
    cover_path: values.coverPath,
    start_date: nullable(values.startDate),
    end_date: nullable(values.endDate),
    published_at: publishedAt
  };

  let projectId = id;

  if (id === null) {
    const { data, error } = await supabase
      .from("projects")
      .insert(root)
      .select("id")
      .single();

    if (error) {
      return error.code === UNIQUE_VIOLATION
        ? failure("duplicate-slug")
        : failure("failed", error.message);
    }

    const inserted = Array.isArray(data) ? data[0] : data;
    if (!inserted || typeof inserted.id !== "string") {
      return failure("failed", "The inserted project id was not returned.");
    }
    projectId = inserted.id;
  } else {
    const { error } = await supabase.from("projects").update(root).eq("id", id);

    if (error) {
      return error.code === UNIQUE_VIOLATION
        ? failure("duplicate-slug")
        : failure("failed", error.message);
    }
  }

  if (projectId === null) return failure("failed");

  const rows = SUPPORTED_LOCALES.filter(
    locale => !isBlank(values.translations[locale].title)
  ).map(locale => {
    const translation = values.translations[locale];
    return {
      project_id: projectId,
      locale,
      title: translation.title.trim(),
      summary: nullable(translation.summary),
      body: nullable(translation.body)
    };
  });

  if (rows.length > 0) {
    const { error } = await supabase
      .from("project_translations")
      .upsert(rows, { onConflict: "project_id,locale" });

    if (error) return failure("failed", error.message);
  }

  // An update that clears a locale title must remove the row, otherwise the
  // public reader would keep serving text the editor believes is gone.
  const clearedLocales = SUPPORTED_LOCALES.filter(locale =>
    isBlank(values.translations[locale].title)
  );

  for (const locale of clearedLocales) {
    const { error } = await supabase
      .from("project_translations")
      .delete()
      .eq("project_id", projectId)
      .eq("locale", locale);

    if (error) return failure("failed", error.message);
  }

  return { ok: true, id: projectId };
}

/** Publish: status + a fresh `published_at` (never an optimistic flip). */
export async function publishProject(
  supabase: SupabaseClient<Database> | null,
  id: string,
  now: Date = new Date()
): Promise<AdminMutationResult> {
  if (!supabase) return failure("unavailable");

  const { error } = await supabase
    .from("projects")
    .update({ status: "published", published_at: now.toISOString() })
    .eq("id", id);

  return error ? failure("failed", error.message) : { ok: true };
}

/** Unpublish: back to draft so the public query can no longer see it. */
export async function unpublishProject(
  supabase: SupabaseClient<Database> | null,
  id: string
): Promise<AdminMutationResult> {
  return setLifecycle(supabase, id, "draft");
}

/** Archive: retained for admins, absent from public listings. */
export async function archiveProject(
  supabase: SupabaseClient<Database> | null,
  id: string
): Promise<AdminMutationResult> {
  return setLifecycle(supabase, id, "archived");
}

async function setLifecycle(
  supabase: SupabaseClient<Database> | null,
  id: string,
  status: ProjectStatus
): Promise<AdminMutationResult> {
  if (!supabase) return failure("unavailable");

  const { error } = await supabase
    .from("projects")
    .update({ status, published_at: null })
    .eq("id", id);

  return error ? failure("failed", error.message) : { ok: true };
}

/**
 * Deletes the root row; `project_translations` cascades (T-012) and
 * `calendar_event_links.project_id` becomes NULL (architecture §4), so an
 * event never loses its own identity when a project is deleted.
 */
export async function deleteProject(
  supabase: SupabaseClient<Database> | null,
  id: string
): Promise<AdminMutationResult> {
  if (!supabase) return failure("unavailable");

  const { error } = await supabase.from("projects").delete().eq("id", id);

  return error ? failure("failed", error.message) : { ok: true };
}

/**
 * Validates and uploads a cover through the T-014 gate.
 *
 * The shared validator rejects active content (SVG/HTML/JS), oversize files and
 * name/MIME mismatches; this wrapper narrows it further to images because a
 * project cover is rendered as an `<img>`. The storage bucket's own limits and
 * policies remain the server-side authority (docs/architecture.md §6).
 */
export async function uploadProjectCover(
  supabase: SupabaseClient<Database> | null,
  file: File & UploadFileLike,
  existingNames: readonly string[] = []
): Promise<{ readonly ok: true; readonly path: string } | AdminFailure> {
  if (!supabase) return failure("unavailable");

  const validation = validateUpload(file, { existingNames });
  if (!validation.ok) {
    return failure("invalid-upload", validation.code);
  }
  if (!validation.mimeType.startsWith(COVER_MIME_PREFIX)) {
    return failure("invalid-upload", "not-an-image");
  }

  const path = `projects/${validation.fileName}`;
  const { error } = await supabase.storage
    .from(PROJECT_COVER_BUCKET)
    .upload(path, file, { upsert: false, contentType: validation.mimeType });

  if (error) return failure("failed", error.message);

  return { ok: true, path };
}
