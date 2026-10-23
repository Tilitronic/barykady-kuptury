import {
  DEFAULT_LOCALE,
  LOCALE_LABELS,
  SUPPORTED_LOCALES,
  type Locale
} from "@/features/i18n/locales";
import type { LocaleCompleteness } from "@/features/admin/shared/completeness";

/**
 * T-029 — pure publication form model.
 *
 * Design authority:
 *   - docs/PRODUCT_REQUIREMENTS.md §4-Publications: title, abstract, authors,
 *     publication date, language, and EITHER a file download OR an external
 *     URL. Optional metadata never requires invented values.
 *   - docs/architecture.md §4: root row owns status/date/URL/sort; localized
 *     text lives in `publication_translations`; one file per language lives
 *     in `publication_files` (the `(publication_id, locale)` unique constraint
 *     is the database authority for "one active file per language").
 *   - docs/tickets/T-029-admin-publications-documents.md: the URL xor file
 *     invariant is enforced here for immediate field feedback AND inside
 *     `save_publication_v1`, so a client bug or a direct RPC call cannot
 *     create an ambiguous publication.
 *
 * Keeping the rules in this module means the same matrix is proven without
 * mounting the editor, and the page can only render verdicts.
 */

export type PublicationStatus = "draft" | "published" | "archived";

/** Canonical root slug contract (D-24/T-038, same as projects/documents). */
export const PUBLICATION_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface PublicationTranslationDraft {
  title: string;
  abstract: string;
  authors: string;
}

/**
 * A file version. `storagePath` is a bucket-relative object key, never a URL
 * (the database check constraint rejects absolute URLs too).
 */
export interface PublicationFileDraft {
  readonly locale: Locale;
  readonly label: string;
  readonly storagePath: string;
  readonly mimeType: string | null;
  readonly sizeBytes: number | null;
}

export interface PublicationFormValues {
  /** Root id; null when creating. */
  id: string | null;
  slug: string;
  status: PublicationStatus;
  /** Primary language of the publication itself, where meaningful. */
  language: Locale | null;
  /** `YYYY-MM-DD` (empty string = unset). */
  publicationDate: string;
  externalUrl: string;
  /** Existing position; null asks the RPC to append after the current max. */
  sortOrder: number | null;
  translations: Record<Locale, PublicationTranslationDraft>;
  files: readonly PublicationFileDraft[];
}

export interface PublicationFormErrors {
  readonly slug: "required" | "format" | "duplicate" | null;
  readonly externalUrl: "invalid" | null;
  /** Exactly one of URL / file versions. */
  readonly action: "both" | "missing" | null;
  readonly translations: Partial<
    Record<Locale, Partial<Record<"title", "required">>>
  >;
  readonly publish: "fallback-incomplete" | null;
}

export interface ValidatePublicationOptions {
  readonly mode: "draft" | "publish";
  readonly existingSlugs?: readonly {
    readonly id: string;
    readonly slug: string;
  }[];
  readonly currentPublicationId?: string | null;
}

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

function nullable(value: string): string | null {
  return isBlank(value) ? null : value.trim();
}

export function emptyPublicationTranslation(): PublicationTranslationDraft {
  return { title: "", abstract: "", authors: "" };
}

export function emptyPublicationForm(): PublicationFormValues {
  return {
    id: null,
    slug: "",
    status: "draft",
    language: null,
    publicationDate: "",
    externalUrl: "",
    sortOrder: null,
    translations: Object.fromEntries(
      SUPPORTED_LOCALES.map(locale => [locale, emptyPublicationTranslation()])
    ) as Record<Locale, PublicationTranslationDraft>,
    files: []
  };
}

/** Immutable per-locale update: one tab never overwrites another locale. */
export function updatePublicationTranslation(
  values: PublicationFormValues,
  locale: Locale,
  patch: Partial<PublicationTranslationDraft>
): PublicationFormValues {
  return {
    ...values,
    translations: {
      ...values.translations,
      [locale]: { ...values.translations[locale], ...patch }
    }
  };
}

/** Replacing a language's file keeps exactly one row for that locale. */
export function upsertPublicationFile(
  values: PublicationFormValues,
  file: PublicationFileDraft
): PublicationFormValues {
  return {
    ...values,
    files: [
      ...values.files.filter(existing => existing.locale !== file.locale),
      file
    ]
  };
}

export function removePublicationFile(
  values: PublicationFormValues,
  locale: Locale
): PublicationFormValues {
  return {
    ...values,
    files: values.files.filter(file => file.locale !== locale)
  };
}

/** Completeness uses the one required translation field (title). */
export function publicationTranslationCompleteness(values: {
  readonly translations: Record<Locale, PublicationTranslationDraft>;
}): LocaleCompleteness[] {
  return SUPPORTED_LOCALES.map(locale => {
    const translation = values.translations[locale];
    const missing: ("title" | "summary" | "body")[] = isBlank(translation.title)
      ? ["title"]
      : [];

    return {
      locale,
      complete: missing.length === 0,
      hasContent:
        !isBlank(translation.title) ||
        !isBlank(translation.abstract) ||
        !isBlank(translation.authors),
      missing
    };
  });
}

/**
 * One row per file with its resolved display language. The editor renders
 * these rows so each version is identifiable by text, never by position or
 * colour alone (DESIGN_SYSTEM.md §6).
 */
export function publicationFileRows(values: {
  readonly files: readonly PublicationFileDraft[];
}) {
  return values.files.map(file => ({
    ...file,
    language: LOCALE_LABELS[file.locale]
  }));
}

function isHttpUrl(value: string): boolean {
  if (!/^https?:\/\//iu.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isValidDateInput(value: string): boolean {
  if (isBlank(value)) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  return !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

/**
 * The validation matrix. Returns every problem at once so the form can
 * associate messages with fields (DESIGN_SYSTEM.md §6).
 *
 * `action` is deliberately an error even in draft mode when BOTH are present:
 * an ambiguous publication is never a valid intermediate state. Zero actions
 * is only blocked when publishing (a draft may still be incomplete).
 */
export function validatePublicationForm(
  values: PublicationFormValues,
  options: ValidatePublicationOptions
): PublicationFormErrors {
  const slug = values.slug.trim();
  let slugError: PublicationFormErrors["slug"] = null;

  if (slug === "") {
    slugError = "required";
  } else if (!PUBLICATION_SLUG_PATTERN.test(slug)) {
    slugError = "format";
  } else if (
    (options.existingSlugs ?? []).some(
      row => row.slug === slug && row.id !== options.currentPublicationId
    )
  ) {
    slugError = "duplicate";
  }

  const externalUrl = values.externalUrl.trim();
  const externalUrlError =
    externalUrl === "" || isHttpUrl(externalUrl) ? null : "invalid";

  const hasUrl = externalUrl !== "" && externalUrlError === null;
  const hasFiles = values.files.length > 0;

  let action: PublicationFormErrors["action"] = null;
  if (hasUrl && hasFiles) {
    action = "both";
  } else if (options.mode === "publish" && !hasUrl && !hasFiles) {
    action = "missing";
  }

  const translations: PublicationFormErrors["translations"] = {};
  for (const locale of SUPPORTED_LOCALES) {
    const translation = values.translations[locale];
    const hasText =
      !isBlank(translation.title) ||
      !isBlank(translation.abstract) ||
      !isBlank(translation.authors);

    if (hasText && isBlank(translation.title)) {
      translations[locale] = { title: "required" };
    }
  }

  let publish: PublicationFormErrors["publish"] = null;
  if (options.mode === "publish") {
    const fallback = values.translations[DEFAULT_LOCALE];
    if (isBlank(fallback.title)) {
      publish = "fallback-incomplete";
      translations[DEFAULT_LOCALE] = {
        ...translations[DEFAULT_LOCALE],
        title: "required"
      };
    }
  }

  return {
    slug: slugError,
    externalUrl: externalUrlError,
    action,
    translations,
    publish
  };
}

/** Field-level date validity (the page renders this under the date input). */
export function isPublicationDateValid(value: string): boolean {
  return isValidDateInput(value);
}

export function hasPublicationFormErrors(
  errors: PublicationFormErrors
): boolean {
  return (
    errors.slug !== null ||
    errors.externalUrl !== null ||
    errors.action !== null ||
    errors.publish !== null ||
    Object.keys(errors.translations).length > 0
  );
}

export interface PublicationTranslationPayload {
  readonly locale: Locale;
  readonly title: string;
  readonly abstract: string | null;
  readonly authors: string | null;
}

/**
 * The complete intended translation set. Locales without a title are omitted
 * (the RPC deletes them); body/AST columns owned by the reader importer are
 * untouched by the upsert, so editing metadata never erases imported text.
 */
export function publicationTranslationsForSave(
  values: PublicationFormValues
): PublicationTranslationPayload[] {
  return SUPPORTED_LOCALES.filter(
    locale => !isBlank(values.translations[locale].title)
  ).map(locale => ({
    locale,
    title: values.translations[locale].title.trim(),
    abstract: nullable(values.translations[locale].abstract),
    authors: nullable(values.translations[locale].authors)
  }));
}

export interface PublicationFilePayload {
  readonly locale: Locale;
  readonly label: string | null;
  readonly storagePath: string;
  readonly mimeType: string | null;
  readonly sizeBytes: number | null;
}

export function publicationFilesForSave(
  values: PublicationFormValues
): PublicationFilePayload[] {
  return values.files.map(file => ({
    locale: file.locale,
    label: nullable(file.label),
    storagePath: file.storagePath,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes
  }));
}
