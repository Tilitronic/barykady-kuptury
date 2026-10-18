import { describe, expect, it } from "vitest";

import PublicationCard from "@/components/publications/PublicationCard.vue";
import type { PublicationView } from "@/features/publications/usePublications";
import { mountWithPlugins } from "@/test-utils/mount";

/**
 * Spec axis: docs/tickets/T-020-publications-public.md — the card shows title,
 * abstract, authors, date, language badge and a file/URL availability
 * indicator; missing optional metadata renders nothing (never invented).
 */

function publicationView(
  overrides: Partial<PublicationView> = {}
): PublicationView {
  return {
    id: "00000000-0000-4000-8000-000000000401",
    status: "published",
    slug: "sample-publication",
    title: "Sample Publication",
    abstract: "A fictional abstract.",
    authors: "Sample Author",
    language: "en",
    publicationDate: "2026-02-01",
    externalUrl: null,
    sortOrder: 1,
    files: [
      {
        locale: "en",
        label: "EN file",
        storagePath: "fixtures/publications/a-en.pdf",
        mimeType: "application/pdf",
        sizeBytes: 12345,
        downloadUrl: "https://cdn.test/public-documents/a-en.pdf"
      }
    ],
    isFallback: false,
    updatedAt: "2026-02-01T09:00:00Z",
    ...overrides
  };
}

async function mountCard(
  publication: PublicationView,
  options: { href?: string; locale?: "en" | "pl" | "uk" } = {}
) {
  const locale = options.locale ?? "en";

  return mountWithPlugins(PublicationCard, {
    locale,
    props: {
      publication,
      href: options.href ?? `/${locale}/publications/${publication.slug}`
    },
    initialRoute: `/${locale}/publications`
  });
}

describe("PublicationCard", () => {
  it("links the title as a real anchor", async () => {
    const wrapper = await mountCard(publicationView());

    const link = wrapper.get(".publication-card__link");
    expect(link.element.tagName).toBe("A");
    expect(link.attributes("href")).toBe("/en/publications/sample-publication");
    expect(wrapper.get(".publication-card__title").text()).toBe(
      "Sample Publication"
    );
  });

  it("shows the language badge and the date", async () => {
    const wrapper = await mountCard(publicationView());

    expect(wrapper.get(".publication-card__language").text()).toBe("English");
    expect(
      wrapper.get(".publication-card__date time").attributes("datetime")
    ).toBe("2026-02-01");
  });

  it("shows a download availability indicator when files exist", async () => {
    const wrapper = await mountCard(publicationView());

    expect(wrapper.get(".publication-card__availability").text()).toBe(
      "Download"
    );
  });

  it("shows an online indicator for the external-URL variant", async () => {
    const wrapper = await mountCard(
      publicationView({
        files: [],
        externalUrl: "https://example.org/x"
      })
    );

    expect(wrapper.get(".publication-card__availability").text()).toBe(
      "Online"
    );
  });

  it("renders no availability indicator when there is nothing to open", async () => {
    const wrapper = await mountCard(publicationView({ files: [] }));

    expect(wrapper.find(".publication-card__availability").exists()).toBe(
      false
    );
  });

  it("omits missing authors, abstract and date cleanly (TDD plan step 3)", async () => {
    const wrapper = await mountCard(
      publicationView({
        abstract: null,
        authors: null,
        publicationDate: null,
        language: null
      })
    );

    expect(wrapper.find(".publication-card__abstract").exists()).toBe(false);
    expect(wrapper.find(".publication-card__authors").exists()).toBe(false);
    expect(wrapper.find(".publication-card__date").exists()).toBe(false);
    expect(wrapper.find(".publication-card__language").exists()).toBe(false);
    // The title still renders — nothing is invented around it.
    expect(wrapper.get(".publication-card__title").text()).toBe(
      "Sample Publication"
    );
  });

  it("names the source language when the English translation stands in", async () => {
    const wrapper = await mountCard(
      publicationView({ title: "Sample (EN)", isFallback: true }),
      { locale: "pl" }
    );

    expect(wrapper.get(".publication-card__fallback").text()).toContain(
      "angielsku"
    );
  });
});
