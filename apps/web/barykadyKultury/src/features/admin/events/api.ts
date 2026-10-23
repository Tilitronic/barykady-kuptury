import type { SupabaseClient } from "@supabase/supabase-js";

import { DEFAULT_LOCALE, type Locale } from "@/features/i18n/locales";
import type { Database } from "@/types/database.types";

/**
 * T-031 — the ONLY write path for event↔project mappings.
 *
 * Design authority:
 *   - docs/architecture.md §4: `calendar_event_links` is keyed by
 *     `(calendar_id, google_event_id)`, never by title/date, and `project_id`
 *     is nullable with `ON DELETE SET NULL`. One row means zero or one project.
 *   - docs/architecture.md §6.1: `events:write` gates this table; the admin
 *     page is a UX gate only and RLS enforces independently.
 *   - docs/PRODUCT_REQUIREMENTS.md §6 (Events): the association is managed in
 *     the admin panel, separately from Google Calendar. V1 has NO calendar
 *     write capability — this module never talks to Google, only to Supabase.
 *
 * Idempotency: assigning is a single-row `upsert` with the database's UNIQUE
 * `(calendar_id, google_event_id)` constraint as the conflict target. PostgREST
 * emits one `ON CONFLICT ... DO UPDATE`, which is race-safe for a single row,
 * so no RPC/transaction is needed (it would add a T-045-style function for no
 * multi-table invariant). Unassigning is a targeted `UPDATE` to NULL, which
 * keeps the row and therefore the event's stable identity.
 */

type EventLinkRow = Database["public"]["Tables"]["calendar_event_links"]["Row"];
type ProjectStatus = Database["public"]["Enums"]["content_status"];
type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
type ProjectTranslationRow =
  Database["public"]["Tables"]["project_translations"]["Row"];

export interface AdminEventLink {
  readonly calendarId: string;
  readonly googleEventId: string;
  readonly projectId: string | null;
  readonly updatedAt: string;
}

export interface AdminEventIdentity {
  readonly calendarId: string;
  readonly googleEventId: string;
}

/** A project the selector may offer. Drafts are intentionally included. */
export interface AdminProjectOption {
  readonly id: string;
  readonly slug: string;
  readonly status: ProjectStatus;
  /** English title (the admin's stable identifier) or the canonical slug. */
  readonly title: string;
  /** Titles used by the public-link policy (draft detection is by status). */
  readonly translations: readonly {
    readonly locale: Locale;
    readonly title: string;
  }[];
}

export type AdminEventFailureCode =
  | "unavailable"
  | "project-missing"
  | "failed";

export interface AdminEventFailure {
  readonly ok: false;
  readonly code: AdminEventFailureCode;
  /** Stable diagnostic only — never rendered raw to the user. */
  readonly message?: string;
}

export type AdminEventLinksResult =
  | { readonly ok: true; readonly links: readonly AdminEventLink[] }
  | AdminEventFailure;

export type AdminProjectOptionsResult =
  | { readonly ok: true; readonly projects: readonly AdminProjectOption[] }
  | AdminEventFailure;

export type AdminEventMutationResult =
  | { readonly ok: true }
  | AdminEventFailure;

const ADMIN_EVENT_LINK_SELECT =
  "calendar_id, google_event_id, project_id, updated_at";

const ADMIN_PROJECT_OPTION_SELECT =
  "id, slug, status, updated_at, project_translations(locale, title, summary, body)";

/** PostgreSQL foreign-key violation (the project was removed elsewhere). */
const FOREIGN_KEY_VIOLATION = "23503";

/** The composite identity the database declares UNIQUE (architecture §4). */
export const EVENT_LINK_CONFLICT_TARGET =
  "calendar_id,google_event_id" as const;

interface ProjectOptionRow extends Pick<ProjectRow, "id" | "slug" | "status"> {
  readonly project_translations: readonly ProjectTranslationRow[];
}

function failure(
  code: AdminEventFailureCode,
  message?: string
): AdminEventFailure {
  return message === undefined
    ? { ok: false, code }
    : { ok: false, code, message };
}

function mapLink(row: EventLinkRow): AdminEventLink {
  return {
    calendarId: row.calendar_id,
    googleEventId: row.google_event_id,
    projectId: row.project_id,
    updatedAt: row.updated_at
  };
}

/** English title first, canonical slug second (mirrors the projects list). */
function optionTitle(
  row: ProjectOptionRow,
  translations: readonly ProjectTranslationRow[]
): string {
  const english = translations.find(
    translation => translation.locale === DEFAULT_LOCALE
  );

  return english?.title || row.slug;
}

export function mapProjectOption(row: ProjectOptionRow): AdminProjectOption {
  return {
    id: row.id,
    slug: row.slug,
    status: row.status,
    title: optionTitle(row, row.project_translations),
    translations: row.project_translations.map(translation => ({
      locale: translation.locale,
      title: translation.title
    }))
  };
}

/**
 * Every mapping row the signed-in admin may read, including rows whose project
 * is NULL. This read is what keeps the mapping list usable when the calendar
 * function is down: the page still has the event identities and their links.
 */
export async function fetchAdminEventLinks(
  supabase: SupabaseClient<Database> | null
): Promise<AdminEventLinksResult> {
  if (!supabase) return failure("unavailable");

  const { data, error } = await supabase
    .from("calendar_event_links")
    .select(ADMIN_EVENT_LINK_SELECT)
    .order("updated_at", { ascending: false })
    .overrideTypes<EventLinkRow[], { merge: false }>();

  if (error) return failure("failed", error.message);

  return { ok: true, links: (data ?? []).map(mapLink) };
}

/**
 * Projects the selector may offer.
 *
 * RLS, not this query, decides visibility: a root or `projects:write` editor
 * sees drafts; an `events:write`-only editor sees published projects (the
 * public SELECT predicate). The admin never weakens that boundary to show a
 * draft — the mapping itself still permits a draft project ID if the data is
 * otherwise readable, and the public-link policy refuses to expose it.
 */
export async function fetchAssignableProjects(
  supabase: SupabaseClient<Database> | null
): Promise<AdminProjectOptionsResult> {
  if (!supabase) return failure("unavailable");

  const { data, error } = await supabase
    .from("projects")
    .select(ADMIN_PROJECT_OPTION_SELECT)
    .order("updated_at", { ascending: false })
    .overrideTypes<ProjectOptionRow[], { merge: false }>();

  if (error) return failure("failed", error.message);

  return { ok: true, projects: (data ?? []).map(mapProjectOption) };
}

/**
 * Assigns (or reassigns) an event's project. Repeating the same assignment is
 * a no-op update on the same row, never a second mapping row.
 */
export async function assignEventProject(
  supabase: SupabaseClient<Database> | null,
  identity: AdminEventIdentity & { readonly projectId: string }
): Promise<AdminEventMutationResult> {
  if (!supabase) return failure("unavailable");

  const { error } = await supabase.from("calendar_event_links").upsert(
    {
      calendar_id: identity.calendarId,
      google_event_id: identity.googleEventId,
      project_id: identity.projectId
    },
    { onConflict: EVENT_LINK_CONFLICT_TARGET }
  );

  if (error) {
    // The selector can be stale when a project is deleted in another tab.
    // The FK is the authority; report a recoverable code, not a generic error.
    return error.code === FOREIGN_KEY_VIOLATION
      ? failure("project-missing")
      : failure("failed", error.message);
  }

  return { ok: true };
}

/** Removes the project association while keeping the mapping row (NULL). */
export async function unassignEventProject(
  supabase: SupabaseClient<Database> | null,
  identity: AdminEventIdentity
): Promise<AdminEventMutationResult> {
  if (!supabase) return failure("unavailable");

  const { error } = await supabase
    .from("calendar_event_links")
    .update({ project_id: null })
    .eq("calendar_id", identity.calendarId)
    .eq("google_event_id", identity.googleEventId);

  return error ? failure("failed", error.message) : { ok: true };
}
