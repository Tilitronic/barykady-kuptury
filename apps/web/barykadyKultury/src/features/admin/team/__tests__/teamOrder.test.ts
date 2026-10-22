import { describe, expect, it } from "vitest";

import {
  moveTeamMember,
  nextSortOrder,
  normalizeTeamOrder,
  reorderTeamMembers
} from "@/features/admin/team/teamOrder";

/**
 * T-028 — deterministic team ordering (ticket TDD plan step 2).
 *
 * Design authority:
 *   - docs/PRODUCT_REQUIREMENTS.md §4-About: team members are presented
 *     consistently; the order is editorial.
 *   - docs/architecture.md §4: roots carry locale-independent ordering.
 *   - T-028 acceptance: "Team reorder persists, is collision-free, and is
 *     keyboard operable." The UI provides up/down buttons; this module owns
 *     the position maths so every caller writes the same 1..n sequence.
 */

const IDS = ["a", "b", "c", "d"] as const;

describe("team order", () => {
  it("moves a member up and down without changing the set", () => {
    expect(moveTeamMember(IDS, "c", "up")).toEqual(["a", "c", "b", "d"]);
    expect(moveTeamMember(IDS, "b", "down")).toEqual(["a", "c", "b", "d"]);
  });

  it("is a no-op at the ends", () => {
    expect(moveTeamMember(IDS, "a", "up")).toEqual([...IDS]);
    expect(moveTeamMember(IDS, "d", "down")).toEqual([...IDS]);
  });

  it("ignores an unknown member id", () => {
    expect(moveTeamMember(IDS, "missing", "up")).toEqual([...IDS]);
  });

  it("assigns unique, gap-free ascending sort_order values", () => {
    const positions = normalizeTeamOrder(["c", "a", "d", "b"]);

    expect(positions).toEqual([
      { id: "c", sortOrder: 1 },
      { id: "a", sortOrder: 2 },
      { id: "d", sortOrder: 3 },
      { id: "b", sortOrder: 4 }
    ]);
    expect(new Set(positions.map(row => row.sortOrder)).size).toBe(4);
  });

  it("reorders by explicit index (before/after semantics)", () => {
    expect(reorderTeamMembers(IDS, "d", 0)).toEqual(["d", "a", "b", "c"]);
    expect(reorderTeamMembers(IDS, "a", 3)).toEqual(["b", "c", "d", "a"]);
  });

  it("computes the next free position for a new member", () => {
    expect(nextSortOrder([])).toBe(1);
    expect(nextSortOrder([1, 3, 2])).toBe(4);
    expect(nextSortOrder([4, 2])).toBe(5);
  });
});
