import { describe, expect, it } from "vitest";

import {
  buildCoverageReport,
  COVERAGE_ENTITY_KEYS,
  type CoverageSourceItem
} from "@/features/admin/coverage/coverage";

/**
 * T-031 — translation-coverage matrix (pure calculation).
 *
 * Design authority:
 *   - docs/PRODUCT_REQUIREMENTS.md §6: administrators see which locales have
 *     PUBLISHED content and which translations are missing.
 *   - docs/architecture.md §4: localized text lives in translation tables; the
 *     root row owns the lifecycle, so a draft root has no published locale.
 *   - T-012: every translation row carries `needs_review`, the flag T-031
 *     surfaces. A row that exists but is missing a required field is not
 *     complete, so it counts as missing even when it is flagged for review.
 *
 * Draft/archived roots are excluded rather than reported as "missing in every
 * locale": that would tell an editor to translate content that is not public
 * for a lifecycle reason the coverage dashboard does not manage.
 */

function item(
  id: string,
  status: CoverageSourceItem["status"],
  translations: CoverageSourceItem["translations"]
): CoverageSourceItem {
  return { id, label: id, status, translations };
}

function complete(locale: "en" | "pl" | "uk", needsReview = false) {
  return { locale, needsReview, complete: true };
}

describe("buildCoverageReport", () => {
  it("reports every entity and locale, including empty entities", () => {
    const report = buildCoverageReport({
      pages: [item("about", "published", [complete("en")])],
      projects: [],
      team: [],
      publications: [],
      documents: []
    });

    expect(report.entities.map(entity => entity.entity)).toEqual([
      ...COVERAGE_ENTITY_KEYS
    ]);
    expect(report.entities[0]?.counts.en.published).toBe(1);
    expect(report.entities[1]?.items).toEqual([]);
  });

  it("counts published, missing and needsReview per locale", () => {
    const report = buildCoverageReport({
      pages: [
        item("about", "published", [
          complete("en"),
          complete("pl", true)
          // uk has no row
        ]),
        item("contact", "published", [
          complete("en"),
          complete("pl"),
          complete("uk", true)
        ]),
        item("support", "published", [complete("en"), complete("uk")])
      ],
      projects: [],
      team: [],
      publications: [],
      documents: []
    });

    const pageReport = report.entities[0]!;
    expect(pageReport.counts).toEqual({
      en: { published: 3, missing: 0, needsReview: 0 },
      pl: { published: 1, missing: 1, needsReview: 1 },
      uk: { published: 1, missing: 1, needsReview: 1 }
    });

    expect(pageReport.items[0]?.locales).toEqual({
      en: "published",
      pl: "needsReview",
      uk: "missing"
    });
  });

  it("excludes drafts and archived roots from published coverage", () => {
    const report = buildCoverageReport({
      pages: [],
      projects: [
        item("draft", "draft", [complete("en")]),
        item("archived", "archived", [complete("en")]),
        item("live", "published", [complete("en")])
      ],
      team: [],
      publications: [],
      documents: []
    });

    const projectReport = report.entities[1]!;
    expect(projectReport.items.map(entry => entry.id)).toEqual(["live"]);
    expect(projectReport.counts.en.published).toBe(1);
  });

  it("treats an incomplete translation row as missing even when flagged", () => {
    const report = buildCoverageReport({
      pages: [
        item("about", "published", [
          { locale: "en", needsReview: true, complete: false }
        ])
      ],
      projects: [],
      team: [],
      publications: [],
      documents: []
    });

    expect(report.entities[0]?.items[0]?.locales.en).toBe("missing");
  });

  it("accepts a translation row for entities whose fields are all optional", () => {
    const report = buildCoverageReport({
      pages: [],
      projects: [],
      team: [
        item("member", "published", [complete("en"), complete("uk", true)])
      ],
      publications: [],
      documents: []
    });

    expect(report.entities[2]?.items[0]?.locales).toEqual({
      en: "published",
      pl: "missing",
      uk: "needsReview"
    });
  });
});
