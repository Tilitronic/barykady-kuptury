import { describe, expect, it } from "vitest";

import { fetchPublishedPage } from "@/features/content/api";
import { createFakeSupabase } from "@/test-utils/fakeSupabase";

/**
 * Spec axis: docs/tickets/T-015-typed-data-access.md — content pages are read
 * through a typed select that returns a domain model (T-016 consumes this).
 * The fake client proves the published + page-key filter and the mapping.
 */
const EN_TRANSLATION = {
  locale: "en",
  slug: "about",
  title: "About us",
  body: "Body (EN)",
  meta_description: "About the association"
};

function pageRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-4000-8000-000000000101",
    page_key: "about",
    status: "published",
    updated_at: "2026-01-05T12:00:00Z",
    site_page_translations: [EN_TRANSLATION],
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

describe("fetchPublishedPage", () => {
  it("filters by the stable page key and published status", async () => {
    const fake = createFakeSupabase({ tables: { site_pages: [] } });

    await fetchPublishedPage(fake.client, "about", "en");

    expect(eqValue(fake.calls, "page_key")).toEqual(["about"]);
    expect(eqValue(fake.calls, "status")).toEqual(["published"]);
  });

  it("maps the joined row to a locale-resolved domain model", async () => {
    const fake = createFakeSupabase({ tables: { site_pages: [pageRow()] } });

    const result = await fetchPublishedPage(fake.client, "about", "en");
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;

    const [page] = result.items;
    expect(page!.pageKey).toBe("about");
    expect(page!.title).toBe("About us");
    expect(page!.metaDescription).toBe("About the association");
    expect(page!.isFallback).toBe(false);
    expect(Object.keys(page!)).not.toContain("page_key");
  });

  it("returns the empty state when the page is not published", async () => {
    const fake = createFakeSupabase({ tables: { site_pages: [] } });

    expect(await fetchPublishedPage(fake.client, "about", "en")).toEqual({
      kind: "empty"
    });
  });

  it("returns the unavailable state without a client", async () => {
    expect(await fetchPublishedPage(null, "about", "en")).toEqual({
      kind: "unavailable"
    });
  });
});
