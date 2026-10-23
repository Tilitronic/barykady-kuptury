import type { SupabaseClient } from "@supabase/supabase-js";

import { SUPPORTED_LOCALES, type Locale } from "@/features/i18n/locales";
import type { Database, Json } from "@/types/database.types";

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
 * T-045 hardening: the root write, translation upserts, per-locale deletes and
 * lifecycle transition now travel as PostgreSQL RPCs
 * (`save_project_v1`, `transition_project_v1`) rather than as a sequence of
 * independent table requests. A mid-flight failure therefore leaves no partial
 * root/translation state; the database transaction is the unit of success.
 * This module keeps the exact result-union contract, so the editor page did not
 * change.
 *
 * Security boundary: these calls run as the signed-in admin, and the RPCs are
 * SECURITY INVOKER with an in-function `is_admin()` check (T-045). PostgreSQL
 * RLS (`projects_insert_admin` / `projects_update_admin` /
 * `projects_delete_admin`, T-013) remains a second, independent authorization
 * authority; the route guard is only navigation UX
 * (docs/PRODUCT_REQUIREMENTS.md §6, docs/architecture.md §6).
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

/**
 * T-045 — the two transactional mutation seams. Keeping the names as literals
 * gives a single place to audit the client/server contract.
 */
const SAVE_PROJECT_RPC = "save_project_v1" as const;
const TRANSITION_PROJECT_RPC = "transition_project_v1" as const;

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
 * Persists the root row, every non-empty translation, and the requested
 * lifecycle state through one transaction (T-045).
 *
 * A locale row exists only when it has a title (the column is NOT NULL);
 * summary/body may be blank in a draft, which is exactly what makes an
 * incomplete draft savable (T-027 acceptance criterion 1). Clearing a title
 * removes that locale's row so stale text cannot silently survive. The RPC
 * treats the payload as the complete intended translation set, so passing an
 * omitted locale is the clear signal.
 *
 * The advisory slug pre-check stays for immediate field feedback; 23505 from
 * the RPC is still mapped to the same recoverable `duplicate-slug` result.
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

  const publishedAt =
    values.status === "published"
      ? (options.existingPublishedAt ?? new Date().toISOString())
      : null;

  const translations = SUPPORTED_LOCALES.filter(
    locale => !isBlank(values.translations[locale].title)
  ).map(locale => ({
    locale,
    title: values.translations[locale].title.trim(),
    summary: nullable(values.translations[locale].summary),
    body: nullable(values.translations[locale].body)
  }));

  const { data, error } = await supabase.rpc(
    SAVE_PROJECT_RPC,
    saveProjectArgs(values, options, slug, publishedAt, translations)
  );

  if (error) {
    return error.code === UNIQUE_VIOLATION
      ? failure("duplicate-slug")
      : failure("failed", error.message);
  }

  // A scalar-returning PostgREST function yields the id directly. Anything
  // else means the contract drifted; fail closed instead of returning `ok`.
  if (typeof data !== "string" || data.length === 0) {
    return failure("failed", "The saved project id was not returned.");
  }

  return { ok: true, id: data };
}

type SaveProjectRpcArgs =
  Database["public"]["Functions"]["save_project_v1"]["Args"];

/**
 * The generated function Args type marks every SQL argument non-null, even
 * though several parameters are nullable by design. PostgREST accepts explicit
 * nulls; keeping the casts in one helper documents the mismatch and prevents
 * it from leaking into the mutation logic (same pattern as the import
 * persistence RPC).
 */
function saveProjectArgs(
  values: ProjectFormValues,
  options: SaveProjectOptions,
  slug: string,
  publishedAt: string | null,
  translations: readonly {
    readonly locale: Locale;
    readonly title: string;
    readonly summary: string | null;
    readonly body: string | null;
  }[]
): SaveProjectRpcArgs {
  return {
    p_id: (options.id ?? null) as unknown as string,
    p_slug: slug,
    p_status: values.status,
    // Preserves the T-030 ordering slot when the featured flag is unchanged.
    p_featured_rank: (values.featured
      ? (options.existingFeaturedRank ?? 1)
      : null) as unknown as number,
    p_cover_path: values.coverPath as unknown as string,
    p_start_date: nullable(values.startDate) as unknown as string,
    p_end_date: nullable(values.endDate) as unknown as string,
    p_published_at: publishedAt as unknown as string,
    p_translations: translations as unknown as Json
  };
}

/**
 * Publish: status + a fresh `published_at`, computed by the same database
 * statement (T-045), so the invariant holds even if the client is interrupted
 * after the request is sent.
 */
export async function publishProject(
  supabase: SupabaseClient<Database> | null,
  id: string,
  now: Date = new Date()
): Promise<AdminMutationResult> {
  return transitionProject(supabase, id, "published", now.toISOString());
}

/** Unpublish: back to draft so the public query can no longer see it. */
export async function unpublishProject(
  supabase: SupabaseClient<Database> | null,
  id: string
): Promise<AdminMutationResult> {
  return transitionProject(supabase, id, "draft", null);
}

/** Archive: retained for admins, absent from public listings. */
export async function archiveProject(
  supabase: SupabaseClient<Database> | null,
  id: string
): Promise<AdminMutationResult> {
  return transitionProject(supabase, id, "archived", null);
}

type TransitionProjectRpcArgs =
  Database["public"]["Functions"]["transition_project_v1"]["Args"];

/**
 * One RPC for every lifecycle transition: status and published_at are derived
 * together inside the database, never as two client-side requests.
 */
async function transitionProject(
  supabase: SupabaseClient<Database> | null,
  id: string,
  status: ProjectStatus,
  publishedAt: string | null
): Promise<AdminMutationResult> {
  if (!supabase) return failure("unavailable");

  const args: TransitionProjectRpcArgs = {
    p_id: id,
    p_status: status,
    // The generated Args type models this as optional/non-null; the SQL
    // parameter is nullable and PostgREST accepts an explicit null.
    p_published_at: publishedAt as unknown as string
  };

  const { error } = await supabase.rpc(TRANSITION_PROJECT_RPC, args);

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
