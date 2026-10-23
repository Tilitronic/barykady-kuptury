import type { Locale } from "@/features/i18n/locales";
import { EVENT_LINK_REQUIRED_FIELDS } from "@/features/events/api";
import { projectPath } from "@/features/events/projectLink";
import { selectTranslation } from "@/shared/content/selectTranslation";

/**
 * T-031 — why an assigned project does or does not produce a public link.
 *
 * Design authority (docs/architecture.md §4): "The event link can point to a
 * draft project in the admin interface if useful, but public event output must
 * only include a project link when the linked project and the selected
 * translation are published and public."
 *
 * This module is the admin-facing explanation of the public rule. It
 * deliberately reuses the public data layer's required-field list and
 * `selectTranslation`, so the admin preview cannot drift from the public join
 * (`features/events/api.ts → mapEventProjectLink`). It returns a decision
 * instead of a bare link because the UI must explain a refusal: a silent
 * "no link" looks like a bug to an administrator who just assigned a draft.
 */

export type PublicLinkProjectStatus = "draft" | "published" | "archived";

export interface PublicLinkTranslation {
  readonly locale: Locale;
  readonly title: string;
}

/** The subset of a project the admin selector already has in memory. */
export interface PublicLinkProject {
  readonly slug: string;
  readonly status: PublicLinkProjectStatus;
  readonly translations: readonly PublicLinkTranslation[];
}

export type PublicLinkReason =
  | "published"
  | "unlinked"
  | "draft"
  | "archived"
  | "missing-translation";

export interface PublicLinkDecision {
  readonly public: boolean;
  readonly path: string | null;
  readonly reason: PublicLinkReason;
}

export function publicLinkPolicy(
  project: PublicLinkProject | null,
  locale: Locale
): PublicLinkDecision {
  if (!project) {
    return { public: false, path: null, reason: "unlinked" };
  }

  // Lifecycle is reported before translation completeness: a draft is not a
  // translation problem, and telling the editor to translate it would be
  // wrong advice.
  if (project.status !== "published") {
    return { public: false, path: null, reason: project.status };
  }

  const selected = selectTranslation(
    { status: project.status, translations: project.translations },
    locale,
    { requiredFields: EVENT_LINK_REQUIRED_FIELDS }
  );

  if (!selected) {
    return { public: false, path: null, reason: "missing-translation" };
  }

  return {
    public: true,
    path: projectPath(project.slug, selected.isFallback, locale),
    reason: "published"
  };
}
