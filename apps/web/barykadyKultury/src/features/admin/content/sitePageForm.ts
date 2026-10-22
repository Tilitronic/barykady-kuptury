import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type Locale
} from "@/features/i18n/locales";
import type { LocaleCompleteness } from "@/features/admin/shared/completeness";

/**
 * T-028 — pure site page form model.
 *
 * Design authority:
 *   - docs/PRODUCT_REQUIREMENTS.md §6: administrators edit organization
 *     information and see which locales have content and which translations
 *     are missing.
 *   - docs/PRODUCT_REQUIREMENTS.md §4-About: organization information must
 *     support all three locales; English is the identified fallback.
 *   - docs/architecture.md §4: root rows carry lifecycle/published_at, while
 *     `site_page_translations` holds one row per (page, locale). The slug was
 *     deliberately removed by T-038/D-24 — `site_pages.page_key` is the stable
 *     identity, so this form never edits a slug.
 *   - T-028 scope: pick an EXISTING page (no arbitrary page creation), edit
 *     title/body per locale, publish/unpublish and preview.
 *
 * Keeping the rules here means the same matrix is proven without mounting a
 * component, and the page can only render verdicts. Completeness reuses the
 * T-027 `LocaleCompleteness` shape so both admin editors share one formatter.
 */

export type SitePageStatus = "draft" | "published" | "archived";

export type SitePageField = "title" | "body";

export interface SitePageTranslationDraft {
  readonly title: string;
  readonly body: string;
  /**
   * Preserved but not edited in V1 (T-028 scope is title/body). Carrying it
   * through the form means a title/body save never silently erases an
   * administrator's existing meta description.
   */
  readonly metaDescription: string;
}

export interface SitePageFormValues {
  /** Root id. The editor can only update an existing page (T-028 scope). */
  readonly id: string;
  /** Stable logical identity (`about`, `home`, …); never editable. */
  readonly pageKey: string;
  readonly status: SitePageStatus;
  readonly translations: Record<Locale, SitePageTranslationDraft>;
}

export type SitePageTranslationError = Partial<
  Record<SitePageField, "required">
>;

export interface SitePageFormErrors {
  translations: Partial<Record<Locale, SitePageTranslationError>>;
  /** Why publishing is blocked as a whole (localized by the page). */
  publish: "fallback-incomplete" | null;
}

export interface ValidateSitePageOptions {
  /**
   * `publish` applies the release gate (fallback title + body); `draft` only
   * applies the rules that make a row storable at all.
   */
  readonly mode: "draft" | "publish";
}

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

export function emptySitePageTranslation(): SitePageTranslationDraft {
  return { title: "", body: "", metaDescription: "" };
}

export function emptySitePageForm(pageKey = "about"): SitePageFormValues {
  return {
    id: "",
    pageKey,
    status: "draft",
    translations: Object.fromEntries(
      SUPPORTED_LOCALES.map(locale => [locale, emptySitePageTranslation()])
    ) as Record<Locale, SitePageTranslationDraft>
  };
}

/**
 * Immutable per-locale update. Returning a new values object (and a new entry)
 * is what prevents the two-locale-lost bug: the active tab edits only its own
 * object; the other locales are carried over untouched.
 */
export function updateSitePageTranslation(
  values: SitePageFormValues,
  locale: Locale,
  patch: Partial<SitePageTranslationDraft>
): SitePageFormValues {
  return {
    ...values,
    translations: {
      ...values.translations,
      [locale]: { ...values.translations[locale], ...patch }
    }
  };
}

/**
 * Per-locale completeness for the shared T-027 indicator.
 *
 * A public About page needs a title AND a body (`SITE_PAGE_REQUIRED_FIELDS`),
 * so "complete" is exactly that pair. `hasContent` distinguishes "not started"
 * from "started but incomplete" (for example a seeded PL title with no body).
 */
export function sitePageCompleteness(values: {
  readonly translations: Record<Locale, SitePageTranslationDraft>;
}): LocaleCompleteness[] {
  return SUPPORTED_LOCALES.map(locale => {
    const translation = values.translations[locale];
    const missing: SitePageField[] = [];

    if (isBlank(translation.title)) missing.push("title");
    if (isBlank(translation.body)) missing.push("body");

    return {
      locale,
      complete: missing.length === 0,
      hasContent: !isBlank(translation.title) || !isBlank(translation.body),
      missing
    };
  });
}

/**
 * The validation matrix. Every problem is returned at once so the page can
 * associate messages with fields (DESIGN_SYSTEM.md §6) instead of revealing
 * them one submission at a time.
 */
export function validateSitePageForm(
  values: SitePageFormValues,
  options: ValidateSitePageOptions
): SitePageFormErrors {
  const translations: Partial<Record<Locale, SitePageTranslationError>> = {};

  for (const locale of SUPPORTED_LOCALES) {
    const translation = values.translations[locale];
    const hasText = !isBlank(translation.title) || !isBlank(translation.body);

    // `title` is NOT NULL on `site_page_translations`; body text without a
    // title cannot be persisted, so it is a field error rather than a silent
    // drop that would lose the administrator's work.
    if (hasText && isBlank(translation.title)) {
      translations[locale] = { title: "required" };
    }
  }

  let publish: SitePageFormErrors["publish"] = null;
  if (options.mode === "publish") {
    const fallback = values.translations[DEFAULT_LOCALE];
    const missingFallback: SitePageTranslationError = {};

    if (isBlank(fallback.title)) missingFallback.title = "required";
    if (isBlank(fallback.body)) missingFallback.body = "required";

    if (Object.keys(missingFallback).length > 0) {
      publish = "fallback-incomplete";
      translations[DEFAULT_LOCALE] = {
        ...translations[DEFAULT_LOCALE],
        ...missingFallback
      };
    }
  }

  return { translations, publish };
}

/** True when the matrix produced at least one blocking error. */
export function hasSitePageFormErrors(errors: SitePageFormErrors): boolean {
  return errors.publish !== null || Object.keys(errors.translations).length > 0;
}

export interface SitePageTranslationPayload {
  readonly locale: Locale;
  readonly title: string;
  readonly body: string | null;
  readonly metaDescription: string | null;
}

function nullable(value: string): string | null {
  return isBlank(value) ? null : value.trim();
}

/**
 * The complete intended translation set for the save RPC.
 *
 * Only locales with a title are sent: the table requires one and an entirely
 * blank locale is a deliberate clear (the RPC deletes omitted rows, matching
 * the T-045 project contract). Body may be null in a draft; the publish gate
 * above is what prevents a published page from having no body.
 */
export function sitePageTranslationsForSave(
  values: SitePageFormValues
): SitePageTranslationPayload[] {
  return SUPPORTED_LOCALES.filter(
    locale => !isBlank(values.translations[locale].title)
  ).map(locale => ({
    locale,
    title: values.translations[locale].title.trim(),
    body: nullable(values.translations[locale].body),
    metaDescription: nullable(values.translations[locale].metaDescription)
  }));
}
