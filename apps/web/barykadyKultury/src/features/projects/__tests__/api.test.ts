import { describe, expect, it } from "vitest";

import {
  fetchPublishedProjectBySlug,
  fetchPublishedProjects,
  findProjectBySlug,
  type ProjectRowWithTranslations
} from "@/features/projects/api";
import { createFakeSupabase } from "@/test-utils/fakeSupabase";

/**
 * Spec axis: docs/tickets/T-038-canonical-slugs.md + D-24 — one canonical root
 * slug is shared by every locale. Detail resolution is STRICT: the published
 * row must carry the root slug AND a translation must exist for the requested
 * locale (the T-019 rule, now trivially expressed). An English fallback slug
 * must never resolve a Polish URL, and a draft is never resolvable.
 */
const EN_TRANSLATION = {
  locale: "en",
  title: "Community Workshop (EN)",
  summary: "Summary (EN)",
  body: "Body (EN)"
};

const PL_TRANSLATION = {
  locale: "pl",
  title: "Warsztat spoleczny (PL)",
  summary: "Podsumowanie (PL)",
  body: "Tresc (PL)"
};

const CANONICAL_SLUG = "community-workshop";

function projectRow(
  overrides: Record<string, unknown> = {}
): ProjectRowWithTranslations {
  return {
    id: "00000000-0000-4000-8000-000000000201",
    slug: CANONICAL_SLUG,
    status: "published",
    featured_rank: 2,
    cover_path: "fixtures/projects/cover.webp",
    start_date: "2026-01-10",
    end_date: "2026-03-20",
    published_at: "2026-01-05T12:00:00Z",
    created_at: "2026-01-05T12:00:00Z",
    updated_at: "2026-02-01T00:00:00Z",
    project_translations: [EN_TRANSLATION, PL_TRANSLATION],
    ...overrides
    // Fixture rows carry only the columns the SELECT reads and the mapping
    // touches; the cast confines that approximation to the test seam
    // (same pattern as `fakeSupabase.ts`).
  } as unknown as ProjectRowWithTranslations;
}

function selectText(
  calls: ReturnType<typeof createFakeSupabase>["calls"]
): string {
  const select = calls.find(call => call.method === "select")?.args[0];
  return typeof select === "string" ? select : "";
}

function eqValue(
  calls: ReturnType<typeof createFakeSupabase>["calls"],
  column: string
): unknown[] {
  return calls
    .filter(call => call.method === "eq" && call.args[0] === column)
    .map(call => call.args[1]);
}

describe("fetchPublishedProjects", () => {
  it("filters the query to published rows only", async () => {
    const fake = createFakeSupabase({ tables: { projects: [] } });

    await fetchPublishedProjects(fake.client, "pl");

    expect(eqValue(fake.calls, "status")).toEqual(["published"]);
  });

  it("uses a lean list projection without the detail body", async () => {
    const fake = createFakeSupabase({ tables: { projects: [projectRow()] } });

    await fetchPublishedProjects(fake.client, "pl");

    const select = selectText(fake.calls);
    expect(select).toContain("project_translations(locale, title, summary)");
    expect(select).not.toContain("body");
  });

  it("maps rows to domain models without leaking database column names", async () => {
    const fake = createFakeSupabase({ tables: { projects: [projectRow()] } });

    const result = await fetchPublishedProjects(fake.client, "pl");
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;

    const [project] = result.items;
    expect(project).toBeDefined();
    expect(project!.title).toBe("Warsztat spoleczny (PL)");
    // The slug comes from the root row, never from a locale translation.
    expect(project!.slug).toBe(CANONICAL_SLUG);
    expect(project!.isFallback).toBe(false);
    expect(project!.featuredRank).toBe(2);
    expect(project!.coverPath).toBe("fixtures/projects/cover.webp");
    // List cards do not need the long-form body; the detail fetch keeps it.
    expect(project!.body).toBeNull();
    expect(project!.summary).toBe("Podsumowanie (PL)");

    for (const key of Object.keys(project!)) {
      expect(key, `domain key leaks a DB column name: ${key}`).not.toContain(
        "_"
      );
    }
  });

  it("flags the English fallback when the requested locale is absent", async () => {
    const fake = createFakeSupabase({
      tables: {
        projects: [projectRow({ project_translations: [EN_TRANSLATION] })]
      }
    });

    const result = await fetchPublishedProjects(fake.client, "uk");
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;

    expect(result.items[0]!.isFallback).toBe(true);
    expect(result.items[0]!.title).toBe("Community Workshop (EN)");
    expect(result.items[0]!.slug).toBe(CANONICAL_SLUG);
  });

  it("returns the empty state when no row matches", async () => {
    const fake = createFakeSupabase({ tables: { projects: [] } });

    expect(await fetchPublishedProjects(fake.client, "pl")).toEqual({
      kind: "empty"
    });
  });

  it("returns the unavailable state when the client is absent", async () => {
    expect(await fetchPublishedProjects(null, "pl")).toEqual({
      kind: "unavailable"
    });
  });

  it("returns the unavailable state when the query errors", async () => {
    const fake = createFakeSupabase({ error: { message: "boom" } });

    expect(await fetchPublishedProjects(fake.client, "pl")).toEqual({
      kind: "unavailable"
    });
  });
});

/**
 * T-038/D-24: the root slug is the only slug. The requested locale must have a
 * translation, but the URL segment never changes between locales.
 */
describe("findProjectBySlug", () => {
  const rows = [projectRow()];

  it("resolves the canonical root slug for a locale that has a translation", () => {
    const row = findProjectBySlug(rows, CANONICAL_SLUG, "pl");

    expect(row).toBeDefined();
    expect(row?.id).toBe("00000000-0000-4000-8000-000000000201");
  });

  it("rejects an unknown slug", () => {
    expect(findProjectBySlug(rows, "not-a-project", "pl")).toBeNull();
  });

  it("rejects a locale without a translation", () => {
    const enOnly = [projectRow({ project_translations: [EN_TRANSLATION] })];

    expect(findProjectBySlug(enOnly, CANONICAL_SLUG, "pl")).toBeNull();
  });

  it("never resolves a draft row, even when the payload contains it", () => {
    const draft = projectRow({
      id: "00000000-0000-4000-8000-000000000202",
      slug: "sample-draft-project",
      status: "draft",
      project_translations: [EN_TRANSLATION]
    });

    expect(findProjectBySlug([draft], "sample-draft-project", "en")).toBeNull();
  });
});

describe("fetchPublishedProjectBySlug", () => {
  it("queries by the canonical root slug and keeps the detail body", async () => {
    const fake = createFakeSupabase({ tables: { projects: [projectRow()] } });

    await fetchPublishedProjectBySlug(fake.client, CANONICAL_SLUG, "pl");

    expect(eqValue(fake.calls, "slug")).toEqual([CANONICAL_SLUG]);
    expect(selectText(fake.calls)).toContain(
      "project_translations(locale, title, summary, body)"
    );
  });

  it("returns the single project for the canonical slug in the requested locale", async () => {
    const fake = createFakeSupabase({ tables: { projects: [projectRow()] } });

    const result = await fetchPublishedProjectBySlug(
      fake.client,
      CANONICAL_SLUG,
      "pl"
    );

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.title).toBe("Warsztat spoleczny (PL)");
    expect(result.items[0]!.slug).toBe(CANONICAL_SLUG);
    expect(result.items[0]!.isFallback).toBe(false);
    expect(result.items[0]!.body).toBe("Tresc (PL)");
  });

  it("returns empty when the requested locale has no translation", async () => {
    const fake = createFakeSupabase({
      tables: {
        projects: [projectRow({ project_translations: [EN_TRANSLATION] })]
      }
    });

    expect(
      await fetchPublishedProjectBySlug(fake.client, CANONICAL_SLUG, "pl")
    ).toEqual({ kind: "empty" });
  });

  it("returns empty for a draft slug even when the payload leaks the row", async () => {
    const draft = projectRow({
      id: "00000000-0000-4000-8000-000000000202",
      slug: "sample-draft-project",
      status: "draft",
      project_translations: [EN_TRANSLATION]
    });
    const fake = createFakeSupabase({
      tables: { projects: [projectRow(), draft] }
    });

    expect(
      await fetchPublishedProjectBySlug(
        fake.client,
        "sample-draft-project",
        "en"
      )
    ).toEqual({ kind: "empty" });
  });

  it("returns the unavailable state without a client", async () => {
    expect(await fetchPublishedProjectBySlug(null, "any", "en")).toEqual({
      kind: "unavailable"
    });
  });
});
