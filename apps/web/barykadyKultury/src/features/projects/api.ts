import type { SupabaseClient } from "@supabase/supabase-js";

import type { Locale } from "@/features/i18n/locales";
import { selectTranslation } from "@/shared/content/selectTranslation";
import {
  fromRows,
  unavailable,
  type ContentResult
} from "@/shared/content/result";
import type { Database } from "@/types/database.types";

/**
 * Projects data access (T-015).
 *
 * Only this module builds project queries (docs/architecture.md §3: "keep
 * components thin and test business/data logic outside page components"). It
 * returns domain models, never raw rows, and the client is injected so
 * `api.test.ts` can use a typed fake with no network.
 */

type ProjectStatus = Database["public"]["Enums"]["content_status"];

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
type ProjectTranslationRow =
  Database["public"]["Tables"]["project_translations"]["Row"];

/** A project row with its embedded translations, as selected below. */
export interface ProjectRowWithTranslations extends ProjectRow {
  readonly project_translations: readonly ProjectTranslationRow[];
}

/** Locale-independent project metadata plus one locale-resolved translation. */
export interface ProjectSummary {
  readonly id: string;
  readonly status: ProjectStatus;
  readonly slug: string;
  readonly title: string;
  readonly summary: string | null;
  readonly body: string | null;
  readonly isFallback: boolean;
  readonly featuredRank: number | null;
  readonly coverPath: string | null;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly updatedAt: string;
}

/**
 * A project translation is complete when the fields a card and a detail page
 * need are present. T-027 enforces the same rule on publish; the seed rows for
 * the published fixture satisfy it in all three locales.
 */
export const PROJECT_REQUIRED_FIELDS = [
  "title",
  "summary",
  "body"
] as const satisfies readonly (keyof ProjectTranslationRow)[];

const PROJECT_SELECT =
  "id, status, featured_rank, cover_path, start_date, end_date, updated_at, project_translations(locale, slug, title, summary, body)";

/** Maps one joined row to a domain model, or `null` when it has no usable text. */
export function mapProject(
  row: ProjectRowWithTranslations,
  locale: Locale
): ProjectSummary | null {
  const selected = selectTranslation(
    { status: row.status, translations: row.project_translations },
    locale,
    { requiredFields: PROJECT_REQUIRED_FIELDS }
  );

  if (!selected) return null;

  const translation = selected.value;

  return {
    id: row.id,
    status: row.status,
    slug: translation.slug,
    title: translation.title,
    summary: translation.summary,
    body: translation.body,
    isFallback: selected.isFallback,
    featuredRank: row.featured_rank,
    coverPath: row.cover_path,
    startDate: row.start_date,
    endDate: row.end_date,
    updatedAt: row.updated_at
  };
}

/** Published projects for a locale (newest-updated first), or an explicit state. */
export async function fetchPublishedProjects(
  supabase: SupabaseClient<Database> | null,
  locale: Locale
): Promise<ContentResult<ProjectSummary>> {
  if (!supabase) return unavailable();

  const rows = await fetchPublishedProjectRows(supabase);
  if (rows.kind !== "ok") return rows;

  return fromRows(rows.items, row => mapProject(row, locale));
}

/**
 * Finds the published project whose OWN locale carries `slug`.
 *
 * T-019 slug rule (docs/tickets/T-019-projects-public.md line 16): resolution
 * is STRICT on (locale, slug) — an English fallback slug must never resolve a
 * Polish URL, and no pl↔uk substitution exists. A draft row is rejected here
 * even if a misconfigured payload leaks it (docs/PRODUCT_REQUIREMENTS.md §8):
 * RLS is the real boundary (proven in `rls_content_matrix_test.sql`), this is
 * the app-layer complement so no draft content can render or link.
 */
export function findProjectBySlug(
  rows: readonly ProjectRowWithTranslations[],
  slug: string,
  locale: Locale
): ProjectRowWithTranslations | null {
  return (
    rows.find(
      row =>
        row.status === "published" &&
        row.project_translations.some(
          translation =>
            translation.locale === locale && translation.slug === slug
        )
    ) ?? null
  );
}

/**
 * The published project reachable at `slug` for the requested locale.
 *
 * Slug resolution happens in process against the published rows because
 * embedded-resource filtering cannot both select the parent by a translation
 * column and return all of its translations in one PostgREST request (same
 * seam the T-017 document reader uses; the public project set is small).
 * An empty result means "no such public page" — the page renders 404 content,
 * never a cross-locale fallback (AGENTS.md rule 7: no extra query round-trips).
 */
export async function fetchPublishedProjectBySlug(
  supabase: SupabaseClient<Database> | null,
  slug: string,
  locale: Locale
): Promise<ContentResult<ProjectSummary>> {
  if (!supabase) return unavailable();

  const rows = await fetchPublishedProjectRows(supabase);
  if (rows.kind !== "ok") return rows;

  const row = findProjectBySlug(rows.items, slug, locale);
  if (!row) return { kind: "empty" };

  const project = mapProject(row, locale);
  return project ? { kind: "ok", items: [project] } : { kind: "empty" };
}

/** Shared published-rows query for the listing and the by-slug detail read. */
async function fetchPublishedProjectRows(
  supabase: SupabaseClient<Database>
): Promise<ContentResult<ProjectRowWithTranslations>> {
  const query = supabase.from("projects");
  const { data, error } = await query
    .select(PROJECT_SELECT)
    .eq("status", "published")
    .order("updated_at", { ascending: false })
    .overrideTypes<ProjectRowWithTranslations[], { merge: false }>();

  if (error) return unavailable();

  return fromRows(data ?? [], row => row);
}
