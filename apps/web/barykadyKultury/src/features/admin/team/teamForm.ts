import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type Locale
} from "@/features/i18n/locales";
import type { LocaleCompleteness } from "@/features/admin/shared/completeness";

/**
 * T-028 — pure team member form model.
 *
 * Design authority:
 *   - docs/PRODUCT_REQUIREMENTS.md §4-About: name plus OPTIONAL role, bio and
 *     portrait; never fabricate missing fields.
 *   - docs/architecture.md §4: `team_members.name` is locale-independent;
 *     `team_member_translations` holds localized role/bio, both nullable.
 *   - T-028 scope: create/edit/reorder/delete, optional portrait, per-locale
 *     role/bio, per-member publish toggle.
 *
 * Completeness is deliberately different from projects/pages: because role and
 * bio are optional, an untouched locale is "not started", not an error. The
 * public mapper only needs one translation row to resolve a card, so saving a
 * member with no localized text still writes an English row.
 */

export type TeamMemberStatus = "draft" | "published" | "archived";

export interface TeamMemberTranslationDraft {
  readonly role: string;
  readonly bio: string;
}

export interface TeamMemberFormValues {
  /** Root id; null when creating a new member. */
  readonly id: string | null;
  readonly name: string;
  readonly status: TeamMemberStatus;
  /** Storage object path (never a URL) or null. */
  readonly portraitPath: string | null;
  /** Existing position; null for a new member (the RPC computes max + 1). */
  readonly sortOrder: number | null;
  readonly translations: Record<Locale, TeamMemberTranslationDraft>;
}

export interface TeamMemberFormErrors {
  name: "required" | null;
}

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

export function emptyTeamTranslation(): TeamMemberTranslationDraft {
  return { role: "", bio: "" };
}

export function emptyTeamMemberForm(): TeamMemberFormValues {
  return {
    id: null,
    name: "",
    status: "draft",
    portraitPath: null,
    sortOrder: null,
    translations: Object.fromEntries(
      SUPPORTED_LOCALES.map(locale => [locale, emptyTeamTranslation()])
    ) as Record<Locale, TeamMemberTranslationDraft>
  };
}

/** Immutable per-locale update; other locales are carried over untouched. */
export function updateTeamTranslation(
  values: TeamMemberFormValues,
  locale: Locale,
  patch: Partial<TeamMemberTranslationDraft>
): TeamMemberFormValues {
  return {
    ...values,
    translations: {
      ...values.translations,
      [locale]: { ...values.translations[locale], ...patch }
    }
  };
}

/**
 * Per-locale status for the shared T-027 indicator.
 *
 * A locale is "complete" as soon as it carries role or bio, because neither
 * field is required. `missing` stays empty by design — labeling optional fields
 * as missing would tell administrators their optional content is broken.
 */
export function teamTranslationCompleteness(values: {
  readonly translations: Record<Locale, TeamMemberTranslationDraft>;
}): LocaleCompleteness[] {
  return SUPPORTED_LOCALES.map(locale => {
    const translation = values.translations[locale];
    const hasContent = !isBlank(translation.role) || !isBlank(translation.bio);

    return {
      locale,
      complete: hasContent,
      hasContent,
      missing: []
    };
  });
}

/** The name is the only required field (the root table's non-blank check). */
export function validateTeamMemberForm(
  values: TeamMemberFormValues
): TeamMemberFormErrors {
  return { name: isBlank(values.name) ? "required" : null };
}

export function hasTeamMemberFormErrors(errors: TeamMemberFormErrors): boolean {
  return errors.name !== null;
}

export interface TeamMemberTranslationPayload {
  readonly locale: Locale;
  readonly role: string | null;
  readonly bio: string | null;
}

function nullable(value: string): string | null {
  return isBlank(value) ? null : value.trim();
}

/**
 * The complete intended translation set for the save RPC.
 *
 * Omitted locales are deleted by the RPC (same contract as T-045), so blank
 * role/bio is a deliberate clear. English is always included: `mapTeamMember`
 * needs at least one translation row to render the card, and English is the
 * documented fallback.
 */
export function teamMemberTranslationsForSave(
  values: TeamMemberFormValues
): TeamMemberTranslationPayload[] {
  const payload = SUPPORTED_LOCALES.filter(locale => {
    const translation = values.translations[locale];
    return locale === DEFAULT_LOCALE
      ? true
      : !isBlank(translation.role) || !isBlank(translation.bio);
  }).map(locale => ({
    locale,
    role: nullable(values.translations[locale].role),
    bio: nullable(values.translations[locale].bio)
  }));

  return payload;
}
