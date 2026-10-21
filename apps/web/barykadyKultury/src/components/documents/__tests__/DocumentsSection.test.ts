import { describe, expect, it } from "vitest";
import { flushPromises } from "@vue/test-utils";

import { createFakeSupabase } from "@/test-utils/fakeSupabase";
import { mountWithPlugins } from "@/test-utils/mount";

import DocumentsSection from "../DocumentsSection.vue";

/**
 * T-039 — the documents list extracted from `about-documents.vue` (D-25).
 * Anchored at `#documents`; text documents keep linking to the existing
 * reader route, file documents keep their metadata-only state (T-029 owns
 * the file action).
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

function fileRow() {
  return documentRow({
    id: "00000000-0000-4000-8000-000000000611",
    slug: "annual-report-file",
    storage_path: "documents/annual-report.pdf",
    mime_type: "application/pdf",
    organization_document_translations: [
      translation({
        body: null,
        title: "Annual report (file)"
      })
    ]
  });
}

async function mountSection(
  supabase: ReturnType<typeof createFakeSupabase>["client"],
  locale: "en" | "pl" | "uk" = "en"
) {
  const wrapper = await mountWithPlugins(DocumentsSection, {
    locale,
    supabase,
    props: { locale },
    initialRoute: `/${locale}`
  });
  await flushPromises();
  await new Promise(resolve => setTimeout(resolve, 0));
  return wrapper;
}

describe("DocumentsSection", () => {
  it("renders the anchored section with a focusable heading", async () => {
    const fake = createFakeSupabase({
      tables: { organization_documents: [documentRow()] }
    });
    const wrapper = await mountSection(fake.client);

    const section = wrapper.get("section#documents");
    const heading = section.get("h2");
    expect(heading.attributes("tabindex")).toBe("-1");
    expect(heading.text()).toBe("Documents");
  });

  it("links text documents to the reader under the active locale", async () => {
    const fake = createFakeSupabase({
      tables: { organization_documents: [documentRow()] }
    });
    const wrapper = await mountSection(fake.client, "pl");

    const link = wrapper.get(".documents-list__link");
    expect(link.text()).toBe("Regulamin działalności stowarzyszenia zwykłego");
    expect(link.attributes("href")).toBe("/pl/about/documents/regulations");
  });

  it("renders file documents as metadata without a reader link", async () => {
    const fake = createFakeSupabase({
      tables: { organization_documents: [fileRow()] }
    });
    const wrapper = await mountSection(fake.client);

    expect(wrapper.find(".documents-list__link").exists()).toBe(false);
    expect(wrapper.text()).toContain("Annual report (file)");
    expect(wrapper.get(".documents-list__type").text()).toBe("Regulations");
  });

  it("links file documents that carry a reader AST for the locale", async () => {
    const fake = createFakeSupabase({
      tables: {
        organization_documents: [
          documentRow({
            id: "00000000-0000-4000-8000-000000000611",
            slug: "annual-report-file",
            storage_path: "documents/annual-report.pdf",
            mime_type: "application/pdf",
            organization_document_translations: [
              translation({
                body: null,
                body_ast_version: 1,
                title: "Annual report (file + reader)"
              })
            ]
          })
        ]
      }
    });
    const wrapper = await mountSection(fake.client);

    const link = wrapper.get(".documents-list__link");
    expect(link.text()).toBe("Annual report (file + reader)");
    expect(link.attributes("href")).toBe(
      "/en/about/documents/annual-report-file"
    );
  });

  it("shows the translated empty state", async () => {
    const fake = createFakeSupabase({ tables: {} });
    const wrapper = await mountSection(fake.client);

    expect(wrapper.text()).toContain("No documents are available yet.");
  });

  it("shows the unavailable state on query error", async () => {
    const fake = createFakeSupabase({ error: { message: "boom" } });
    const wrapper = await mountSection(fake.client);

    expect(wrapper.text()).toContain(
      "This content is temporarily unavailable."
    );
  });
});
