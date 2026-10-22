import type { Locale } from "@/features/i18n/locales";

/**
 * T-028 gate fix (reviewer Minor + architector FU1) — neutral translation
 * completeness seam for every admin editor.
 *
 * Why this module exists:
 *   The formatter and its verdict type originally lived under
 *   `features/admin/projects/`, which made site pages and team import a sibling
 *   feature's utility (a god-util-by-location smell). Completeness is an admin
 *   editing concept shared by projects, pages and team, not a project concept.
 *   The branch and the localized field-label mapping now live here; feature
 *   modules supply only their message-key namespace.
 *
 * Design authority:
 *   - docs/PRODUCT_REQUIREMENTS.md §6: administrators see which locales have
 *     published content and which translations are missing.
 *   - docs/DESIGN_SYSTEM.md §6: status is communicated by text, never colour
 *     alone; field-level feedback must be programmatically associated.
 *   - AGENTS.md rule 9: every user-facing string is localized en/pl/uk.
 */

/** A locale's completeness verdict, shared by every admin form model. */
export interface LocaleCompleteness {
  readonly locale: Locale;
  readonly complete: boolean;
  readonly hasContent: boolean;
  readonly missing: readonly ("title" | "summary" | "body")[];
}

/**
 * The minimal translate seam the formatter needs. Typed structurally rather
 * than as vue-i18n's `ComposerTranslation` so the feature module stays free of
 * i18n implementation types and both the app's `t` and a test i18n instance
 * satisfy it without casts.
 */
export type CompletenessTranslate = (
  key: string,
  named?: Record<string, unknown>
) => string;

/**
 * Message-key set supplied by the calling editor. Keeping the keys out of this
 * module is what makes the seam neutral: the shared code owns the three-way
 * branch, each feature owns its catalogue namespace.
 */
export interface CompletenessLabelKeys {
  readonly complete: string;
  readonly notStarted: string;
  readonly missing: string;
  readonly field: (field: LocaleCompleteness["missing"][number]) => string;
}

/**
 * Renders the localized completeness verdict for one locale entry.
 *
 * @param entry - the per-locale report from a feature form model.
 * @param t - the active translator.
 * @param labels - message keys for this editor (required: no feature namespace
 *   is privileged as a default).
 */
export function formatCompletenessLabel(
  entry: LocaleCompleteness,
  t: CompletenessTranslate,
  labels: CompletenessLabelKeys
): string {
  if (entry.complete) {
    return t(labels.complete);
  }

  if (!entry.hasContent) {
    return t(labels.notStarted);
  }

  // Localized labels, never the raw storage keys the report carries.
  const fields = entry.missing.map(field => t(labels.field(field))).join(", ");

  return t(labels.missing, { fields });
}
