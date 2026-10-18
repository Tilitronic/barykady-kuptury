import { DEFAULT_LOCALE, type Locale } from "@/features/i18n/locales";

/**
 * Translation selection for the normalized content model (T-015).
 *
 * docs/architecture.md §4: content roots carry shared lifecycle metadata and
 * their localized text lives in `<entity>_translations`; "only complete
 * translations intended for publication should be presented as localized
 * content". This module is the single place that decides which translation a
 * request resolves to:
 *
 * 1. the requested locale, when that translation exists and is complete;
 * 2. otherwise the English translation, when fallback is allowed and complete;
 * 3. otherwise nothing — never a silent mix and never a pl↔uk substitution.
 *
 * This lives in `src/shared/` because every feature module (content, projects,
 * publications, team, documents) consumes the same rule; a per-feature copy
 * would let the fallback policy drift (architecture §4 requires one definition).
 * It is pure, so the precedence is unit-tested without a client.
 */

/** Minimum shape every translation row shares. */
export interface LocaleTranslation {
  readonly locale: string;
}

/**
 * A content root plus its translation rows. `status` is the root's lifecycle
 * state; when omitted the caller has already filtered to published rows (the
 * data-access layer always applies `.eq("status", "published")`).
 */
export interface TranslatableRow<T extends LocaleTranslation> {
  readonly status?: string | null;
  readonly translations?: readonly T[] | null;
}

export interface SelectTranslationOptions<T extends LocaleTranslation> {
  /**
   * Field names that must be present and non-blank for a translation to count
   * as complete. The list is per content type (a page needs `title`/`body`, a
   * publication needs `title`); it is the data-access layer's definition of the
   * same rule T-027 will enforce on publish.
   */
  readonly requiredFields?: readonly (keyof T)[];
  /**
   * Allow the English translation to stand in for a missing requested locale.
   * Defaults to `true`; call sites that must never show fallback (for example an
   * exact-slug lookup) pass `false`.
   */
  readonly allowFallback?: boolean;
}

export interface SelectedTranslation<T> {
  readonly value: T;
  readonly isFallback: boolean;
}

const PUBLISHED_STATUS = "published";

/**
 * A field is present when it is neither `null`/`undefined` nor a blank string.
 * Empty collections are intentionally not treated as missing: only the declared
 * required fields are checked, and none of them are collections today.
 */
function isPresent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

function isComplete<T extends LocaleTranslation>(
  translation: T,
  requiredFields: readonly (keyof T)[]
): boolean {
  return requiredFields.every(field => isPresent(translation[field]));
}

/**
 * Resolves the translation for `locale`.
 *
 * @returns the selected translation plus `isFallback`, or `null` when no
 *   complete, published translation can be used.
 */
export function selectTranslation<T extends LocaleTranslation>(
  row: TranslatableRow<T> | null | undefined,
  locale: Locale,
  options: SelectTranslationOptions<T> = {}
): SelectedTranslation<T> | null {
  if (!row) return null;

  // A non-published root never yields public localized content, even if a
  // caller forgot to filter (docs/architecture.md §6, D-21).
  if (row.status != null && row.status !== PUBLISHED_STATUS) return null;

  const translations = row.translations ?? [];
  const requiredFields = options.requiredFields ?? [];
  const allowFallback = options.allowFallback ?? true;

  const requested = translations.find(entry => entry.locale === locale);
  if (requested && isComplete(requested, requiredFields)) {
    return { value: requested, isFallback: false };
  }

  if (allowFallback && locale !== DEFAULT_LOCALE) {
    const fallback = translations.find(
      entry => entry.locale === DEFAULT_LOCALE
    );
    if (fallback && isComplete(fallback, requiredFields)) {
      return { value: fallback, isFallback: true };
    }
  }

  return null;
}
