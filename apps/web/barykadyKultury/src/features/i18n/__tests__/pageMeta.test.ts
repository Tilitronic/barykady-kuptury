import { describe, expect, it } from "vitest";

import { applyPageMeta, NOT_FOUND_META } from "@/features/i18n/pageMeta";

/**
 * The URL contract (docs/architecture.md §8): "Set document lang, page title,
 * description ... appropriate to the active route."
 *
 * Route metadata now lives on the route records (`meta.pageMeta`) so the route
 * table is the single source of truth (T-011 follow-up defect). This module only
 * owns the not-found fallback constant and the DOM application.
 */
describe("page meta helper", () => {
  it("exposes the not-found fallback used when a route declares no metadata", () => {
    expect(NOT_FOUND_META).toEqual({
      titleKey: "notFound.title",
      descriptionKey: "notFound.description"
    });
  });

  it("writes the title and ensures a description meta tag", () => {
    const translate = (key: string) => `t:${key}`;

    applyPageMeta(
      document,
      { titleKey: "home.title", descriptionKey: "home.description" },
      translate
    );

    expect(document.title).toBe("t:home.title");
    expect(
      document
        .querySelector('meta[name="description"]')
        ?.getAttribute("content")
    ).toBe("t:home.description");
  });

  it("is a no-op without a document (non-browser)", () => {
    expect(() => applyPageMeta(null, NOT_FOUND_META, key => key)).not.toThrow();
  });
});
