import { describe, expect, it } from "vitest";

import { featuredProjects, recentProjects } from "@/features/projects/ordering";

/**
 * Spec axis: docs/PRODUCT_REQUIREMENTS.md §5 ("featured projects in configured
 * order; when no projects are featured, recent published projects are shown")
 * and docs/TESTING.md §2 ("project sorting/featured-project fallback").
 *
 * Both helpers are pure, so ordering and draft exclusion are proven without a
 * client. The `ProjectSummary` domain model satisfies `OrderableProject`
 * structurally, so the same functions consume real query results in T-025.
 */
interface Fixture {
  id: string;
  status: "draft" | "published" | "archived";
  featuredRank: number | null;
  updatedAt: string;
}

function project(overrides: Partial<Fixture> = {}): Fixture {
  return {
    id: "project",
    status: "published",
    featuredRank: null,
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides
  };
}

describe("featuredProjects", () => {
  it("orders featured projects by their configured rank", () => {
    const result = featuredProjects([
      project({ id: "second", featuredRank: 2 }),
      project({ id: "first", featuredRank: 1 })
    ]);

    expect(result.map(entry => entry.id)).toEqual(["first", "second"]);
  });

  it("falls back to most-recently-updated published when nothing is featured", () => {
    const result = featuredProjects([
      project({ id: "old", updatedAt: "2026-01-01T00:00:00Z" }),
      project({ id: "new", updatedAt: "2026-03-01T00:00:00Z" })
    ]);

    expect(result.map(entry => entry.id)).toEqual(["new", "old"]);
  });

  it("excludes drafts, even when a draft carries a featured rank", () => {
    const result = featuredProjects([
      project({ id: "draft", status: "draft", featuredRank: 1 }),
      project({ id: "featured", featuredRank: 2 })
    ]);

    expect(result.map(entry => entry.id)).toEqual(["featured"]);
  });

  it("returns an empty list when nothing is published", () => {
    expect(
      featuredProjects([
        project({ id: "draft", status: "draft" }),
        project({ id: "archived", status: "archived" })
      ])
    ).toEqual([]);
  });
});

describe("recentProjects", () => {
  it("returns published projects newest-updated first", () => {
    const result = recentProjects([
      project({ id: "a", updatedAt: "2026-01-01T00:00:00Z" }),
      project({ id: "b", updatedAt: "2026-02-01T00:00:00Z" })
    ]);

    expect(result.map(entry => entry.id)).toEqual(["b", "a"]);
  });

  it("excludes drafts and archived rows", () => {
    const result = recentProjects([
      project({ id: "draft", status: "draft" }),
      project({ id: "archived", status: "archived" }),
      project({ id: "published" })
    ]);

    expect(result.map(entry => entry.id)).toEqual(["published"]);
  });
});
