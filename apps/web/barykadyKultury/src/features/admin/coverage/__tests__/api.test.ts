import { describe, expect, it } from "vitest";

import { fetchAdminCoverage } from "@/features/admin/coverage/api";
import { COVERAGE_ENTITY_KEYS } from "@/features/admin/coverage/coverage";
import { createFakeSupabase } from "@/test-utils/fakeSupabase";

/**
 * T-031 — coverage data access (gate fix, reviewer Major).
 *
 * The coverage page is read-only and available to any admin-area user; reads
 * are still filtered by RLS (docs/architecture.md §6.1), so the query is the
 * honest source of what that session may see. Drafts are excluded by the pure
 * report builder, not by dropping rows here.
 *
 * These tests pin the four seams the page depends on:
 *   1. any failing entity query fails the whole report (never a partial matrix);
 *   2. the first error in entity order is the one reported;
 *   3. every entity's own required fields decide `complete` (the table-specific
 *      rule lives here, not in the pure matrix);
 *   4. the report shape and ordering are deterministic.
 */

const PAGE_ROW = {
  id: "page-about",
  page_key: "about",
  status: "published",
  site_page_translations: [
    { locale: "en", title: "About", body: "Body", needs_review: false },
    { locale: "pl", title: "O nas", body: null, needs_review: false },
    { locale: "uk", title: "Pro nas", body: "Tekst", needs_review: true }
  ]
};

const PROJECT_ROW = {
  id: "project-1",
  slug: "project-one",
  status: "published",
  project_translations: [
    {
      locale: "en",
      title: "Project One",
      summary: null,
      body: null,
      needs_review: false
    }
  ]
};

const TEAM_ROW = {
  id: "member-1",
  name: "Sample Member",
  status: "published",
  team_member_translations: [
    { locale: "en", role: null, bio: null, needs_review: false }
  ]
};

const PUBLICATION_ROW = {
  id: "publication-1",
  status: "published",
  publication_translations: [
    { locale: "en", slug: "report", title: "Report", needs_review: false }
  ]
};

const DOCUMENT_ROW = {
  id: "document-1",
  status: "published",
  organization_document_translations: [
    { locale: "uk", slug: "statut", title: "Statut", needs_review: false }
  ]
};

function tables() {
  return {
    site_pages: [PAGE_ROW],
    projects: [PROJECT_ROW],
    team_members: [TEAM_ROW],
    publications: [PUBLICATION_ROW],
    organization_documents: [DOCUMENT_ROW]
  };
}

describe("fetchAdminCoverage", () => {
  it("builds the matrix for all five entities", async () => {
    const fake = createFakeSupabase({ tables: tables() });

    const result = await fetchAdminCoverage(fake.client);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const [pages, projects, team, publications, documents] =
      result.report.entities;

    // Required fields are per entity: a page needs title + body, a project
    // needs title + summary + body, a team row needs no localized field.
    expect(pages?.items[0]?.locales).toEqual({
      en: "published",
      pl: "missing",
      uk: "needsReview"
    });
    expect(projects?.items[0]?.locales).toEqual({
      en: "missing",
      pl: "missing",
      uk: "missing"
    });
    expect(team?.items[0]?.locales.en).toBe("published");
    expect(publications?.items[0]?.locales.en).toBe("published");
    expect(documents?.items[0]?.locales.uk).toBe("published");

    expect(fake.calls.filter(call => call.method === "select")).toHaveLength(5);
  });

  it("maps each entity's completeness rule across all three locales", async () => {
    const fake = createFakeSupabase({
      tables: {
        site_pages: [
          {
            ...PAGE_ROW,
            site_page_translations: [
              {
                locale: "en",
                title: "About",
                body: "Body",
                needs_review: false
              },
              { locale: "pl", title: "O nas", body: null, needs_review: false },
              {
                locale: "uk",
                title: "Pro nas",
                body: "Tekst",
                needs_review: true
              }
            ]
          }
        ],
        projects: [
          {
            ...PROJECT_ROW,
            project_translations: [
              {
                locale: "en",
                title: "Project One",
                summary: "Summary",
                body: "Body",
                needs_review: false
              },
              {
                locale: "pl",
                title: "Projekt",
                summary: "Streszczenie",
                body: null,
                needs_review: false
              },
              {
                locale: "uk",
                title: "Proiekt",
                summary: "Opys",
                body: "Tekst",
                needs_review: false
              }
            ]
          }
        ],
        team_members: [
          {
            ...TEAM_ROW,
            team_member_translations: [
              { locale: "en", role: null, bio: null, needs_review: false },
              { locale: "pl", role: "Rola", bio: null, needs_review: false },
              { locale: "uk", role: null, bio: null, needs_review: true }
            ]
          }
        ],
        publications: [
          {
            ...PUBLICATION_ROW,
            publication_translations: [
              {
                locale: "en",
                slug: "report",
                title: "Report",
                needs_review: false
              },
              {
                locale: "pl",
                slug: "raport",
                title: "   ",
                needs_review: false
              },
              {
                locale: "uk",
                slug: "zvit",
                title: "Zvit",
                needs_review: true
              }
            ]
          }
        ],
        organization_documents: [
          {
            ...DOCUMENT_ROW,
            organization_document_translations: [
              {
                locale: "en",
                slug: "statute",
                title: "Statute",
                needs_review: false
              },
              {
                locale: "uk",
                slug: "statut",
                title: "  ",
                needs_review: true
              }
            ]
          }
        ]
      }
    });

    const result = await fetchAdminCoverage(fake.client);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const [pages, projects, team, publications, documents] =
      result.report.entities;

    expect(pages?.items[0]?.locales).toEqual({
      en: "published",
      pl: "missing",
      uk: "needsReview"
    });
    expect(projects?.items[0]?.locales).toEqual({
      en: "published",
      pl: "missing",
      uk: "published"
    });
    // Team role/bio are optional: a present row is complete; needs_review is
    // still flagged independently.
    expect(team?.items[0]?.locales).toEqual({
      en: "published",
      pl: "published",
      uk: "needsReview"
    });
    expect(publications?.items[0]?.locales).toEqual({
      en: "published",
      pl: "missing",
      uk: "needsReview"
    });
    // Missing (blank title) wins over needsReview: the row is not usable text.
    expect(documents?.items[0]?.locales).toEqual({
      en: "published",
      pl: "missing",
      uk: "missing"
    });
  });

  it("uses the English title, then any title, then the entity key as a label", async () => {
    const fake = createFakeSupabase({ tables: tables() });

    const result = await fetchAdminCoverage(fake.client);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.entities[0]?.items[0]?.label).toBe("about");
    expect(result.report.entities[1]?.items[0]?.label).toBe("Project One");
    expect(result.report.entities[2]?.items[0]?.label).toBe("Sample Member");
    expect(result.report.entities[3]?.items[0]?.label).toBe("Report");
    expect(result.report.entities[4]?.items[0]?.label).toBe("Statut");
  });

  it("returns a deterministic report shape and entity order", async () => {
    // Deliberately unsorted input proves the report owns ordering rather than
    // inheriting database row order (the page renders it directly).
    const fake = createFakeSupabase({
      tables: {
        ...tables(),
        site_pages: [
          { ...PAGE_ROW, id: "page-support", page_key: "support" },
          { ...PAGE_ROW, id: "page-about", page_key: "about" }
        ]
      }
    });

    const first = await fetchAdminCoverage(fake.client);
    const second = await fetchAdminCoverage(fake.client);

    expect(first).toEqual(second);
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    expect(Object.keys(first)).toEqual(["ok", "report"]);
    expect(Object.keys(first.report)).toEqual(["entities"]);
    expect(first.report.entities.map(entity => entity.entity)).toEqual([
      ...COVERAGE_ENTITY_KEYS
    ]);

    for (const entity of first.report.entities) {
      expect(Object.keys(entity)).toEqual(["entity", "items", "counts"]);
      expect(Object.keys(entity.counts)).toEqual(["en", "pl", "uk"]);
    }

    expect(first.report.entities[0]?.items.map(item => item.label)).toEqual([
      "about",
      "support"
    ]);
  });

  it("propagates the first failing entity query in entity order", async () => {
    const fake = createFakeSupabase({
      tables: tables(),
      tableErrors: {
        projects: "projects denied",
        organization_documents: "documents denied"
      }
    });

    await expect(fetchAdminCoverage(fake.client)).resolves.toEqual({
      ok: false,
      code: "failed",
      message: "projects denied"
    });
  });

  it("fails closed when the last entity query fails", async () => {
    const fake = createFakeSupabase({
      tables: tables(),
      tableErrors: { organization_documents: "permission denied" }
    });

    await expect(fetchAdminCoverage(fake.client)).resolves.toEqual({
      ok: false,
      code: "failed",
      message: "permission denied"
    });
  });

  it("reports unavailable without a client", async () => {
    await expect(fetchAdminCoverage(null)).resolves.toEqual({
      ok: false,
      code: "unavailable"
    });
  });
});
