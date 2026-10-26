import { beforeEach, describe, expect, it } from "vitest";

import {
  applySeoHead,
  buildSeoHead,
  type SeoHeadInput
} from "@/features/seo/seoHead";

/**
 * T-034 — canonical / hreflang / Open Graph contract.
 *
 * docs/architecture.md §8: "Set document lang, page title, description, and link
 * metadata appropriate to the active route." The route prefix is the only
 * locale signal in a URL (D-24: one canonical slug shared by every locale), so
 * the alternate graph is a pure prefix swap — this suite pins that property
 * before any DOM code depends on it.
 */

const SITE = "https://example.org";

function input(overrides: Partial<SeoHeadInput> = {}): SeoHeadInput {
  return {
    pageMeta: {
      titleKey: "projects.title",
      descriptionKey: "projects.description"
    },
    locale: "pl",
    path: "/pl/projects",
    noindex: false,
    siteUrl: SITE,
    translate: key => `t:${key}`,
    ...overrides
  };
}

describe("buildSeoHead", () => {
  it("derives title, description, canonical and Open Graph fields", () => {
    const head = buildSeoHead(input());

    expect(head.title).toBe("t:projects.title");
    expect(head.description).toBe("t:projects.description");
    expect(head.canonical).toBe(`${SITE}/pl/projects`);
    expect(head.og).toEqual({
      title: "t:projects.title",
      description: "t:projects.description",
      url: `${SITE}/pl/projects`,
      type: "website",
      siteName: "t:app.name",
      locale: "pl"
    });
  });

  it("emits one alternate per supported locale plus x-default → English", () => {
    const head = buildSeoHead(input());

    expect(head.alternates).toEqual([
      { locale: "en", href: `${SITE}/en/projects` },
      { locale: "pl", href: `${SITE}/pl/projects` },
      { locale: "uk", href: `${SITE}/uk/projects` }
    ]);
    // x-default is the language-neutral fallback; English is the product
    // default (docs/PRODUCT_REQUIREMENTS.md §2), not an arbitrary choice.
    expect(head.xDefault).toBe(`${SITE}/en/projects`);
  });

  it("normalises a trailing slash and a trailing slash on the site origin", () => {
    const head = buildSeoHead(
      input({ path: "/uk/projects/", siteUrl: `${SITE}/` })
    );

    expect(head.canonical).toBe(`${SITE}/uk/projects`);
  });

  it("omits canonical and alternates for noindex routes", () => {
    const head = buildSeoHead(input({ path: "/en/admin", noindex: true }));

    expect(head.noindex).toBe(true);
    expect(head.canonical).toBeNull();
    expect(head.alternates).toEqual([]);
    expect(head.xDefault).toBeNull();
  });

  it("omits canonical and alternates when the URL carries no locale prefix", () => {
    // The global 404 (/xx/...) is not a localized public destination, so it has
    // no alternate graph to advertise.
    const head = buildSeoHead(input({ path: "/xx/unknown" }));

    expect(head.canonical).toBeNull();
    expect(head.alternates).toEqual([]);
  });

  it("keeps the canonical free of query strings (reader ?lang=, D-27)", () => {
    // `to.path` never contains a query, but pin the contract here because the
    // reader language is explicitly a query parameter and must not fork URLs
    // in the canonical graph.
    const head = buildSeoHead(
      input({ path: "/pl/about/documents/regulations" })
    );

    expect(head.canonical).toBe(`${SITE}/pl/about/documents/regulations`);
    expect(head.alternates.map(alternate => alternate.href)).toEqual([
      `${SITE}/en/about/documents/regulations`,
      `${SITE}/pl/about/documents/regulations`,
      `${SITE}/uk/about/documents/regulations`
    ]);
  });
});

describe("applySeoHead", () => {
  beforeEach(() => {
    document.head
      .querySelectorAll("[data-bk-seo]")
      .forEach(node => node.remove());
  });

  it("writes canonical, hreflang alternates and Open Graph tags", () => {
    applySeoHead(document, buildSeoHead(input()));

    expect(
      document.querySelector('link[rel="canonical"]')?.getAttribute("href")
    ).toBe(`${SITE}/pl/projects`);

    const alternates = [
      ...document.querySelectorAll('link[rel="alternate"][hreflang]')
    ].map(link => [link.getAttribute("hreflang"), link.getAttribute("href")]);
    expect(alternates).toEqual([
      ["en", `${SITE}/en/projects`],
      ["pl", `${SITE}/pl/projects`],
      ["uk", `${SITE}/uk/projects`],
      ["x-default", `${SITE}/en/projects`]
    ]);

    expect(
      document
        .querySelector('meta[property="og:title"]')
        ?.getAttribute("content")
    ).toBe("t:projects.title");
    expect(
      document.querySelector('meta[property="og:url"]')?.getAttribute("content")
    ).toBe(`${SITE}/pl/projects`);
    expect(document.querySelector('meta[name="robots"]')).toBeNull();
  });

  it("replaces the previous route's tags instead of accumulating them", () => {
    applySeoHead(document, buildSeoHead(input()));
    applySeoHead(
      document,
      buildSeoHead(input({ path: "/uk/about", locale: "uk" }))
    );

    expect(document.querySelectorAll('link[rel="canonical"]').length).toBe(1);
    expect(
      document.querySelectorAll('link[rel="alternate"][hreflang]').length
    ).toBe(4);
    expect(
      document.querySelector('meta[property="og:url"]')?.getAttribute("content")
    ).toBe(`${SITE}/uk/about`);
  });

  it("writes noindex and strips canonical graph on private routes", () => {
    applySeoHead(document, buildSeoHead(input()));
    applySeoHead(
      document,
      buildSeoHead(input({ path: "/en/admin", locale: "en", noindex: true }))
    );

    expect(
      document.querySelector('meta[name="robots"]')?.getAttribute("content")
    ).toBe("noindex, nofollow");
    expect(document.querySelector('link[rel="canonical"]')).toBeNull();
    expect(
      document.querySelectorAll('link[rel="alternate"][hreflang]').length
    ).toBe(0);
    expect(document.querySelector('meta[property="og:url"]')).toBeNull();
  });

  it("is a no-op without a document (non-browser)", () => {
    expect(() => applySeoHead(null, buildSeoHead(input()))).not.toThrow();
  });
});
