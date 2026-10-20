import { beforeEach, describe, expect, it } from "vitest";

import {
  fetchPublishedPublicationYears,
  resetPublicationYearsCache
} from "@/features/search/api";
import { createFakeSupabase } from "@/test-utils/fakeSupabase";

/**
 * T-039 review fix (years wiring): the header search feeds REAL publication
 * years into the navigation index. The query is the published-only projection
 * (RLS is the boundary — same contract as every other read), deduplicated and
 * newest-first; failures resolve to `[]` so the dialog never blocks on them.
 */

beforeEach(() => {
  resetPublicationYearsCache();
});

describe("fetchPublishedPublicationYears", () => {
  it("extracts, dedupes and sorts years newest-first", async () => {
    const fake = createFakeSupabase({
      tables: {
        publications: [
          { publication_date: "2025-03-01" },
          { publication_date: "2026-01-15" },
          { publication_date: "2025-07-01" },
          { publication_date: null }
        ]
      }
    });

    expect(await fetchPublishedPublicationYears(fake.client)).toEqual([
      2026, 2025
    ]);
  });

  it("is cached per page session (one query, many callers)", async () => {
    const fake = createFakeSupabase({
      tables: { publications: [{ publication_date: "2026-01-01" }] }
    });

    const first = await fetchPublishedPublicationYears(fake.client);
    const second = await fetchPublishedPublicationYears(fake.client);

    expect(first).toEqual([2026]);
    expect(second).toEqual([2026]);
    const eqCalls = fake.calls.filter(c => c.method === "eq");
    // Exactly one `status=eq.published` filter ran — the second caller hit
    // the module cache instead of re-querying.
    expect(eqCalls).toHaveLength(1);
  });

  it("resolves empty without a client and on query failure", async () => {
    expect(await fetchPublishedPublicationYears(null)).toEqual([]);

    resetPublicationYearsCache();
    const failing = createFakeSupabase({ error: { message: "down" } });
    expect(await fetchPublishedPublicationYears(failing.client)).toEqual([]);
  });
});
