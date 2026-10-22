import type { SupabaseClient } from "@supabase/supabase-js";

import {
  validateUpload,
  type UploadFileLike
} from "@/features/files/validateUpload";
import { SUPPORTED_LOCALES, type Locale } from "@/features/i18n/locales";
import { TEAM_PORTRAIT_BUCKET } from "@/features/team/portrait";
import type { Database, Json } from "@/types/database.types";

import {
  emptyTeamTranslation,
  teamMemberTranslationsForSave,
  type TeamMemberFormValues,
  type TeamMemberStatus,
  type TeamMemberTranslationDraft
} from "./teamForm";
import {
  moveTeamMember as moveInOrder,
  type TeamMoveDirection
} from "./teamOrder";

/**
 * T-028 — the ONLY write path for team members.
 *
 * Design authority:
 *   - docs/architecture.md §3: components never build queries.
 *   - docs/architecture.md §4: the name/order/portrait live on the root row;
 *     localized role/bio live in `team_member_translations`.
 *   - docs/architecture.md §6.1: `team:write` gates the table RPCs; portrait
 *     storage additionally needs `media:write` (the bucket policy is the
 *     authority).
 *   - T-028: create/edit/reorder/delete, optional portrait upload+removal,
 *     per-member publish toggle, keyboard-operable explicit ordering.
 *
 * Mutation shape copies T-045 per entity (architector: reuse the paired
 * transactional RPC pattern rather than inventing a generic framework):
 * `save_team_member_v1` (root + complete translation set),
 * `transition_team_member_v1` (status + published_at) and
 * `reorder_team_members_v1` (dense 1..n positions in one transaction).
 */

type TeamMemberRow = Database["public"]["Tables"]["team_members"]["Row"];
type TeamMemberTranslationRow =
  Database["public"]["Tables"]["team_member_translations"]["Row"];

interface AdminTeamMemberRowWithTranslations extends TeamMemberRow {
  readonly team_member_translations: readonly TeamMemberTranslationRow[];
}

export interface AdminTeamMemberTranslation {
  readonly role: string;
  readonly bio: string;
}

export interface AdminTeamMember {
  readonly id: string;
  readonly name: string;
  readonly status: TeamMemberStatus;
  readonly sortOrder: number;
  readonly portraitPath: string | null;
  readonly publishedAt: string | null;
  readonly updatedAt: string;
  readonly translations: Record<Locale, AdminTeamMemberTranslation>;
}

export type AdminTeamFailureCode = "unavailable" | "failed";

export interface AdminTeamFailure {
  readonly ok: false;
  readonly code: AdminTeamFailureCode;
  readonly message?: string;
}

export type AdminTeamMutationResult = { readonly ok: true } | AdminTeamFailure;

export type AdminTeamSaveResult =
  | { readonly ok: true; readonly id: string }
  | AdminTeamFailure;

export type AdminTeamMemberResult =
  | { readonly ok: true; readonly member: AdminTeamMember }
  | {
      readonly ok: false;
      readonly code: "not-found" | AdminTeamFailureCode;
    };

export type AdminTeamListResult =
  | { readonly ok: true; readonly members: readonly AdminTeamMember[] }
  | AdminTeamFailure;

const ADMIN_TEAM_SELECT =
  "id, name, status, sort_order, portrait_path, published_at, updated_at, team_member_translations(locale, role, bio)";

const SAVE_TEAM_MEMBER_RPC = "save_team_member_v1" as const;
const TRANSITION_TEAM_MEMBER_RPC = "transition_team_member_v1" as const;
const REORDER_TEAM_MEMBERS_RPC = "reorder_team_members_v1" as const;

/** Image MIME types accepted for a portrait (T-014 storage policy). */
const PORTRAIT_MIME_PREFIX = "image/";

function failure(
  code: AdminTeamFailureCode,
  message?: string
): AdminTeamFailure {
  return message === undefined
    ? { ok: false, code }
    : { ok: false, code, message };
}

function translationsFromRows(
  rows: readonly TeamMemberTranslationRow[]
): Record<Locale, AdminTeamMemberTranslation> {
  const translations = Object.fromEntries(
    SUPPORTED_LOCALES.map(locale => [locale, emptyTeamTranslation()])
  ) as Record<Locale, TeamMemberTranslationDraft>;

  for (const row of rows) {
    if ((SUPPORTED_LOCALES as readonly string[]).includes(row.locale)) {
      translations[row.locale] = {
        role: row.role ?? "",
        bio: row.bio ?? ""
      };
    }
  }

  return translations;
}

export function mapAdminTeamMember(
  row: AdminTeamMemberRowWithTranslations
): AdminTeamMember {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    sortOrder: row.sort_order,
    portraitPath: row.portrait_path,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    translations: translationsFromRows(row.team_member_translations)
  };
}

/** Admin list (drafts included), in the editorial order. */
export async function fetchAdminTeamMembers(
  supabase: SupabaseClient<Database> | null
): Promise<AdminTeamListResult> {
  if (!supabase) return failure("unavailable");

  const { data, error } = await supabase
    .from("team_members")
    .select(ADMIN_TEAM_SELECT)
    .order("sort_order", { ascending: true })
    .overrideTypes<AdminTeamMemberRowWithTranslations[], { merge: false }>();

  if (error) return failure("failed", error.message);

  return { ok: true, members: (data ?? []).map(mapAdminTeamMember) };
}

export async function fetchAdminTeamMember(
  supabase: SupabaseClient<Database> | null,
  id: string
): Promise<AdminTeamMemberResult> {
  if (!supabase) return { ok: false, code: "unavailable" };

  const { data, error } = await supabase
    .from("team_members")
    .select(ADMIN_TEAM_SELECT)
    .eq("id", id)
    .maybeSingle()
    .overrideTypes<AdminTeamMemberRowWithTranslations, { merge: false }>();

  if (error) return { ok: false, code: "failed" };
  if (!data) return { ok: false, code: "not-found" };

  return { ok: true, member: mapAdminTeamMember(data) };
}

export interface SaveTeamMemberOptions {
  /** Preserves the original publication time on a later content edit. */
  readonly existingPublishedAt?: string | null;
}

/**
 * Persists the root row and the complete localized set atomically.
 *
 * `sortOrder` is null for a new member; the RPC assigns max(sort_order)+1 in
 * the same transaction, so a create cannot race itself into a duplicate slot.
 */
export async function saveTeamMember(
  supabase: SupabaseClient<Database> | null,
  values: TeamMemberFormValues,
  options: SaveTeamMemberOptions = {}
): Promise<AdminTeamSaveResult> {
  if (!supabase) return failure("unavailable");

  const publishedAt =
    values.status === "published"
      ? (options.existingPublishedAt ?? new Date().toISOString())
      : null;

  const { data, error } = await supabase.rpc(SAVE_TEAM_MEMBER_RPC, {
    p_id: values.id as unknown as string,
    p_name: values.name.trim(),
    p_status: values.status,
    p_sort_order: values.sortOrder as unknown as number,
    p_portrait_path: values.portraitPath as unknown as string,
    p_published_at: publishedAt as unknown as string,
    p_translations: teamMemberTranslationsForSave(values) as unknown as Json
  });

  if (error) return failure("failed", error.message);

  if (typeof data !== "string" || data.length === 0) {
    return failure("failed", "The saved team member id was not returned.");
  }

  return { ok: true, id: data };
}

export async function publishTeamMember(
  supabase: SupabaseClient<Database> | null,
  id: string,
  now: Date = new Date()
): Promise<AdminTeamMutationResult> {
  return transitionTeamMember(supabase, id, "published", now.toISOString());
}

export async function unpublishTeamMember(
  supabase: SupabaseClient<Database> | null,
  id: string
): Promise<AdminTeamMutationResult> {
  return transitionTeamMember(supabase, id, "draft", null);
}

async function transitionTeamMember(
  supabase: SupabaseClient<Database> | null,
  id: string,
  status: TeamMemberStatus,
  publishedAt: string | null
): Promise<AdminTeamMutationResult> {
  if (!supabase) return failure("unavailable");

  const { error } = await supabase.rpc(TRANSITION_TEAM_MEMBER_RPC, {
    p_id: id,
    p_status: status,
    p_published_at: publishedAt as unknown as string
  });

  return error ? failure("failed", error.message) : { ok: true };
}

/**
 * Postgres errors that are safe to retry for a *complete desired order* call:
 *   - 23505 — the deferred unique sort_order constraint lost a commit race with
 *     another reorder/create;
 *   - 40P01 — deadlock detected while two reorders touched overlapping rows.
 *
 * The retry re-sends the same desired id sequence rather than "resuming": the
 * operation is an idempotent overwrite, so a second attempt cannot compound a
 * partial first attempt (the RPC is one transaction and rolls back on error).
 */
const RETRYABLE_REORDER_CODES: ReadonlySet<string> = new Set([
  "23505",
  "40P01"
]);

/**
 * Persists a complete desired order. The RPC writes dense 1..n positions in
 * one transaction, so a failure cannot leave two members on the same position.
 *
 * Concurrency model (architector FU3, deliberately bounded):
 *   - Last writer wins. Two administrators who reorder at the same time both
 *     send their own complete list; whichever transaction commits last defines
 *     the final 1..n sequence. There is no optimistic version column and no
 *     merge attempt, because the product has one editorial order and inventing
 *     a three-way merge would be false precision.
 *   - Contention is surfaced as 23505 (deferred unique index at commit) or
 *     40P01 (deadlock), never as silent duplicate positions. Those two codes
 *     get exactly ONE immediate retry with the same desired order. Any other
 *     error (including a lost grant) fails loudly and writes nothing.
 *   - A wider retry policy (backoff, cross-feature rollout) is deferred; see
 *     the T-028 ticket Log. Only the team-reorder path retries in V1.
 */
export async function reorderTeamMembers(
  supabase: SupabaseClient<Database> | null,
  ids: readonly string[]
): Promise<AdminTeamMutationResult> {
  if (!supabase) return failure("unavailable");

  const args = { p_ids: [...ids] };
  const first = await supabase.rpc(REORDER_TEAM_MEMBERS_RPC, args);

  if (!first.error) return { ok: true };

  const code = first.error.code;
  if (code === undefined || !RETRYABLE_REORDER_CODES.has(code)) {
    return failure("failed", first.error.message);
  }

  const retry = await supabase.rpc(REORDER_TEAM_MEMBERS_RPC, args);
  return retry.error ? failure("failed", retry.error.message) : { ok: true };
}

/**
 * Deletes the root row; translations cascade (T-012). The portrait object is
 * removed best-effort first — a storage failure must not prevent the admin
 * from deleting the member, and the database reference disappears with the row.
 */
export async function deleteTeamMember(
  supabase: SupabaseClient<Database> | null,
  id: string,
  portraitPath: string | null = null
): Promise<AdminTeamMutationResult> {
  if (!supabase) return failure("unavailable");

  if (portraitPath) {
    await removeTeamPortrait(supabase, portraitPath);
  }

  const { error } = await supabase.from("team_members").delete().eq("id", id);

  return error ? failure("failed", error.message) : { ok: true };
}

/**
 * Validates and uploads a portrait through the T-014 gate.
 *
 * The shared validator rejects active content (SVG/HTML/JS), oversize files and
 * name/MIME mismatches; this wrapper narrows it to images because portraits are
 * rendered as `<img>`. The bucket policy remains the server-side authority.
 */
export async function uploadTeamPortrait(
  supabase: SupabaseClient<Database> | null,
  file: File & UploadFileLike,
  existingNames: readonly string[] = []
): Promise<{ readonly ok: true; readonly path: string } | AdminTeamFailure> {
  if (!supabase) return failure("unavailable");

  const validation = validateUpload(file, { existingNames });
  if (!validation.ok) {
    return failure("failed", validation.code);
  }
  if (!validation.mimeType.startsWith(PORTRAIT_MIME_PREFIX)) {
    return failure("failed", "not-an-image");
  }

  const path = `team/${validation.fileName}`;
  const { error } = await supabase.storage
    .from(TEAM_PORTRAIT_BUCKET)
    .upload(path, file, { upsert: false, contentType: validation.mimeType });

  if (error) return failure("failed", error.message);

  return { ok: true, path };
}

/**
 * Removes the stored object. Callers clear the database reference regardless of
 * this outcome, which satisfies "portrait removal cleans the reference" even
 * when the storage call is refused (for example a team editor without
 * `media:write`).
 */
export async function removeTeamPortrait(
  supabase: SupabaseClient<Database> | null,
  path: string
): Promise<AdminTeamMutationResult> {
  if (!supabase) return failure("unavailable");

  const { error } = await supabase.storage
    .from(TEAM_PORTRAIT_BUCKET)
    .remove([path]);

  return error ? failure("failed", error.message) : { ok: true };
}

/**
 * Convenience for the reorder buttons: applies the pure position maths then
 * persists the complete order. The page still awaits and re-reads; no
 * optimistic list state.
 */
export async function moveTeamMember(
  supabase: SupabaseClient<Database> | null,
  ids: readonly string[],
  id: string,
  direction: TeamMoveDirection
): Promise<
  { readonly ok: true; readonly ids: readonly string[] } | AdminTeamFailure
> {
  if (!supabase) return failure("unavailable");

  const next = moveInOrder(ids, id, direction);
  const result = await reorderTeamMembers(supabase, next);
  return result.ok ? { ok: true, ids: next } : result;
}
