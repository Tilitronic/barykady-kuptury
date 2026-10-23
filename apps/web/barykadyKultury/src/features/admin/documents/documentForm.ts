import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type Locale
} from "@/features/i18n/locales";
import type { LocaleCompleteness } from "@/features/admin/shared/completeness";

/**
 * T-029 — pure organization-document form model.
 *
 * Design authority:
 *   - docs/PRODUCT_REQUIREMENTS.md §4-About: a document shows a descriptive
 *     title and, where known, type/date/language/file metadata; a downloadable
 *     file must work anonymously.
 *   - docs/architecture.md §4: root metadata (type/date/language/path/sort)
 *     plus one translation row per locale (title/description).
 *   - docs/tickets/T-029-admin-publications-documents.md: create/edit/delete
 *     with type, date, language, file, sort order and a publish toggle.
 *
 * T-017 also allows in-app readable text documents (`storage_path` null). The
 * editor does not own their body, so the save RPC upserts only
 * title/description and never touches `body`; a file is required only when
 * creating a NEW document in this ticket's upload-driven flow.
 */

export type DocumentStatus = "draft" | "published" | "archived";

export const DOCUMENT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface DocumentTranslationDraft {
  title: string;
  description: string;
}

export interface DocumentFormValues {
  id: string | null;
  slug: string;
  status: DocumentStatus;
  documentType: string;
  /** Language of the uploaded file itself (distinct from the UI locale). */
  language: Locale;
  publicationDate: string;
  sortOrder: number | null;
  /** Bucket-relative storage path, never a URL. */
  storagePath: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  translations: Record<Locale, DocumentTranslationDraft>;
}

export interface DocumentFormErrors {
  readonly slug: "required" | "format" | "duplicate" | null;
  readonly documentType: "required" | null;
  readonly storagePath: "required" | "absolute-url" | null;
  readonly translations: Partial<
    Record<Locale, Partial<Record<"title", "required">>>
  >;
  readonly publish: "fallback-incomplete" | null;
}

export interface ValidateDocumentOptions {
  readonly mode: "draft" | "publish";
  /** Creating a document through T-029 requires the uploaded file. */
  readonly isNew?: boolean;
  readonly existingSlugs?: readonly {
    readonly id: string;
    readonly slug: string;
  }[];
  readonly currentDocumentId?: string | null;
}

/** Known free-form types the public catalogue localizes (T-017). */
export const DOCUMENT_TYPE_KEYS = ["regulations", "statute", "report"] as const;

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

function nullable(value: string): string | null {
  return isBlank(value) ? null : value.trim();
}

export function emptyDocumentTranslation(): DocumentTranslationDraft {
  return { title: "", description: "" };
}

export function emptyDocumentForm(): DocumentFormValues {
  return {
    id: null,
    slug: "",
    status: "draft",
    documentType: "",
    language: DEFAULT_LOCALE,
    publicationDate: "",
    sortOrder: null,
    storagePath: null,
    mimeType: null,
    sizeBytes: null,
    translations: Object.fromEntries(
      SUPPORTED_LOCALES.map(locale => [locale, emptyDocumentTranslation()])
    ) as Record<Locale, DocumentTranslationDraft>
  };
}

export function updateDocumentTranslation(
  values: DocumentFormValues,
  locale: Locale,
  patch: Partial<DocumentTranslationDraft>
): DocumentFormValues {
  return {
    ...values,
    translations: {
      ...values.translations,
      [locale]: { ...values.translations[locale], ...patch }
    }
  };
}

export function documentTranslationCompleteness(values: {
  readonly translations: Record<Locale, DocumentTranslationDraft>;
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
        !isBlank(translation.title) || !isBlank(translation.description),
      missing
    };
  });
}

/** `YYYY-MM-DD` (or empty) is the only storable date input. */
export function isDocumentDateValid(value: string): boolean {
  if (isBlank(value)) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  return !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function validateDocumentForm(
  values: DocumentFormValues,
  options: ValidateDocumentOptions
): DocumentFormErrors {
  const slug = values.slug.trim();
  let slugError: DocumentFormErrors["slug"] = null;

  if (slug === "") {
    slugError = "required";
  } else if (!DOCUMENT_SLUG_PATTERN.test(slug)) {
    slugError = "format";
  } else if (
    (options.existingSlugs ?? []).some(
      row => row.slug === slug && row.id !== options.currentDocumentId
    )
  ) {
    slugError = "duplicate";
  }

  const documentType = isBlank(values.documentType) ? "required" : null;

  let storagePath: DocumentFormErrors["storagePath"] = null;
  if (
    values.storagePath !== null &&
    /^https?:\/\//iu.test(values.storagePath)
  ) {
    storagePath = "absolute-url";
  } else if (options.isNew === true && values.storagePath === null) {
    storagePath = "required";
  }

  const translations: DocumentFormErrors["translations"] = {};
  for (const locale of SUPPORTED_LOCALES) {
    const translation = values.translations[locale];
    const hasText =
      !isBlank(translation.title) || !isBlank(translation.description);

    if (hasText && isBlank(translation.title)) {
      translations[locale] = { title: "required" };
    }
  }

  let publish: DocumentFormErrors["publish"] = null;
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
    documentType,
    storagePath,
    translations,
    publish
  };
}

export function hasDocumentFormErrors(errors: DocumentFormErrors): boolean {
  return (
    errors.slug !== null ||
    errors.documentType !== null ||
    errors.storagePath !== null ||
    errors.publish !== null ||
    Object.keys(errors.translations).length > 0
  );
}

export interface DocumentTranslationPayload {
  readonly locale: Locale;
  readonly title: string;
  readonly description: string | null;
}

export function documentTranslationsForSave(
  values: DocumentFormValues
): DocumentTranslationPayload[] {
  return SUPPORTED_LOCALES.filter(
    locale => !isBlank(values.translations[locale].title)
  ).map(locale => ({
    locale,
    title: values.translations[locale].title.trim(),
    description: nullable(values.translations[locale].description)
  }));
}
