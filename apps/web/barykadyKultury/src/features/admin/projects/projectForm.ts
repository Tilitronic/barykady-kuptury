import type { LocaleCompleteness } from "@/features/admin/shared/completeness";
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type Locale
} from "@/features/i18n/locales";

/**
 * Re-exported for existing T-027 callers/tests. The type itself lives in the
 * neutral `features/admin/shared` module (T-028 gate fix, FU1).
 */
export type { LocaleCompleteness };

/**
 * T-027 — pure project form model.
 *
 * Design authority:
 *   - docs/PRODUCT_REQUIREMENTS.md §6: administrators create/edit/preview/
 *     publish/unpublish/archive projects, and see which locales are complete.
 *   - docs/PRODUCT_REQUIREMENTS.md §4-projects: drafts are never exposed;
 *     title/summary/body/status/dates/cover are the project fields.
 *   - docs/architecture.md §4: root rows hold lifecycle metadata; translations
 *     hold localized text, and only complete translations are presented.
 *   - docs/tickets/DECISIONS.md D-24 + T-038: ONE canonical slug per project,
 *     shared by all locales, editorial and stable — never derived from a title.
 *   - docs/tickets/T-027-admin-projects.md: publication requires a fallback
 *     (English) title + summary; drafts may be incomplete.
 *
 * Keeping the rules here (instead of in the page) means the same matrix is
 * proven without mounting a component, and the page can only *render* verdicts.
 */

/** Slug contract from `projects_slug_check` (T-038 migration). */
export const PROJECT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type ProjectStatus = "draft" | "published" | "archived";

export type TranslationField = "title" | "summary" | "body";

export interface TranslationDraft {
  title: string;
  summary: string;
  body: string;
}

export interface ProjectFormValues {
  /** Canonical root slug (D-24). Editorial: never auto-generated from title. */
  slug: string;
  status: ProjectStatus;
  featured: boolean;
  /** `YYYY-MM-DD` from an `<input type="date">`; empty string = unset. */
  startDate: string;
  /** `YYYY-MM-DD`; empty string = open-ended. */
  endDate: string;
  /** Storage object path (never a URL), or null. */
  coverPath: string | null;
  translations: Record<Locale, TranslationDraft>;
}

export type SlugError = "required" | "format" | "duplicate";

export type TranslationError = Partial<Record<TranslationField, "required">>;

export interface ProjectFormErrors {
  slug: SlugError | null;
  startDate: "invalid" | null;
  endDate: "before-start" | null;
  translations: Partial<Record<Locale, TranslationError>>;
  /** Why publishing is blocked as a whole (localized by the page). */
  publish: "fallback-incomplete" | null;
}

export interface ValidateProjectOptions {
  /**
   * `publish` applies the release gate (fallback title + summary); `draft`
   * only applies the rules that make a row storable at all.
   */
  readonly mode: "draft" | "publish";
  /** Rows already in the database, used for the D-24 global uniqueness rule. */
  readonly existingSlugs?: readonly {
    readonly id: string;
    readonly slug: string;
  }[];
  /** The project being edited (its own slug is not a conflict). */
  readonly currentProjectId?: string | null;
}

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

export function emptyTranslation(): TranslationDraft {
  return { title: "", summary: "", body: "" };
}

/** A blank form: draft, not featured, no dates/cover, no translations. */
export function emptyProjectForm(): ProjectFormValues {
  return {
    slug: "",
    status: "draft",
    featured: false,
    startDate: "",
    endDate: "",
    coverPath: null,
    translations: Object.fromEntries(
      SUPPORTED_LOCALES.map(locale => [locale, emptyTranslation()])
    ) as Record<Locale, TranslationDraft>
  };
}

/**
 * Per-locale completeness for the admin indicator (T-027; T-031 reuses it).
 *
 * "Complete" means every field the public detail page needs (title, summary,
 * body — the same list as `PROJECT_REQUIRED_FIELDS` in the public data layer).
 * `hasContent` distinguishes "not started" from "started but incomplete".
 */
export function translationCompleteness(values: {
  readonly translations: Record<Locale, TranslationDraft>;
}): LocaleCompleteness[] {
  return SUPPORTED_LOCALES.map(locale => {
    const translation = values.translations[locale];
    const missing: TranslationField[] = [];

    if (isBlank(translation.title)) missing.push("title");
    if (isBlank(translation.summary)) missing.push("summary");
    if (isBlank(translation.body)) missing.push("body");

    return {
      locale,
      complete: missing.length === 0,
      hasContent:
        !isBlank(translation.title) ||
        !isBlank(translation.summary) ||
        !isBlank(translation.body),
      missing
    };
  });
}

/** True when the locale is usable on the public detail page. */
export function isLocaleComplete(
  values: { readonly translations: Record<Locale, TranslationDraft> },
  locale: Locale
): boolean {
  return (
    translationCompleteness(values).find(entry => entry.locale === locale)
      ?.complete ?? false
  );
}

/** `YYYY-MM-DD` (or empty). Anything else cannot be stored as a `date`. */
function isValidDateInput(value: string): boolean {
  if (isBlank(value)) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  return !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

/**
 * The validation matrix. Returns every problem at once so the form can
 * associate messages with fields (DESIGN_SYSTEM.md §6) instead of revealing
 * them one submission at a time.
 */
export function validateProjectForm(
  values: ProjectFormValues,
  options: ValidateProjectOptions
): ProjectFormErrors {
  const slug = values.slug.trim();

  let slugError: SlugError | null = null;
  if (slug === "") {
    slugError = "required";
  } else if (!PROJECT_SLUG_PATTERN.test(slug)) {
    slugError = "format";
  } else {
    const conflict = (options.existingSlugs ?? []).find(
      row => row.slug === slug && row.id !== options.currentProjectId
    );
    if (conflict) slugError = "duplicate";
  }

  const translations: Partial<Record<Locale, TranslationError>> = {};
  for (const locale of SUPPORTED_LOCALES) {
    const translation = values.translations[locale];
    const hasText =
      !isBlank(translation.title) ||
      !isBlank(translation.summary) ||
      !isBlank(translation.body);

    // `title` is NOT NULL on the translation table; carrying summary/body
    // without a title cannot be persisted, so it is a field error (not a
    // silent drop, which would lose the admin's text).
    if (hasText && isBlank(translation.title)) {
      translations[locale] = { title: "required" };
    }
  }

  const startDate = isValidDateInput(values.startDate) ? null : "invalid";
  const endDate =
    values.startDate !== "" &&
    values.endDate !== "" &&
    isValidDateInput(values.startDate) &&
    isValidDateInput(values.endDate) &&
    values.endDate < values.startDate
      ? "before-start"
      : null;

  let publish: ProjectFormErrors["publish"] = null;
  if (options.mode === "publish") {
    const fallback = values.translations[DEFAULT_LOCALE];
    if (isBlank(fallback.title) || isBlank(fallback.summary)) {
      publish = "fallback-incomplete";
      translations[DEFAULT_LOCALE] = {
        ...translations[DEFAULT_LOCALE],
        ...(isBlank(fallback.title) ? { title: "required" as const } : {}),
        ...(isBlank(fallback.summary) ? { summary: "required" as const } : {})
      };
    }
  }

  return {
    slug: slugError,
    startDate,
    endDate,
    translations,
    publish
  };
}

/** True when the matrix produced at least one blocking error. */
export function hasFormErrors(errors: ProjectFormErrors): boolean {
  return (
    errors.slug !== null ||
    errors.startDate !== null ||
    errors.endDate !== null ||
    errors.publish !== null ||
    Object.keys(errors.translations).length > 0
  );
}
