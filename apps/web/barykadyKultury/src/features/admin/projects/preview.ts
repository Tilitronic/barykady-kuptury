import type { AdminProject } from "./api";
import { SUPPORTED_LOCALES, type Locale } from "@/features/i18n/locales";
import { selectProjectDetailTranslation } from "@/features/projects/api";
import type { ProjectSummaryView } from "@/features/projects/useProjects";

/**
 * T-027 review finding #1 — the admin preview must resolve a translation with
 * the SAME policy as the public detail page.
 *
 * The preview previously picked a locale with a title-only heuristic, so a
 * translation that merely had a title previewed as "the project" even though
 * the public detail page would fall back to English (or 404) because
 * `PROJECT_REQUIRED_FIELDS` also require summary and body
 * (docs/architecture.md §4). That broke T-027's core promise: "preview renders
 * the public detail component".
 *
 * This mapper delegates to the shared `selectProjectDetailTranslation`, so the
 * completeness rule and the English-fallback precedence are literally the same
 * code the public mapper (`mapProjectDetail`) runs.
 */

/**
 * Resolves a project to the public detail view-model for the preview.
 *
 * @param source - the admin project (every locale row, possibly incomplete).
 * @param locale - the locale the preview URL asks for.
 * @param coverUrl - the already-resolved cover URL (the page owns the client).
 * @returns the view-model the public detail component renders, or `null` when
 *   no translation is complete in any locale (the public page would 404).
 */
export function resolvePreviewProject(
  source: AdminProject,
  locale: Locale,
  coverUrl: string | null
): ProjectSummaryView | null {
  const selected = selectProjectDetailTranslation(
    {
      // The public read narrows to published rows; the admin preview must
      // resolve drafts (that is its purpose) and the route is admin-guarded,
      // so the published gate is deliberately not applied. Completeness and
      // fallback are still the shared policy.
      status: null,
      translations: SUPPORTED_LOCALES.map(candidate => ({
        locale: candidate,
        ...source.translations[candidate]
      }))
    },
    locale
  );

  if (!selected) return null;

  return {
    id: source.id,
    status: source.status,
    slug: source.slug,
    title: selected.value.title,
    summary: selected.value.summary,
    body: selected.value.body,
    isFallback: selected.isFallback,
    featuredRank: source.featuredRank,
    coverPath: source.coverPath,
    startDate: source.startDate,
    endDate: source.endDate,
    updatedAt: source.updatedAt,
    coverUrl
  };
}
