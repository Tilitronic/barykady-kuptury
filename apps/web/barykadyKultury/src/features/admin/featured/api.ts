import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

import { moveItem, type MoveDirection } from "../shared/ordering";

/**
 * T-030 — the ONLY write path for homepage featured ordering.
 *
 * Design authority:
 *   - docs/PRODUCT_REQUIREMENTS.md §5: featured projects are shown in the
 *     administrator's order; an empty set falls back to recent published
 *     projects (that fallback lives in `features/projects/ordering`).
 *   - docs/architecture.md §3: components never build queries; the page calls
 *     this module and renders the discriminated result.
 *   - docs/architecture.md §4: `projects.featured_rank` is the single
 *     locale-independent order.
 *   - T-030: only published projects can be featured; add/remove/reorder is
 *     transactional and gap-free; last-write-wins under concurrent reorders.
 *   - T-046: `projects:write` is the scope; the RPCs re-check it inside the
 *     database and RLS remains the second boundary.
 *
 * The mutation shape intentionally copies the T-028 team contract:
 * `set_project_featured_v1` (one add/remove with dense renumbering) and
 * `reorder_featured_projects_v1` (complete desired list, one transaction).
 */

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
type ProjectTranslationRow =
  Database["public"]["Tables"]["project_translations"]["Row"];

type FeaturedProjectRow = Pick<
  ProjectRow,
  "id" | "slug" | "status" | "featured_rank" | "updated_at"
> & {
  readonly project_translations: readonly Pick<
    ProjectTranslationRow,
    "locale" | "title"
  >[];
};

export interface FeaturedProject {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  /** NULL only for an `available` candidate; featured rows always have a rank. */
  readonly rank: number | null;
  readonly updatedAt: string;
}

export type FeaturedFailureCode =
  | "unavailable"
  | "not-found"
  | "not-published"
  | "failed";

export interface FeaturedFailure {
  readonly ok: false;
  readonly code: FeaturedFailureCode;
  /** Stable diagnostic only — never rendered raw to the user. */
  readonly message?: string;
}

export type FeaturedMutationResult = { readonly ok: true } | FeaturedFailure;

export interface FeaturedAdminData {
  /** Featured, published rows in the exact homepage order. */
  readonly featured: readonly FeaturedProject[];
  /** Published, not-yet-featured rows available to append. */
  readonly available: readonly FeaturedProject[];
}

export type FeaturedAdminDataResult =
  | ({ readonly ok: true } & FeaturedAdminData)
  | FeaturedFailure;

const ADMIN_FEATURED_SELECT =
  "id, slug, status, featured_rank, updated_at, project_translations(locale, title)";

const SET_FEATURED_RPC = "set_project_featured_v1" as const;
const REORDER_FEATURED_RPC = "reorder_featured_projects_v1" as const;

/**
 * Postgres errors safe to retry for an idempotent featured mutation:
 *   - 23505 — the deferred unique rank constraint lost a commit race;
 *   - 40P01 — a deadlock while two administrators touched overlapping rows.
 *
 * The retry sends the same desired state again. The RPC is one transaction, so
 * a failed first attempt rolled back completely; retrying cannot compound a
 * partial write.
 */
const RETRYABLE_FEATURED_CODES: ReadonlySet<string> = new Set([
  "23505",
  "40P01"
]);

function failure(code: FeaturedFailureCode, message?: string): FeaturedFailure {
  return message === undefined
    ? { ok: false, code }
    : { ok: false, code, message };
}

function displayTitle(row: FeaturedProjectRow): string {
  // The admin needs a stable identifier. English is the fallback language in
  // the public contract, so it is also the natural admin label; the slug is a
  // last resort for a row whose English translation is not written yet.
  const english = row.project_translations.find(
    translation => translation.locale === "en"
  );
  return english?.title ?? row.slug;
}

function mapFeaturedProject(row: FeaturedProjectRow): FeaturedProject | null {
  // Defence in depth beside RLS/the published-only RPC guard: a draft that
  // leaks into the payload must never be presented as homepage content
  // (docs/PRODUCT_REQUIREMENTS.md §8).
  if (row.status !== "published") return null;

  return {
    id: row.id,
    slug: row.slug,
    title: displayTitle(row),
    rank: row.featured_rank,
    updatedAt: row.updated_at
  };
}

/**
 * Reads the two lists the featured screen needs in one query: every published
 * project (already narrowed in SQL), split into ordered featured rows and
 * alphabetically sorted candidates.
 */
export async function fetchFeaturedAdminData(
  supabase: SupabaseClient<Database> | null
): Promise<FeaturedAdminDataResult> {
  if (!supabase) return failure("unavailable");

  const { data, error } = await supabase
    .from("projects")
    .select(ADMIN_FEATURED_SELECT)
    .eq("status", "published")
    .order("featured_rank", { ascending: true, nullsFirst: false })
    .overrideTypes<FeaturedProjectRow[], { merge: false }>();

  if (error) return failure("failed", error.message);

  const published = (data ?? [])
    .map(mapFeaturedProject)
    .filter((project): project is FeaturedProject => project !== null)
    .sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id));

  const featured = published
    .filter(
      (project): project is FeaturedProject & { rank: number } =>
        project.rank !== null
    )
    .sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id));
  const available = published.filter(project => project.rank === null);

  return { ok: true, featured, available };
}

/**
 * Runs one idempotent featured RPC, retrying exactly once on a transient
 * conflict. `draftRejection` maps the database's published-only CONSTRAINT
 * error (23514) to the localized "publish first" service code.
 */
async function callFeaturedRpc<
  Name extends typeof SET_FEATURED_RPC | typeof REORDER_FEATURED_RPC
>(
  supabase: SupabaseClient<Database>,
  name: Name,
  args: Database["public"]["Functions"][Name]["Args"],
  mapDraftRejection: boolean
): Promise<FeaturedMutationResult> {
  const first = await supabase.rpc(name, args);
  if (!first.error) return { ok: true };

  if (
    first.error.code !== undefined &&
    RETRYABLE_FEATURED_CODES.has(first.error.code)
  ) {
    const retry = await supabase.rpc(name, args);
    if (!retry.error) return { ok: true };
    return mapRpcError(retry.error, mapDraftRejection);
  }

  return mapRpcError(first.error, mapDraftRejection);
}

function mapRpcError(
  error: { readonly code?: string; readonly message: string },
  mapDraftRejection: boolean
): FeaturedFailure {
  if (mapDraftRejection && error.code === "23514") {
    return failure("not-published", error.message);
  }
  return failure("failed", error.message);
}

/**
 * Adds one published project at the end of the featured sequence.
 *
 * The local status check gives the administrator an immediate, localized
 * message; the RPC repeats the check so a direct/racing call cannot bypass it.
 */
export async function addFeaturedProject(
  supabase: SupabaseClient<Database> | null,
  id: string
): Promise<FeaturedMutationResult> {
  if (!supabase) return failure("unavailable");

  const { data, error } = await supabase
    .from("projects")
    .select("id, status")
    .eq("id", id)
    .maybeSingle()
    .overrideTypes<
      { readonly id: string; readonly status: string },
      { merge: false }
    >();

  if (error) return failure("failed", error.message);
  if (!data) return failure("not-found");
  if (data.status !== "published") return failure("not-published");

  return callFeaturedRpc(
    supabase,
    SET_FEATURED_RPC,
    { p_id: id, p_featured: true },
    true
  );
}

/** Removes one project and lets the RPC close the rank gap transactionally. */
export async function removeFeaturedProject(
  supabase: SupabaseClient<Database> | null,
  id: string
): Promise<FeaturedMutationResult> {
  if (!supabase) return failure("unavailable");

  return callFeaturedRpc(
    supabase,
    SET_FEATURED_RPC,
    { p_id: id, p_featured: false },
    false
  );
}

/**
 * Persists the complete desired featured order. Concurrency is last-write-wins
 * (one editorial homepage order; no optimistic version column). A lost commit
 * race surfaces as 23505/40P01 and gets one retry of the same list, never as a
 * silent duplicate rank.
 */
export async function reorderFeaturedProjects(
  supabase: SupabaseClient<Database> | null,
  ids: readonly string[]
): Promise<FeaturedMutationResult> {
  if (!supabase) return failure("unavailable");

  return callFeaturedRpc(
    supabase,
    REORDER_FEATURED_RPC,
    { p_ids: [...ids] },
    false
  );
}

/**
 * Convenience for the Up/Down buttons: apply the pure position maths, then
 * persist the resulting complete order. The page awaits and re-reads; there is
 * no optimistic list state.
 */
export async function moveFeaturedProject(
  supabase: SupabaseClient<Database> | null,
  ids: readonly string[],
  id: string,
  direction: MoveDirection
): Promise<
  { readonly ok: true; readonly ids: readonly string[] } | FeaturedFailure
> {
  if (!supabase) return failure("unavailable");

  const next = moveItem(ids, id, direction);
  const result = await reorderFeaturedProjects(supabase, next);
  return result.ok ? { ok: true, ids: next } : result;
}
