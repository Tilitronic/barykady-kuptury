import { describe, expect, it } from "vitest";
import { nextTick } from "vue";

import DocumentReader from "@/pages/[locale]/about-document.vue";
import { createFakeSupabase } from "@/test-utils/fakeSupabase";
import { mountWithPlugins } from "@/test-utils/mount";

/**
 * Spec axis: docs/tickets/T-017-about-documents.md + D-12 + D-24 — the reader
 * defaults to the active UI locale, names the source language when English
 * stands in for a missing or incomplete translation, marks the rendered content
 * with its `lang`, and its in-view switcher navigates to the chosen locale
 * prefix while keeping the canonical slug (and query/hash), disabling locales
 * without text.
 */

const DOC_ID = "00000000-0000-4000-8000-000000000601";

const EN_BODY = "## § 1\n\nThe Association is named “Barykady Kultury” (EN).";
const PL_BODY = "## § 1\n\nStowarzyszenie nosi nazwę „Barykady Kultury” (PL).";
const UK_BODY = "## § 1\n\nТовариство має назву «Barykady Kultury» (UK).";

function translation(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-4000-8000-000000000602",
    document_id: DOC_ID,
    locale: "en",
    title: "Regulations of the Ordinary Association",
    description: null,
    body: EN_BODY,
    needs_review: false,
    created_at: "2026-01-05T12:00:00Z",
    updated_at: "2026-01-05T12:00:00Z",
    ...overrides
  };
}

function documentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: DOC_ID,
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
        title: "Regulamin działalności stowarzyszenia zwykłego",
        body: PL_BODY
      }),
      translation({
        id: "00000000-0000-4000-8000-000000000604",
        locale: "uk",
        title: "Регламент діяльності звичайного товариства",
        body: UK_BODY
      })
    ],
    ...overrides
  };
}

async function mountReader(
  supabase: ReturnType<typeof createFakeSupabase>["client"],
  locale: "en" | "pl" | "uk",
  slug: string
) {
  const wrapper = await mountWithPlugins(DocumentReader, {
    locale,
    supabase,
    initialRoute: `/${locale}/about/documents/${slug}`,
    routes: [
      {
        path: "/:locale(en|pl|uk)/about/documents/:slug",
        name: "about-document",
        component: DocumentReader
      },
      {
        path: "/:locale(en|pl|uk)/about/documents",
        name: "about-documents",
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

function buttonByLabel(
  wrapper: Awaited<ReturnType<typeof mountReader>>,
  label: string
) {
  return wrapper.findAll("button").find(b => b.text() === label);
}

describe("document reader", () => {
  it("renders the requested locale body and marks its language", async () => {
    const fake = createFakeSupabase({
      tables: { organization_documents: [documentRow()] }
    });
    const wrapper = await mountReader(fake.client, "pl", "regulations");

    expect(wrapper.get("h1").text()).toBe(
      "Regulamin działalności stowarzyszenia zwykłego"
    );
    expect(wrapper.text()).toContain("Stowarzyszenie nosi nazwę");
    expect(wrapper.find(".localized-rich-text").attributes("lang")).toBe("pl");
  });

  it("falls back to English on initial load with a note naming the source", async () => {
    // Polish translation exists but has no body yet.
    const fake = createFakeSupabase({
      tables: {
        organization_documents: [
          documentRow({
            organization_document_translations: [
              translation(),
              translation({
                id: "00000000-0000-4000-8000-000000000603",
                locale: "pl",
                title: "Regulamin działalności stowarzyszenia zwykłego",
                body: null
              })
            ]
          })
        ]
      }
    });
    const wrapper = await mountReader(fake.client, "pl", "regulations");

    expect(wrapper.get("h1").text()).toBe(
      "Regulations of the Ordinary Association"
    );
    expect(wrapper.find(".localized-rich-text").attributes("lang")).toBe("en");
    expect(wrapper.text()).toMatch(/po angielsku/i);
  });

  it("renders English with the fallback note when the requested translation is missing entirely", async () => {
    // D-12: a missing translation is not a 404 — the reader falls back to
    // English and explains the substitution (M3 regression).
    const fake = createFakeSupabase({
      tables: {
        organization_documents: [
          documentRow({ organization_document_translations: [translation()] })
        ]
      }
    });
    const wrapper = await mountReader(fake.client, "pl", "regulations");

    expect(wrapper.get("h1").text()).toBe(
      "Regulations of the Ordinary Association"
    );
    expect(wrapper.text()).toContain("The Association is named");
    expect(wrapper.find(".localized-rich-text").attributes("lang")).toBe("en");
    expect(wrapper.get(".document-reader__fallback").text()).toMatch(
      /po angielsku/i
    );
    expect(wrapper.text()).not.toContain("Ten dokument jest niedostępny.");
  });

  it("navigates the in-view switch to the chosen locale prefix and renders its title", async () => {
    const fake = createFakeSupabase({
      tables: { organization_documents: [documentRow()] }
    });
    const wrapper = await mountReader(fake.client, "pl", "regulations");

    expect(wrapper.text()).toContain("Stowarzyszenie nosi nazwę");

    await buttonByLabel(wrapper, "English")!.trigger("click");
    await flushPromises();

    expect(wrapper.vm.$router.currentRoute.value.path).toBe(
      "/en/about/documents/regulations"
    );
    expect(wrapper.get("h1").text()).toBe(
      "Regulations of the Ordinary Association"
    );
    expect(wrapper.text()).toContain("The Association is named");
    expect(wrapper.text()).not.toContain("Stowarzyszenie nosi nazwę");
    expect(wrapper.find(".localized-rich-text").attributes("lang")).toBe("en");
    expect(wrapper.find(".document-reader__fallback").exists()).toBe(false);
  });

  it("preserves query and hash when the in-view switch navigates", async () => {
    const fake = createFakeSupabase({
      tables: { organization_documents: [documentRow()] }
    });
    const wrapper = await mountWithPlugins(DocumentReader, {
      locale: "pl",
      supabase: fake.client,
      initialRoute: "/pl/about/documents/regulations?from=about#section-1",
      routes: [
        {
          path: "/:locale(en|pl|uk)/about/documents/:slug",
          name: "about-document",
          component: DocumentReader
        }
      ]
    });
    await flushPromises();

    await buttonByLabel(wrapper, "English")!.trigger("click");
    await flushPromises();

    expect(wrapper.vm.$router.currentRoute.value.fullPath).toBe(
      "/en/about/documents/regulations?from=about#section-1"
    );
  });

  it("disables a locale whose translation has no body", async () => {
    const fake = createFakeSupabase({
      tables: {
        organization_documents: [
          documentRow({
            organization_document_translations: [
              translation(),
              translation({
                id: "00000000-0000-4000-8000-000000000604",
                locale: "uk",
                title: "Регламент діяльності звичайного товариства",
                body: null
              })
            ]
          })
        ]
      }
    });
    const wrapper = await mountReader(fake.client, "en", "regulations");

    expect(
      buttonByLabel(wrapper, "Українська")!.attributes("disabled")
    ).toBeDefined();
    expect(
      buttonByLabel(wrapper, "English")!.attributes("disabled")
    ).toBeUndefined();
    expect(buttonByLabel(wrapper, "English")!.attributes("aria-pressed")).toBe(
      "true"
    );
  });

  it("shows the translated not-found state when the document is absent", async () => {
    const fake = createFakeSupabase({
      tables: { organization_documents: [] }
    });
    const wrapper = await mountReader(fake.client, "en", "regulations");

    expect(wrapper.text()).toContain("This document is not available.");
    expect(wrapper.get(".document-reader__back-link").attributes("href")).toBe(
      "/en/about/documents"
    );
  });

  it("keeps exactly one h1 in the reader", async () => {
    const fake = createFakeSupabase({
      tables: { organization_documents: [documentRow()] }
    });
    const wrapper = await mountReader(fake.client, "en", "regulations");

    expect(wrapper.findAll("h1")).toHaveLength(1);
  });
});
