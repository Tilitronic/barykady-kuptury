import { describe, expect, it } from "vitest";

import { applyPageMeta, pageMetaForPath } from "@/features/i18n/pageMeta";

/**
 * The URL contract (docs/architecture.md §8): "Set document lang, page title,
 * description ... appropriate to the active route." Title/description are keyed
 * off the locale-stripped path so the same route in any locale shares metadata.
 */
describe("page meta helper", () => {
  it("maps a locale-prefixed home path to the home meta", () => {
    expect(pageMetaForPath("/pl")).toEqual({
      titleKey: "home.title",
      descriptionKey: "home.description"
    });
  });

  it("maps a locale-prefixed sub-route to the same meta in every locale", () => {
    expect(pageMetaForPath("/en/projects")).toEqual(
      pageMetaForPath("/uk/projects")
    );
  });

  it("uses the not-found meta for unknown paths and the 404 route", () => {
    const notFound = {
      titleKey: "notFound.title",
      descriptionKey: "notFound.description"
    };
    expect(pageMetaForPath("/xx")).toEqual(notFound);
    expect(pageMetaForPath("/404")).toEqual(notFound);
  });

  it("writes the title and ensures a description meta tag", () => {
    const translate = (key: string) => `t:${key}`;

    applyPageMeta(document, pageMetaForPath("/pl"), translate);

    expect(document.title).toBe("t:home.title");
    expect(
      document
        .querySelector('meta[name="description"]')
        ?.getAttribute("content")
    ).toBe("t:home.description");
  });
});
