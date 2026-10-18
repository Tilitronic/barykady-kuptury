import { describe, expect, it } from "vitest";
import { nextTick } from "vue";

import PublicationsPage from "@/pages/[locale]/publications.vue";
import { createFakeSupabase } from "@/test-utils/fakeSupabase";
import { mountWithPlugins } from "@/test-utils/mount";

/**
 * Spec axis (T-020): the listing shows published publications only, links
 * each card to the slug's owning locale (T-019 strict-slug precedent — no
 * dead links, no silent cross-locale resolution), and has translated
 * empty/unavailable states.
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
    publication_files: [
      {
        locale: "en",
        label: "EN file",
        storage_path: "fixtures/publications/a-en.pdf",
        mime_type: "application/pdf",
        file_size_bytes: 12345
      }
    ],
    ...overrides
  };
}

async function mountListing(
  supabase: ReturnType<typeof createFakeSupabase>["client"] | null,
  locale: "en" | "pl" | "uk" = "en"
) {
  const wrapper = await mountWithPlugins(PublicationsPage, {
    locale,
    supabase,
    initialRoute: `/${locale}/publications`,
    routes: [
      {
        path: "/:locale(en|pl|uk)/publications",
        name: "publications",
        component: PublicationsPage
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

describe("publications listing", () => {
  it("shows the translated empty state and fabricates nothing", async () => {
    const fake = createFakeSupabase({ tables: { publications: [] } });
    const wrapper = await mountListing(fake.client, "pl");

    expect(wrapper.text()).toContain("Brak dostępnych publikacji.");
    expect(wrapper.find(".publication-card").exists()).toBe(false);
  });

  it("renders published cards and never a draft row leaked into the payload", async () => {
    const fake = createFakeSupabase({
      tables: {
        publications: [
          publishedRow(),
          publishedRow({
            id: "00000000-0000-4000-8000-000000000499",
            status: "draft",
            publication_translations: [
              { ...EN_TRANSLATION, slug: "draft-leak", title: "DRAFT LEAK" }
            ]
          })
        ]
      }
    });
    const wrapper = await mountListing(fake.client, "en");

    expect(wrapper.findAll(".publication-card")).toHaveLength(1);
    expect(wrapper.text()).not.toContain("DRAFT LEAK");
  });

  it("links a same-locale card to the localized slug under the requested locale", async () => {
    const fake = createFakeSupabase({
      tables: { publications: [publishedRow()] }
    });
    const wrapper = await mountListing(fake.client, "pl");

    expect(wrapper.get(".publication-card__link").attributes("href")).toBe(
      "/pl/publications/przykladowa-publikacja"
    );
  });

  it("links an English-stand-in card to the English prefix, never a dead URL", async () => {
    const fake = createFakeSupabase({
      tables: {
        publications: [
          { ...publishedRow(), publication_translations: [EN_TRANSLATION] }
        ]
      }
    });
    const wrapper = await mountListing(fake.client, "uk");

    expect(wrapper.get(".publication-card__link").attributes("href")).toBe(
      "/en/publications/sample-publication"
    );
    expect(wrapper.get(".publication-card__fallback").text()).toContain(
      "англійською"
    );
  });

  it("keeps exactly one h1 and one h2 per card", async () => {
    const fake = createFakeSupabase({
      tables: { publications: [publishedRow()] }
    });
    const wrapper = await mountListing(fake.client, "en");

    expect(wrapper.findAll("h1")).toHaveLength(1);
    expect(wrapper.findAll("h2")).toHaveLength(1);
  });

  it("shows the unavailable state without a client", async () => {
    const wrapper = await mountListing(null, "en");

    expect(wrapper.text()).toContain("temporarily unavailable");
  });
});
