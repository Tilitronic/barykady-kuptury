import { describe, expect, it } from "vitest";

import {
  moveFeaturedProject,
  nextFeaturedRank,
  normalizeFeaturedOrder,
  reorderFeaturedProjects
} from "@/features/admin/featured/featuredOrder";

/**
 * T-030 — deterministic featured ordering (ticket TDD plan step 1).
 *
 * Design authority:
 *   - docs/PRODUCT_REQUIREMENTS.md §5/§6: administrators choose featured
 *     projects AND their order; the homepage honours it exactly.
 *   - docs/architecture.md §4: predictable ordering on the root row.
 *   - T-030 acceptance: "Ranks remain gap-free and unique after any add/
 *     remove/move sequence" and "Reordering is keyboard operable".
 *
 * The UI uses explicit Up/Down buttons (T-028 control); these pure helpers own
 * the position maths so every caller persists the same dense sequence.
 */

const IDS = ["a", "b", "c", "d"] as const;

describe("featured order", () => {
  it("moves a project up and down without changing the set", () => {
    expect(moveFeaturedProject(IDS, "c", "up")).toEqual(["a", "c", "b", "d"]);
    expect(moveFeaturedProject(IDS, "b", "down")).toEqual(["a", "c", "b", "d"]);
  });

  it("is a no-op at the ends and for an unknown id", () => {
    expect(moveFeaturedProject(IDS, "a", "up")).toEqual([...IDS]);
    expect(moveFeaturedProject(IDS, "d", "down")).toEqual([...IDS]);
    expect(moveFeaturedProject(IDS, "missing", "up")).toEqual([...IDS]);
  });

  it("assigns unique, gap-free ascending ranks", () => {
    const positions = normalizeFeaturedOrder(["c", "a", "d", "b"]);

    expect(positions).toEqual([
      { id: "c", rank: 1 },
      { id: "a", rank: 2 },
      { id: "d", rank: 3 },
      { id: "b", rank: 4 }
    ]);
    expect(new Set(positions.map(row => row.rank)).size).toBe(4);
  });

  it("reorders by explicit index (keyboard move-to semantics)", () => {
    expect(reorderFeaturedProjects(IDS, "d", 0)).toEqual(["d", "a", "b", "c"]);
    expect(reorderFeaturedProjects(IDS, "a", 3)).toEqual(["b", "c", "d", "a"]);
  });

  it("computes the next appended rank (1 for an empty list)", () => {
    expect(nextFeaturedRank([])).toBe(1);
    expect(nextFeaturedRank([1, 3, 2])).toBe(4);
    expect(nextFeaturedRank([4, 2])).toBe(5);
  });
});
