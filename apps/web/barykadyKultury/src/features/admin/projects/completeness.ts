import type { LocaleCompleteness } from "./projectForm";

/**
 * T-027 review finding #2 — one shared formatter for the admin translation
 * completeness indicator.
 *
 * The indicator appeared in both the project list and the editor, each with its
 * own copy of the same three-way branch, and each interpolated the raw database
 * field keys (`title, summary, body`) into user-facing copy. That is both a
 * duplication defect and an i18n defect (AGENTS.md rule 9: no user-facing string
 * may be hard-coded or untranslated).
 *
 * This module owns the branch AND the field-label mapping, so:
 *   - the two pages can only render the same verdict (no drift);
 *   - a missing field is named with its localized label
 *     (`admin.projects.translation.*`), never with the storage key.
 *
 * It is pure apart from the injected `t`, so it is unit-tested across all three
 * catalogues without mounting a component.
 */

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
 * Renders the localized completeness verdict for one locale entry.
 *
 * @param entry - the per-locale completeness report from `projectForm`.
 * @param t - the active translator.
 */
export function formatCompletenessLabel(
  entry: LocaleCompleteness,
  t: CompletenessTranslate
): string {
  if (entry.complete) {
    return t("admin.projects.completeness.complete");
  }

  if (!entry.hasContent) {
    return t("admin.projects.completeness.notStarted");
  }

  // Localized labels, not the raw keys the report carries.
  const fields = entry.missing
    .map(field => t(`admin.projects.translation.${field}`))
    .join(", ");

  return t("admin.projects.completeness.missing", { fields });
}
