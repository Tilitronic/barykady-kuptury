import { describe, expect, it } from "vitest";
import { nextTick } from "vue";

import AboutDocumentsPage from "@/pages/[locale]/about-documents.vue";
import { createFakeSupabase } from "@/test-utils/fakeSupabase";
import { mountWithPlugins } from "@/test-utils/mount";

/**
 * Spec axis: docs/tickets/T-017-about-documents.md + D-12 — the listing shows
 * the localized title + `document_type` + publication date, links text
 * documents to the reader under the active locale (the reader itself falls
 * back to English with a note), collapses missing optional metadata, and has
 * translated empty / unavailable states.
 */

function translation(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-4000-8000-000000000602",
    document_id: "00000000-0000-4000-8000-000000000601",
    locale: "en",
    title: "Regulations of the Ordinary Association",
    description: null,
    body: "## § 1\n\nBody.",
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
    organization_document_translations: [
      translation(),
      translation({
        id: "00000000-0000-4000-8000-000000000603",
        locale: "pl",
        title: "Regulamin działalności stowarzyszenia zwykłego"
      })
    ],
    ...overrides
  };
}

async function mountListing(
  supabase: ReturnType<typeof createFakeSupabase>["client"] | null,
  locale: "en" | "pl" | "uk" = "en"
) {
  const wrapper = await mountWithPlugins(AboutDocumentsPage, {
    locale,
    supabase,
    initialRoute: `/${locale}`
  });

  await flushPromises();
  return wrapper;
}

async function flushPromises() {
  await nextTick();
  await new Promise(resolve => setTimeout(resolve, 0));
}

describe("documents listing", () => {
  it("lists a text document with localized type and a reader link", async () => {
    const fake = createFakeSupabase({
      tables: { organization_documents: [documentRow()] }
    });
    const wrapper = await mountListing(fake.client, "pl");

    const link = wrapper.get(".documents-list__link");
    expect(link.text()).toBe("Regulamin działalności stowarzyszenia zwykłego");
    expect(link.attributes("href")).toBe("/pl/about/documents/regulations");
    expect(wrapper.text()).toContain("Regulamin");
    expect(wrapper.get("h1").text()).toBe("Dokumenty");
  });

  it("links an English fallback document under the active locale (the reader falls back)", async () => {
    // Documents retain D-12: unlike projects/publications, a missing requested
    // translation resolves the reader with English text + a note, so the
    // listing link must stay on the user's active prefix.
    const fake = createFakeSupabase({
      tables: {
        organization_documents: [
          documentRow({ organization_document_translations: [translation()] })
        ]
      }
    });
    const wrapper = await mountListing(fake.client, "uk");

    const link = wrapper.get(".documents-list__link");
    expect(link.text()).toBe("Regulations of the Ordinary Association");
    expect(link.attributes("href")).toBe("/uk/about/documents/regulations");
  });

  it("collapses missing optional metadata (no date, no description)", async () => {
    const fake = createFakeSupabase({
      tables: { organization_documents: [documentRow()] }
    });
    const wrapper = await mountListing(fake.client, "en");

    expect(wrapper.find("time").exists()).toBe(false);
    expect(wrapper.find(".documents-list__description").exists()).toBe(false);
  });

  it("renders the publication date when present", async () => {
    const fake = createFakeSupabase({
      tables: {
        organization_documents: [
          documentRow({ publication_date: "2026-02-01" })
        ]
      }
    });
    const wrapper = await mountListing(fake.client, "en");

    expect(wrapper.get("time").attributes("datetime")).toBe("2026-02-01");
    expect(wrapper.get("time").text().length).toBeGreaterThan(0);
  });

  it("shows a translated empty state when nothing is published", async () => {
    const fake = createFakeSupabase({
      tables: { organization_documents: [] }
    });
    const wrapper = await mountListing(fake.client, "en");

    expect(wrapper.text()).toContain("No documents are available yet.");
  });

  it("shows the unavailable state without a client", async () => {
    const wrapper = await mountListing(null, "en");

    expect(wrapper.text()).toContain("temporarily unavailable");
  });
});
