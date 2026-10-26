import type { SupabaseClient } from "@supabase/supabase-js";

import { SUPPORTED_LOCALES, type Locale } from "@/features/i18n/locales";
import type { Database } from "@/types/database.types";

import {
  buildCoverageReport,
  type CoverageReport,
  type CoverageSourceItem,
  type CoverageSources,
  type CoverageTranslation
} from "./coverage";

/**
 * T-031 — translation-coverage data access.
 *
 * Five independent admin reads feed one report. The queries are deliberately
 * separate (one per entity) rather than a database view: RLS already scopes
 * each table by its own capability, and reusing the existing SELECT policies
 * keeps coverage from becoming a second, weaker authorization path
 * (docs/architecture.md §6.1). Reads are ordinary published/translation rows —
 * no writes, no Calendar access.
 *
 * All-or-nothing failure is intentional: a matrix that silently omits one
 * entity would tell an administrator their translations are complete when the
 * check never ran.
 */

type ProjectStatus = Database["public"]["Enums"]["content_status"];

interface TranslationRow {
  readonly locale: Locale;
  readonly needs_review: boolean;
}

interface PageTranslationRow extends TranslationRow {
  readonly title: string;
  readonly body: string | null;
}

interface ProjectTranslationRow extends TranslationRow {
  readonly title: string;
  readonly summary: string | null;
  readonly body: string | null;
}

interface TeamTranslationRow extends TranslationRow {
  readonly role: string | null;
  readonly bio: string | null;
}

interface PublicationTranslationRow extends TranslationRow {
  readonly slug: string;
  readonly title: string;
}

interface DocumentTranslationRow extends TranslationRow {
  readonly slug: string;
  readonly title: string;
}

interface PageCoverageRow {
  readonly id: string;
  readonly page_key: string;
  readonly status: ProjectStatus;
  readonly site_page_translations: readonly PageTranslationRow[];
}

interface ProjectCoverageRow {
  readonly id: string;
  readonly slug: string;
  readonly status: ProjectStatus;
  readonly project_translations: readonly ProjectTranslationRow[];
}

interface TeamCoverageRow {
  readonly id: string;
  readonly name: string;
  readonly status: ProjectStatus;
  readonly team_member_translations: readonly TeamTranslationRow[];
}

interface PublicationCoverageRow {
  readonly id: string;
  readonly status: ProjectStatus;
  readonly publication_translations: readonly PublicationTranslationRow[];
}

interface DocumentCoverageRow {
  readonly id: string;
  readonly status: ProjectStatus;
  readonly organization_document_translations: readonly DocumentTranslationRow[];
}

export type AdminCoverageResult =
  | { readonly ok: true; readonly report: CoverageReport }
  | {
      readonly ok: false;
      readonly code: "unavailable" | "failed";
      readonly message?: string;
    };

const PAGE_SELECT =
  "id, page_key, status, site_page_translations(locale, title, body, needs_review)";
const PROJECT_SELECT =
  "id, slug, status, project_translations(locale, title, summary, body, needs_review)";
const TEAM_SELECT =
  "id, name, status, team_member_translations(locale, role, bio, needs_review)";
const PUBLICATION_SELECT =
  "id, status, publication_translations(locale, slug, title, needs_review)";
const DOCUMENT_SELECT =
  "id, status, organization_document_translations(locale, slug, title, needs_review)";

function nonBlank(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/** Normalizes a raw translation row into the pure `complete` flag. */
function toTranslation(
  row: TranslationRow,
  requiredFields: readonly boolean[]
): CoverageTranslation {
  return {
    locale: row.locale,
    needsReview: row.needs_review,
    complete: requiredFields.every(Boolean)
  };
}

/** English label first; any translation label second; the identity last. */
function preferredLabel(
  translations: readonly { locale: Locale; title: string }[],
  fallback: string
): string {
  const english = translations.find(translation => translation.locale === "en");

  return english?.title || translations[0]?.title || fallback;
}

function pageItem(row: PageCoverageRow): CoverageSourceItem {
  return {
    id: row.id,
    label: row.page_key,
    status: row.status,
    translations: row.site_page_translations.map(translation =>
      toTranslation(translation, [
        nonBlank(translation.title),
        nonBlank(translation.body)
      ])
    )
  };
}

function projectItem(row: ProjectCoverageRow): CoverageSourceItem {
  return {
    id: row.id,
    label: preferredLabel(row.project_translations, row.slug),
    status: row.status,
    translations: row.project_translations.map(translation =>
      toTranslation(translation, [
        nonBlank(translation.title),
        nonBlank(translation.summary),
        nonBlank(translation.body)
      ])
    )
  };
}

function teamItem(row: TeamCoverageRow): CoverageSourceItem {
  return {
    id: row.id,
    // `name` is locale-independent on the root row (architecture §4).
    label: row.name,
    status: row.status,
    translations: row.team_member_translations.map(translation =>
      // Role and bio are both optional: a present row is already complete.
      toTranslation(translation, [])
    )
  };
}

function publicationItem(row: PublicationCoverageRow): CoverageSourceItem {
  return {
    id: row.id,
    label: preferredLabel(row.publication_translations, row.id),
    status: row.status,
    translations: row.publication_translations.map(translation =>
      // Only the title is required; abstract/authors are optional (T-020).
      toTranslation(translation, [nonBlank(translation.title)])
    )
  };
}

function documentItem(row: DocumentCoverageRow): CoverageSourceItem {
  return {
    id: row.id,
    label: preferredLabel(row.organization_document_translations, row.id),
    status: row.status,
    translations: row.organization_document_translations.map(translation =>
      // Document listability requires only a title (T-029/T-017).
      toTranslation(translation, [nonBlank(translation.title)])
    )
  };
}

/**
 * Reads every entity and builds the matrix. `SUPPORTED_LOCALES` is read here so
 * an added locale automatically appears in the report rather than needing a
 * page change.
 */
export async function fetchAdminCoverage(
  supabase: SupabaseClient<Database> | null
): Promise<AdminCoverageResult> {
  if (!supabase) return { ok: false, code: "unavailable" };

  const [pages, projects, team, publications, documents] = await Promise.all([
    supabase
      .from("site_pages")
      .select(PAGE_SELECT)
      .order("sort_order", { ascending: true })
      .overrideTypes<PageCoverageRow[], { merge: false }>(),
    supabase
      .from("projects")
      .select(PROJECT_SELECT)
      .order("updated_at", { ascending: false })
      .overrideTypes<ProjectCoverageRow[], { merge: false }>(),
    supabase
      .from("team_members")
      .select(TEAM_SELECT)
      .order("sort_order", { ascending: true })
      .overrideTypes<TeamCoverageRow[], { merge: false }>(),
    supabase
      .from("publications")
      .select(PUBLICATION_SELECT)
      .order("sort_order", { ascending: true })
      .overrideTypes<PublicationCoverageRow[], { merge: false }>(),
    supabase
      .from("organization_documents")
      .select(DOCUMENT_SELECT)
      .order("sort_order", { ascending: true })
      .overrideTypes<DocumentCoverageRow[], { merge: false }>()
  ]);

  const firstError =
    pages.error ??
    projects.error ??
    team.error ??
    publications.error ??
    documents.error;

  if (firstError) {
    return { ok: false, code: "failed", message: firstError.message };
  }

  const sources: CoverageSources = {
    pages: (pages.data ?? []).map(pageItem),
    projects: (projects.data ?? []).map(projectItem),
    team: (team.data ?? []).map(teamItem),
    publications: (publications.data ?? []).map(publicationItem),
    documents: (documents.data ?? []).map(documentItem)
  };

  return { ok: true, report: buildCoverageReport(sources) };
}

/** Exported for the page's locale header; derived from the locale contract. */
export const COVERAGE_LOCALES: readonly Locale[] = SUPPORTED_LOCALES;
