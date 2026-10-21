import { describe, expect, it } from "vitest";
import { nextTick } from "vue";
import { Quasar } from "quasar";

import DocumentReaderPage from "@/pages/[locale]/about-document.vue";
import { createFakeSupabase } from "@/test-utils/fakeSupabase";
import { mountWithPlugins } from "@/test-utils/mount";

/**
 * T-017 → T-040 — the document reader is the shared `LongFormReader`.
 *
 * Spec axis: legacy plain-text rows still render (D-38) through the safe
 * rich-text path; content language is `?lang=` and NEVER the route locale
 * (D-27); the fallback note names English (D-12); the back link goes to the
 * consolidated About `#documents` anchor (T-039 m8); unknown/draft slugs are
 * 404 content, and a failed read never blanks the shell.
 */

function translation(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-4000-8000-000000000602",
    document_id: "00000000-0000-4000-8000-000000000601",
    locale: "en",
    title: "Regulations of the Ordinary Association",
    description: null,
    body: "## § 1\n\nThe association operates on the basis of Polish law.",
    body_ast: null,
    body_ast_version: null,
    needs_review: false,
    created_at: "2026-01-05T12:00:00Z",
    updated_at: "2026-01-05T12:00:00Z",
    ...overrides
  };
}

function documentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-4000-8000-000000000601",
    slug: "regulations",
    status: "published",
    document_type: "regulations",
    language: null,
    storage_path: null,
    mime_type: null,
    file_size_bytes: null,
    publication_date: null,
    sort_order: 1,
    published_at: "2026-01-05T12:00:00Z",
    created_at: "2026-01-05T12:00:00Z",
    updated_at: "2026-01-05T12:00:00Z",
    source_provider: "manual",
    source_path: null,
    source_mime: null,
    source_external_id: null,
    source_synced_at: null,
    allow_original_download: false,
    organization_document_translations: [
      translation(),
      translation({
        id: "00000000-0000-4000-8000-000000000603",
        locale: "pl",
        title: "Regulamin działalności stowarzyszenia zwykłego",
        body: "## § 1\n\nStowarzyszenie działa na podstawie prawa polskiego."
      })
    ],
    ...overrides
  };
}

async function mountReader(
  supabase: ReturnType<typeof createFakeSupabase>["client"] | null,
  path = "/en/about/documents/regulations",
  locale: "en" | "pl" | "uk" = "en"
) {
  const wrapper = await mountWithPlugins(DocumentReaderPage, {
    locale,
    supabase,
    plugins: [Quasar],
    initialRoute: path,
    routes: [
      {
        path: "/:locale(en|pl|uk)/about/documents/:slug",
        name: "about-document",
        component: DocumentReaderPage
      },
      {
        path: "/:locale(en|pl|uk)/about",
        name: "about",
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
  await nextTick();
}

describe("document reader (T-040)", () => {
  it("renders the legacy plain-text body through the safe rich-text path", async () => {
    const fake = createFakeSupabase({
      tables: { organization_documents: [documentRow()] }
    });
    const wrapper = await mountReader(fake.client);

    expect(wrapper.text()).toContain("Regulations of the Ordinary Association");
    expect(wrapper.find(".localized-rich-text").exists()).toBe(true);
    expect(wrapper.get("h1").text()).toBe(
      "Regulations of the Ordinary Association"
    );
    expect(wrapper.findAll("h1")).toHaveLength(1);
  });

  it("offers the original download only when the owner opted in (T-041 S4)", async () => {
    const off = await mountReader(
      createFakeSupabase({
        tables: { organization_documents: [documentRow()] }
      }).client
    );
    expect(off.find("[data-testid='download-original']").exists()).toBe(false);

    const on = await mountReader(
      createFakeSupabase({
        tables: {
          organization_documents: [
            documentRow({ allow_original_download: true })
          ]
        }
      }).client
    );
    const link = on.get("[data-testid='download-original']");
    expect(link.attributes("href")).toBe(
      "/.netlify/functions/content-original?kind=document&slug=regulations"
    );
  });

  it("keeps the back link on the consolidated About anchor", async () => {
    const fake = createFakeSupabase({
      tables: { organization_documents: [documentRow()] }
    });
    const wrapper = await mountReader(
      fake.client,
      "/pl/about/documents/regulations"
    );

    expect(wrapper.get(".document-reader__back-link").attributes("href")).toBe(
      "/pl/about#documents"
    );
  });

  it("switching content language updates ?lang= only — the route locale stays", async () => {
    const fake = createFakeSupabase({
      tables: { organization_documents: [documentRow()] }
    });
    const wrapper = await mountReader(fake.client);

    const plButton = wrapper.get(
      '[data-testid="reader-language"] button[lang="pl"]'
    );
    await plButton.trigger("click");
    await flushPromises();

    const route = wrapper.vm.$router.currentRoute.value;
    expect(route.path).toBe("/en/about/documents/regulations");
    expect(route.query.lang).toBe("pl");
    // The article switched; the UI chrome locale did not.
    expect(wrapper.get("article").attributes("lang")).toBe("pl");
    expect(wrapper.get("h1").text()).toBe(
      "Regulamin działalności stowarzyszenia zwykłego"
    );
  });

  it("an unavailable ?lang falls back to the default and normalizes the URL", async () => {
    const fake = createFakeSupabase({
      tables: {
        organization_documents: [
          documentRow({
            organization_document_translations: [translation()]
          })
        ]
      }
    });
    const wrapper = await mountReader(
      fake.client,
      "/en/about/documents/regulations?lang=de"
    );

    const route = wrapper.vm.$router.currentRoute.value;
    // D-38: invalid lang → default rule (UI locale → EN), then replace.
    expect(route.query.lang).toBe("en");
    expect(wrapper.find(".localized-rich-text").exists()).toBe(true);
  });

  it("an unavailable locale value is rejected and normalized", async () => {
    const fake = createFakeSupabase({
      tables: {
        organization_documents: [
          documentRow({
            organization_document_translations: [translation()]
          })
        ]
      }
    });
    const wrapper = await mountReader(
      fake.client,
      "/en/about/documents/regulations?lang=pl"
    );

    // Only English is readable here: the URL normalizes to ?lang=en.
    expect(wrapper.vm.$router.currentRoute.value.query.lang).toBe("en");
  });

  it("shows the fallback note when the UI locale translation is missing", async () => {
    const fake = createFakeSupabase({
      tables: {
        organization_documents: [
          documentRow({
            organization_document_translations: [translation()]
          })
        ]
      }
    });
    const wrapper = await mountReader(
      fake.client,
      "/pl/about/documents/regulations",
      "pl"
    );

    expect(wrapper.text()).toMatch(/po angielsku/);
  });

  it("renders an explicit not-found state for an unknown slug", async () => {
    const fake = createFakeSupabase({ tables: { organization_documents: [] } });
    const wrapper = await mountReader(fake.client);

    expect(wrapper.text()).toContain("This text is not available.");
  });

  // (Draft hiding is a DB/RLS concern verified by pgTAP + the api lane: the
  // REST fake ignores filters, so a page test could not prove it honestly.)

  it("shows the unavailable state with a retry control when the query errors", async () => {
    const fake = createFakeSupabase({ error: { message: "boom" } });
    const wrapper = await mountReader(fake.client);

    expect(wrapper.text()).toContain("temporarily unavailable");
    expect(wrapper.find('[aria-label="Try again"]').exists()).toBe(true);
  });

  it("lists only locales with readable content in the selector", async () => {
    const fake = createFakeSupabase({
      tables: {
        organization_documents: [
          documentRow({
            organization_document_translations: [
              translation(),
              translation({ locale: "uk", body: null, body_ast: null })
            ]
          })
        ]
      }
    });
    const wrapper = await mountReader(fake.client);

    // A single readable locale: the selector is hidden entirely (nothing to
    // choose), and the uk row with no content never appears.
    expect(wrapper.find('[data-testid="reader-language"]').exists()).toBe(
      false
    );
    expect(wrapper.text()).not.toContain("Українська");
  });
});
