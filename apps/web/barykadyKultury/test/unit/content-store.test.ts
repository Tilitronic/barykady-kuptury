import { describe, expect, it } from "vitest";

import { sortRows } from "../../e2e/support/content-store";

/**
 * T-028 gate fix — the E2E mock must sort numeric PostgREST columns as
 * numbers. The previous implementation stringified every cell and used
 * `localeCompare`, which orders 1, 10, 2. That would hide a real regression in
 * the admin reorder journey once a team has more than nine members.
 */
describe("content-store PostgREST ordering", () => {
  it("sorts numeric sort_order values numerically (2 before 10)", () => {
    const rows = [
      { id: "ten", sort_order: 10 },
      { id: "two", sort_order: 2 },
      { id: "one", sort_order: 1 }
    ];

    expect(sortRows(rows, "sort_order.asc").map(row => row.id)).toEqual([
      "one",
      "two",
      "ten"
    ]);
    expect(sortRows(rows, "sort_order.desc").map(row => row.id)).toEqual([
      "ten",
      "two",
      "one"
    ]);
  });

  it("still sorts text columns deterministically", () => {
    const rows = [{ name: "Zeta" }, { name: "Alpha" }, { name: "Beta" }];

    expect(sortRows(rows, "name.asc").map(row => row.name)).toEqual([
      "Alpha",
      "Beta",
      "Zeta"
    ]);
  });
});
