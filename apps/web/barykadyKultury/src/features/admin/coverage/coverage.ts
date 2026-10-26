import { SUPPORTED_LOCALES, type Locale } from "@/features/i18n/locales";

/**
 * T-031 — translation-coverage matrix, pure.
 *
 * Design authority:
 *   - docs/PRODUCT_REQUIREMENTS.md §6: "See which locales have published
 *     content and which translations are missing."
 *   - docs/architecture.md §4: root lifecycle + one translation row per locale;
 *     only complete translated content is published.
 *   - T-012: `needs_review` marks unapproved machine/seed translations so this
 *     dashboard can flag them.
 *
 * Scope decision: only `published` roots are counted. A draft root has no
 * published locale by definition, so listing it would show "missing" in all
 * three languages and send editors to translate content that is merely
 * unpublished — a lifecycle action owned by the editors, not coverage.
 *
 * State precedence per locale is `missing` before `needsReview`: a row that is
 * flagged for review but also lacks a required field is not content a reader
 * can use, so it is reported as missing (the more actionable state).
 */

export const COVERAGE_ENTITY_KEYS = [
  "pages",
  "projects",
  "team",
  "publications",
  "documents"
] as const;

export type CoverageEntityKey = (typeof COVERAGE_ENTITY_KEYS)[number];

export type CoverageState = "published" | "missing" | "needsReview";

export type CoverageRootStatus = "draft" | "published" | "archived";

export interface CoverageTranslation {
  readonly locale: Locale;
  readonly needsReview: boolean;
  /**
   * The entity's required fields are non-blank. `team` has no required
   * localized field, so a present row is complete (docs/architecture.md §4).
   */
  readonly complete: boolean;
}

export interface CoverageSourceItem {
  readonly id: string;
  readonly label: string;
  readonly status: CoverageRootStatus;
  readonly translations: readonly CoverageTranslation[];
}

export type CoverageSources = Readonly<
  Record<CoverageEntityKey, readonly CoverageSourceItem[]>
>;

export type CoverageCounts = Readonly<Record<CoverageState, number>>;

export interface CoverageItem {
  readonly id: string;
  readonly label: string;
  readonly locales: Readonly<Record<Locale, CoverageState>>;
}

export interface CoverageEntityReport {
  readonly entity: CoverageEntityKey;
  readonly items: readonly CoverageItem[];
  readonly counts: Readonly<Record<Locale, CoverageCounts>>;
}

export interface CoverageReport {
  readonly entities: readonly CoverageEntityReport[];
}

function emptyCounts(): CoverageCounts {
  return { published: 0, missing: 0, needsReview: 0 };
}

function stateFor(item: CoverageSourceItem, locale: Locale): CoverageState {
  const translation = item.translations.find(entry => entry.locale === locale);

  if (!translation || !translation.complete) return "missing";
  return translation.needsReview ? "needsReview" : "published";
}

/**
 * Builds the matrix. Input is already normalized by the data-access layer
 * (raw row → `complete` flag), which keeps this function testable without a
 * database or per-entity field knowledge.
 */
export function buildCoverageReport(sources: CoverageSources): CoverageReport {
  return {
    entities: COVERAGE_ENTITY_KEYS.map(entity => {
      const published = sources[entity]
        .filter(item => item.status === "published")
        .slice()
        .sort((left, right) => left.label.localeCompare(right.label));

      const counts = Object.fromEntries(
        SUPPORTED_LOCALES.map(locale => [locale, { ...emptyCounts() }])
      ) as Record<
        Locale,
        { published: number; missing: number; needsReview: number }
      >;

      const items = published.map(item => {
        const locales = Object.fromEntries(
          SUPPORTED_LOCALES.map(locale => {
            const state = stateFor(item, locale);
            counts[locale][state] += 1;
            return [locale, state];
          })
        ) as Record<Locale, CoverageState>;

        return { id: item.id, label: item.label, locales };
      });

      return { entity, items, counts };
    })
  };
}
