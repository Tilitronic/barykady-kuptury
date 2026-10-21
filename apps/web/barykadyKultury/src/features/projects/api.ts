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

/** List rows select only the card fields; `body` stays on the detail query. */
type ProjectListTranslationRow = Pick<
  ProjectTranslationRow,
  "locale" | "title" | "summary"
>;

export interface ProjectListRowWithTranslations extends Omit<
  ProjectRowWithTranslations,
  "project_translations"
> {
  readonly project_translations: readonly ProjectListTranslationRow[];
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
/** Card/list completeness: title + summary (body is detail-only). */
export const PROJECT_LIST_REQUIRED_FIELDS = [
  "title",
  "summary"
] as const satisfies readonly (keyof ProjectListTranslationRow)[];

/** Detail completeness: the body is required to render the reader page. */
export const PROJECT_REQUIRED_FIELDS = [
  "title",
  "summary",
  "body"
] as const satisfies readonly (keyof ProjectTranslationRow)[];

const PROJECT_LIST_SELECT =
  "id, slug, status, featured_rank, cover_path, start_date, end_date, updated_at, project_translations(locale, title, summary)";

const PROJECT_DETAIL_SELECT =
  "id, slug, status, featured_rank, cover_path, start_date, end_date, updated_at, project_translations(locale, title, summary, body)";

function toSummary(
  row: ProjectRowWithTranslations | ProjectListRowWithTranslations,
  translation: ProjectListTranslationRow,
  body: string | null,
  isFallback: boolean
): ProjectSummary {
  return {
    id: row.id,
    status: row.status,
    slug: row.slug,
    title: translation.title,
    summary: translation.summary,
    body,
    isFallback,
    featuredRank: row.featured_rank,
    coverPath: row.cover_path,
    startDate: row.start_date,
    endDate: row.end_date,
    updatedAt: row.updated_at
  };
}

/**
 * Maps a lean list row (no body) to the card model. `body` is null because the
 * list deliberately does not fetch it; detail pages use `mapProjectDetail`.
 */
export function mapProject(
  row: ProjectListRowWithTranslations,
  locale: Locale
): ProjectSummary | null {
  const selected = selectTranslation(
    { status: row.status, translations: row.project_translations },
    locale,
    { requiredFields: PROJECT_LIST_REQUIRED_FIELDS }
  );

  return selected
    ? toSummary(row, selected.value, null, selected.isFallback)
    : null;
}

/** Maps a full detail row (with body) to the page model. */
export function mapProjectDetail(
  row: ProjectRowWithTranslations,
  locale: Locale
): ProjectSummary | null {
  const selected = selectTranslation(
    { status: row.status, translations: row.project_translations },
    locale,
    { requiredFields: PROJECT_REQUIRED_FIELDS }
  );

  return selected
    ? toSummary(row, selected.value, selected.value.body, selected.isFallback)
    : null;
}

/** Published projects for a locale (newest-updated first), or an explicit state. */
export async function fetchPublishedProjects(
  supabase: SupabaseClient<Database> | null,
  locale: Locale
): Promise<ContentResult<ProjectSummary>> {
  if (!supabase) return unavailable();

  const rows = await fetchPublishedProjectRows(supabase, PROJECT_LIST_SELECT);
  if (rows.kind !== "ok") return rows;

  return fromRows(rows.items, row => mapProject(row, locale));
}

/**
 * Finds the published project reachable at the canonical root `slug`.
 *
 * T-038/D-24: one slug is shared by every locale, so resolution only requires
 * the published row to carry that root slug AND to have a translation for the
 * requested locale. An English fallback slug can no longer resolve a Polish
 * URL because there is no per-locale slug. A draft row is rejected here even if
 * a misconfigured payload leaks it (docs/PRODUCT_REQUIREMENTS.md §8): RLS is
 * the real boundary (proven in `rls_content_matrix_test.sql`), this is the
 * app-layer complement so no draft content can render or link.
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
        row.slug === slug &&
        row.project_translations.some(
          translation => translation.locale === locale
        )
    ) ?? null
  );
}

/**
 * The published project reachable at the canonical `slug` for the locale.
 *
 * T-038/D-24 made the lookup trivial: the slug lives on the parent row, so the
 * query filters by it directly and still embeds every translation. `empty`
 * means "no such public page" — the page renders 404 content, never a
 * cross-locale fallback (AGENTS.md rule 7: no extra query round-trips).
 */
export async function fetchPublishedProjectBySlug(
  supabase: SupabaseClient<Database> | null,
  slug: string,
  locale: Locale
): Promise<ContentResult<ProjectSummary>> {
  if (!supabase) return unavailable();

  const rows = await fetchPublishedProjectRows(
    supabase,
    PROJECT_DETAIL_SELECT,
    slug
  );
  if (rows.kind !== "ok") return rows;

  const row = findProjectBySlug(rows.items, slug, locale);
  if (!row) return { kind: "empty" };

  const project = mapProjectDetail(row, locale);
  return project ? { kind: "ok", items: [project] } : { kind: "empty" };
}

/**
 * Shared published-rows query for the listing and the by-slug detail read.
 * `slug` narrows to the canonical root identity; the listing omits it.
 */
async function fetchPublishedProjectRows(
  supabase: SupabaseClient<Database>,
  select: string,
  slug?: string
): Promise<ContentResult<ProjectRowWithTranslations>> {
  let query = supabase
    .from("projects")
    .select(select)
    .eq("status", "published");

  if (slug !== undefined) query = query.eq("slug", slug);

  const { data, error } = await query
    .order("updated_at", { ascending: false })
    .overrideTypes<ProjectRowWithTranslations[], { merge: false }>();

  if (error) return unavailable();

  return fromRows(data ?? [], row => row);
}
