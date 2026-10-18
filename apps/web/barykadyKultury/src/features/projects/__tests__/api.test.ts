import { describe, expect, it } from "vitest";

import { fetchPublishedProjects } from "@/features/projects/api";
import { createFakeSupabase } from "@/test-utils/fakeSupabase";

/**
 * Spec axis: docs/tickets/T-015-typed-data-access.md — the select functions
 * "query filters published only, and maps rows to domain objects without
 * leaking DB column names" (docs/TESTING.md §2, docs/architecture.md §3).
 *
 * The fake client (`src/test-utils/fakeSupabase.ts`) is typed and does no I/O,
 * so the published filter and the row→domain mapping are proven deterministically.
 */
const EN_TRANSLATION = {
  locale: "en",
  slug: "community-workshop",
  title: "Community Workshop (EN)",
  summary: "Summary (EN)",
  body: "Body (EN)"
};

const PL_TRANSLATION = {
  locale: "pl",
  slug: "warsztat-spoleczny",
  title: "Warsztat spoleczny (PL)",
  summary: "Podsumowanie (PL)",
  body: "Tresc (PL)"
};

function projectRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-4000-8000-000000000201",
    status: "published",
    featured_rank: 2,
    cover_path: "fixtures/projects/cover.webp",
    start_date: "2026-01-10",
    end_date: "2026-03-20",
    updated_at: "2026-02-01T00:00:00Z",
    project_translations: [EN_TRANSLATION, PL_TRANSLATION],
    ...overrides
  };
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

  it("maps rows to domain models without leaking database column names", async () => {
    const fake = createFakeSupabase({ tables: { projects: [projectRow()] } });

    const result = await fetchPublishedProjects(fake.client, "pl");
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;

    const [project] = result.items;
    expect(project).toBeDefined();
    expect(project!.title).toBe("Warsztat spoleczny (PL)");
    expect(project!.slug).toBe("warsztat-spoleczny");
    expect(project!.isFallback).toBe(false);
    expect(project!.featuredRank).toBe(2);
    expect(project!.coverPath).toBe("fixtures/projects/cover.webp");

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
