import { describe, expect, it } from "vitest";
import { nextTick } from "vue";

import PublicationDetailPage from "@/pages/[locale]/publication-detail.vue";
import { createFakeSupabase } from "@/test-utils/fakeSupabase";
import { mountWithPlugins } from "@/test-utils/mount";

/**
 * Spec axis (T-020): the detail renders one h1, full abstract, authors, date,
 * and each language file as a distinct labelled download — or the external
 * link — or NO action. Strict (locale, slug): draft/foreign/unknown slugs
 * render the translated 404 content (T-019 precedent).
 */

const EN_TRANSLATION = {
  locale: "en",
  slug: "sample-publication",
  title: "Sample Publication (EN)",
  abstract: "Abstract (EN)",
  authors: "Author One"
};

const PL_TRANSLATION = {
  locale: "pl",
  slug: "przykladowa-publikacja",
  title: "Przykladowa publikacja (PL)",
  abstract: "Streszczenie (PL)",
  authors: "Autor Dwaj"
};

const FILES = [
  {
    locale: "en",
    label: "Sample PDF (English, fictional)",
    storage_path: "fixtures/publications/sample-publication-en.pdf",
    mime_type: "application/pdf",
    file_size_bytes: 12345
  },
  {
    locale: "pl",
    label: "Sample PDF (Polish, fictional)",
    storage_path: "fixtures/publications/sample-publication-pl.pdf",
    mime_type: "application/pdf",
    file_size_bytes: 23456
  }
];

function publishedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-4000-8000-000000000401",
    status: "published",
    language: "en",
    publication_date: "2026-02-01",
    external_url: null,
    sort_order: 1,
    updated_at: "2026-02-01T09:00:00Z",
    publication_translations: [EN_TRANSLATION, PL_TRANSLATION],
    publication_files: FILES,
    ...overrides
  };
}

async function mountDetail(
  supabase: ReturnType<typeof createFakeSupabase>["client"] | null,
  locale: "en" | "pl" | "uk",
  slug: string
) {
  const wrapper = await mountWithPlugins(PublicationDetailPage, {
    locale,
    supabase,
    initialRoute: `/${locale}/publications/${slug}`,
    routes: [
      {
        path: "/:locale(en|pl|uk)/publications/:slug",
        name: "publication-detail",
        component: PublicationDetailPage
      },
      {
        path: "/:locale(en|pl|uk)/publications",
        name: "publications",
        component: { template: "<div />" }
      }
    ]
  });

  await flushPromises();
  return wrapper;
}

async function flushPromises() {
  await nextTick();
  await new Promise(resolve => setTimeout(resolve, 0));
}

describe("publication detail", () => {
  it("renders the localized publication with one h1 and both file versions", async () => {
    const fake = createFakeSupabase({
      tables: { publications: [publishedRow()] }
    });
    const wrapper = await mountDetail(
      fake.client,
      "pl",
      "przykladowa-publikacja"
    );

    expect(wrapper.findAll("h1")).toHaveLength(1);
    expect(wrapper.get("h1").text()).toBe("Przykladowa publikacja (PL)");
    expect(wrapper.text()).toContain("Streszczenie (PL)");
    expect(wrapper.text()).toContain("Autor Dwaj");
    expect(
      wrapper.get(".publication-detail__date time").attributes("datetime")
    ).toBe("2026-02-01");

    const links = wrapper.findAll(".publication-files__link");
    expect(links).toHaveLength(2);
    expect(links[0]?.attributes("href")).toContain(
      "public-documents/fixtures/publications/sample-publication-en.pdf?download=sample-publication-en.pdf"
    );
    expect(wrapper.get(".publication-detail__files-heading").text()).toBe(
      "Dostępne pliki"
    );
  });

  it("links back to the listing under the current locale", async () => {
    const fake = createFakeSupabase({
      tables: { publications: [publishedRow()] }
    });
    const wrapper = await mountDetail(fake.client, "en", "sample-publication");

    const back = wrapper.get(".publication-detail__back-link");
    expect(back.attributes("href")).toBe("/en/publications");
    expect(back.text()).toBe("Back to publications");
  });

  it("renders the external link safely when there are no files", async () => {
    const fake = createFakeSupabase({
      tables: {
        publications: [
          publishedRow({
            external_url: "https://example.org/fictional-sample-publication",
            publication_files: [],
            publication_translations: [
              { ...EN_TRANSLATION, abstract: null, authors: null }
            ]
          })
        ]
      }
    });
    const wrapper = await mountDetail(fake.client, "en", "sample-publication");

    const link = wrapper.get(".publication-files__external-link");
    expect(link.attributes("target")).toBe("_blank");
    expect(link.attributes("rel")).toBe("noopener noreferrer");
    // Missing optional abstract/authors render nothing (never invented).
    expect(wrapper.find(".publication-detail__abstract").exists()).toBe(false);
    expect(wrapper.find(".publication-detail__authors").exists()).toBe(false);
    expect(wrapper.find(".publication-detail__files-heading").exists()).toBe(
      false
    );
  });

  it("renders no download action when neither files nor an external URL exist", async () => {
    const fake = createFakeSupabase({
      tables: {
        publications: [
          publishedRow({ publication_files: [], external_url: null })
        ]
      }
    });
    const wrapper = await mountDetail(fake.client, "en", "sample-publication");

    expect(wrapper.find(".publication-files__link").exists()).toBe(false);
    expect(wrapper.find(".publication-files__external-link").exists()).toBe(
      false
    );
    // Only the back link remains.
    expect(wrapper.findAll("a")).toHaveLength(1);
  });

  it("renders the requested-locale translation as-is — never a silent English mix-in", async () => {
    // The uk row exists (title only; abstract/authors are optional), so the
    // strict (uk, slug) match renders Ukrainian text and omits the absent
    // fields. English never stands in while the requested locale is usable
    // (selectTranslation rule: never a silent mix), and with
    // PUBLICATION_REQUIRED_FIELDS = [title] + the DB non-blank title
    // constraint, an isFallback detail is unreachable — the listing card
    // covers visible fallback surfacing.
    const ukTitleOnly = {
      locale: "uk",
      slug: "zrazkova-publikatsiia",
      title: "Зразкова публікація",
      abstract: null,
      authors: null
    };
    const fake = createFakeSupabase({
      tables: {
        publications: [
          publishedRow({
            publication_translations: [EN_TRANSLATION, ukTitleOnly]
          })
        ]
      }
    });
    const wrapper = await mountDetail(
      fake.client,
      "uk",
      "zrazkova-publikatsiia"
    );

    expect(wrapper.get("h1").text()).toBe("Зразкова публікація");
    expect(wrapper.text()).not.toContain("Abstract (EN)");
    expect(wrapper.find(".publication-detail__abstract").exists()).toBe(false);
    expect(wrapper.find(".publication-detail__fallback").exists()).toBe(false);
  });

  it("renders the 404 content — not the publication — when an English slug is used on a Polish URL", async () => {
    const fake = createFakeSupabase({
      tables: { publications: [publishedRow()] }
    });
    const wrapper = await mountDetail(fake.client, "pl", "sample-publication");

    expect(wrapper.get("h1").text()).toBe("Nie znaleziono strony");
    expect(wrapper.text()).not.toContain("Sample Publication (EN)");
  });

  it("renders the 404 content for a draft slug even when the payload leaks it", async () => {
    const draft = publishedRow({
      id: "00000000-0000-4000-8000-000000000499",
      status: "draft",
      publication_translations: [
        { ...EN_TRANSLATION, slug: "draft-leak", title: "DRAFT LEAK" }
      ]
    });
    const fake = createFakeSupabase({
      tables: { publications: [publishedRow(), draft] }
    });
    const wrapper = await mountDetail(fake.client, "en", "draft-leak");

    expect(wrapper.get("h1").text()).toBe("Page not found");
    expect(wrapper.text()).not.toContain("DRAFT LEAK");
  });

  it("shows the unavailable state without a client", async () => {
    const wrapper = await mountDetail(null, "en", "any");

    expect(wrapper.text()).toContain("temporarily unavailable");
  });
});
