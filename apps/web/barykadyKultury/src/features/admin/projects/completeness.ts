import {
  formatCompletenessLabel as formatSharedCompletenessLabel,
  type CompletenessLabelKeys,
  type CompletenessTranslate,
  type LocaleCompleteness
} from "@/features/admin/shared/completeness";

/**
 * T-027 project-specific completeness seam.
 *
 * T-028 gate fix (FU1): the branch, the verdict type and the field-label
 * mapping moved to the neutral `features/admin/shared/completeness` module.
 * This file is now only the project catalogue adapter, so T-027 callers and
 * tests keep their exact public behaviour without owning shared logic.
 */
export type {
  CompletenessLabelKeys,
  CompletenessTranslate,
  LocaleCompleteness
};

export const PROJECT_COMPLETENESS_LABELS: CompletenessLabelKeys = {
  complete: "admin.projects.completeness.complete",
  notStarted: "admin.projects.completeness.notStarted",
  missing: "admin.projects.completeness.missing",
  field: field => `admin.projects.translation.${field}`
};

/** Renders the project-namespace verdict (behaviour unchanged from T-027). */
export function formatCompletenessLabel(
  entry: LocaleCompleteness,
  t: CompletenessTranslate
): string {
  return formatSharedCompletenessLabel(entry, t, PROJECT_COMPLETENESS_LABELS);
}
