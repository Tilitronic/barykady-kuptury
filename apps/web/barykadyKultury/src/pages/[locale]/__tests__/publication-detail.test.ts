import { describe, expect, it } from "vitest";
import { Quasar } from "quasar";
import { nextTick } from "vue";

import PublicationDetailPage from "@/pages/[locale]/publication-detail.vue";
import { createFakeSupabase } from "@/test-utils/fakeSupabase";
import { mountWithPlugins } from "@/test-utils/mount";

/**
 * Spec axis (T-020, canonical slug by T-038/D-24): the detail renders one h1,
 * full abstract, authors, date, and each language file as a distinct labelled
 * download — or the external link — or NO action. One canonical slug serves
 * every locale; an unknown, former-localized or draft slug renders the
 * translated 404 content, and a missing requested-locale translation does too.
 */

const CANONICAL_SLUG = "sample-publication";

const EN_TRANSLATION = {
  locale: "en",
  title: "Sample Publication (EN)",
  abstract: "Abstract (EN)",
  authors: "Author One"
};

const PL_TRANSLATION = {
  locale: "pl",
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
    slug: CANONICAL_SLUG,
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
    plugins: [Quasar],
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
  it("offers the original download only when the owner opted in (T-041 S4)", async () => {
    const readerTranslations = [
      {
        ...EN_TRANSLATION,
        body: "Reader body text",
        body_ast: null,
        body_ast_version: null
      },
      PL_TRANSLATION
    ];

    const off = await mountDetail(
      createFakeSupabase({
        tables: {
          publications: [
            publishedRow({ publication_translations: readerTranslations })
          ],
          content_assets: [],
          publication_files: []
        }
      }).client,
      "en",
      CANONICAL_SLUG
    );
    expect(off.find("[data-testid='download-original']").exists()).toBe(false);

    const on = await mountDetail(
      createFakeSupabase({
        tables: {
          publications: [
            publishedRow({
              allow_original_download: true,
              publication_translations: readerTranslations
            })
          ],
          content_assets: [],
          publication_files: []
        }
      }).client,
      "en",
      CANONICAL_SLUG
    );
    const link = on.get("[data-testid='download-original']");
    expect(link.attributes("href")).toBe(
      "/.netlify/functions/content-original?kind=publication&slug=sample-publication"
    );
  });

  it("renders the requested-locale publication through the canonical slug", async () => {
    const fake = createFakeSupabase({
      tables: { publications: [publishedRow()] }
    });
    const wrapper = await mountDetail(fake.client, "pl", CANONICAL_SLUG);

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
    const wrapper = await mountDetail(fake.client, "en", CANONICAL_SLUG);

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
    const wrapper = await mountDetail(fake.client, "en", CANONICAL_SLUG);

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
    const wrapper = await mountDetail(fake.client, "en", CANONICAL_SLUG);

    expect(wrapper.find(".publication-files__link").exists()).toBe(false);
    expect(wrapper.find(".publication-files__external-link").exists()).toBe(
      false
    );
    // Only the back link remains.
    expect(wrapper.findAll("a")).toHaveLength(1);
  });

  it("renders the requested-locale translation as-is — never a silent English mix-in", async () => {
    // The uk row exists (title only; abstract/authors are optional), so the
    // requested-locale translation renders Ukrainian text and omits the absent
    // fields. English never stands in while the requested locale is usable.
    const ukTitleOnly = {
      locale: "uk",
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
    const wrapper = await mountDetail(fake.client, "uk", CANONICAL_SLUG);

    expect(wrapper.get("h1").text()).toBe("Зразкова публікація");
    expect(wrapper.text()).not.toContain("Abstract (EN)");
    expect(wrapper.find(".publication-detail__abstract").exists()).toBe(false);
  });

  it("renders the 404 content — not the publication — when the requested locale has no translation", async () => {
    const fake = createFakeSupabase({
      tables: {
        publications: [
          publishedRow({ publication_translations: [EN_TRANSLATION] })
        ]
      }
    });
    const wrapper = await mountDetail(fake.client, "pl", CANONICAL_SLUG);

    expect(wrapper.get("h1").text()).toBe("Nie znaleziono strony");
    expect(wrapper.text()).not.toContain("Sample Publication (EN)");
  });

  it("gives the 404 branch a localized way back to the listing", async () => {
    const fake = createFakeSupabase({ tables: { publications: [] } });
    const wrapper = await mountDetail(fake.client, "en", "no-such-publication");

    const back = wrapper.get(".publication-not-found__back-link");
    expect(back.attributes("href")).toBe("/en/publications");
    expect(back.text()).toBe("Back to publications");
  });

  it("renders the 404 content for a former localized slug", async () => {
    const fake = createFakeSupabase({
      tables: { publications: [publishedRow()] }
    });
    const wrapper = await mountDetail(
      fake.client,
      "pl",
      "przykladowa-publikacja"
    );

    expect(wrapper.get("h1").text()).toBe("Nie znaleziono strony");
    expect(wrapper.text()).not.toContain("Przykladowa publikacja (PL)");
  });

  it("renders the 404 content for a draft slug even when the payload leaks it", async () => {
    const draft = publishedRow({
      id: "00000000-0000-4000-8000-000000000499",
      slug: "draft-leak",
      status: "draft",
      publication_translations: [{ ...EN_TRANSLATION, title: "DRAFT LEAK" }]
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

  describe("publication reader (T-040)", () => {
    it("renders body content through LongFormReader and switches via ?lang", async () => {
      const fake = createFakeSupabase({
        tables: {
          publications: [
            publishedRow({
              publication_translations: [
                { ...EN_TRANSLATION, body: "## Summary\n\nEnglish body text." },
                { ...PL_TRANSLATION, body: "## Streszczenie\n\nPolski tekst." }
              ]
            })
          ]
        }
      });
      const wrapper = await mountDetail(fake.client, "en", CANONICAL_SLUG);

      expect(wrapper.get("h1").text()).toBe("Sample Publication (EN)");
      expect(wrapper.text()).toContain("English body text.");
      // Files stay page-owned metadata below the reader body.
      expect(wrapper.text()).toContain("Available files");
      // rev-1 E: bibliographic identity renders in the reader branch too.
      expect(wrapper.text()).toContain("Author One");
      expect(wrapper.find("time").exists()).toBe(true);

      await wrapper
        .get('[data-testid="reader-language"] button[lang="pl"]')
        .trigger("click");
      await flushPromises();

      const route = wrapper.vm.$router.currentRoute.value;
      // D-27: content language is a query change — the route locale stays.
      expect(route.path).toBe(`/en/publications/${CANONICAL_SLUG}`);
      expect(route.query.lang).toBe("pl");
      expect(wrapper.text()).toContain("Polski tekst.");
    });

    it("keeps the metadata-only view (no reader controls) without body data", async () => {
      const fake = createFakeSupabase({
        tables: { publications: [publishedRow()] }
      });
      const wrapper = await mountDetail(fake.client, "en", CANONICAL_SLUG);

      expect(wrapper.find('[data-testid="reader-language"]').exists()).toBe(
        false
      );
      expect(wrapper.find('[data-testid="reader-controls"]').exists()).toBe(
        false
      );
      expect(wrapper.text()).toContain("Abstract (EN)");
    });
  });
});
