import { describe, expect, it } from "vitest";

import {
  fetchPublishedDocumentBySlug,
  fetchPublishedDocuments,
  selectReaderTranslation,
  type OrganizationDocumentReader
} from "@/features/documents/api";
import { createFakeSupabase } from "@/test-utils/fakeSupabase";

/**
 * Spec axis: docs/tickets/T-038-canonical-slugs.md + D-24 + D-12 — documents
 * use one root slug shared by every locale. Resolution is the published row
 * carrying that slug only; the reader then applies the documented
 * requested→English text fallback with a note. Unknown, draft and archived
 * slugs stay empty. A document may be file-based or in-app text, and the reader
 * still surfaces the localized body and the set of locales that carry text.
 */

const DOC_ID = "00000000-0000-4000-8000-000000000601";
const CANONICAL_SLUG = "regulations";

function translation(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-4000-8000-000000000602",
    document_id: DOC_ID,
    locale: "en",
    title: "Regulations of the Ordinary Association",
    description: null,
    body: "## § 1\n\nEnglish body.",
    needs_review: false,
    created_at: "2026-01-05T12:00:00Z",
    updated_at: "2026-01-05T12:00:00Z",
    ...overrides
  };
}

function documentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: DOC_ID,
    slug: CANONICAL_SLUG,
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
    organization_document_translations: [translation()],
    ...overrides
  };
}

function eqValue(
  calls: ReturnType<typeof createFakeSupabase>["calls"],
  column: string
): unknown[] {
  return calls
    .filter(call => call.method === "eq" && call.args[0] === column)
    .map(call => call.args[1]);
}

describe("fetchPublishedDocuments", () => {
  it("filters by published status and orders by sort_order", async () => {
    const fake = createFakeSupabase({
      tables: { organization_documents: [] }
    });

    await fetchPublishedDocuments(fake.client, "en");

    expect(eqValue(fake.calls, "status")).toEqual(["published"]);
    expect(
      fake.calls.some(
        call => call.method === "order" && call.args[0] === "sort_order"
      )
    ).toBe(true);
  });

  it("maps the localized body and every locale that carries text", async () => {
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
                body: "## § 1\n\nPolski tekst."
              }),
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

    const result = await fetchPublishedDocuments(fake.client, "pl");
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;

    const [doc] = result.items;
    expect(doc!.title).toBe("Regulamin działalności stowarzyszenia zwykłego");
    expect(doc!.body).toContain("Polski tekst");
    expect(doc!.slug).toBe(CANONICAL_SLUG);
    expect(doc!.availableLocales).toEqual(["en", "pl"]);
    expect(doc!.isFallback).toBe(false);
    expect(Object.keys(doc!)).not.toContain("document_type");
  });

  it("returns the empty state when no document is published", async () => {
    const fake = createFakeSupabase({
      tables: { organization_documents: [] }
    });

    expect(await fetchPublishedDocuments(fake.client, "en")).toEqual({
      kind: "empty"
    });
  });

  it("returns the unavailable state without a client", async () => {
    expect(await fetchPublishedDocuments(null, "en")).toEqual({
      kind: "unavailable"
    });
  });
});

describe("fetchPublishedDocumentBySlug", () => {
  it("queries by the canonical root slug", async () => {
    const fake = createFakeSupabase({
      tables: { organization_documents: [documentRow()] }
    });

    await fetchPublishedDocumentBySlug(fake.client, CANONICAL_SLUG);

    expect(eqValue(fake.calls, "slug")).toEqual([CANONICAL_SLUG]);
  });

  it("resolves the canonical slug when the requested-locale translation exists", async () => {
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
                body: "## § 1\n\nPolski tekst."
              })
            ]
          })
        ]
      }
    });

    const result = await fetchPublishedDocumentBySlug(
      fake.client,
      CANONICAL_SLUG
    );
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;

    expect(result.items[0]!.id).toBe(DOC_ID);
    expect(result.items[0]!.translations).toHaveLength(2);
  });

  it("resolves the canonical slug when the requested translation is absent (reader falls back to English)", async () => {
    // D-12: documents keep the documented English text fallback. A missing
    // requested translation is NOT a 404; the reader renders English + a note.
    const fake = createFakeSupabase({
      tables: { organization_documents: [documentRow()] }
    });

    const result = await fetchPublishedDocumentBySlug(
      fake.client,
      CANONICAL_SLUG
    );
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;

    const reader = result.items[0]!;
    expect(reader.availableLocales).toEqual(["en"]);

    const selected = selectReaderTranslation(reader, "pl");
    expect(selected?.translation.locale).toBe("en");
    expect(selected?.isFallback).toBe(true);
  });

  it("returns the empty state when the slug does not match the root", async () => {
    const fake = createFakeSupabase({
      tables: { organization_documents: [documentRow()] }
    });

    expect(
      await fetchPublishedDocumentBySlug(fake.client, "does-not-exist")
    ).toEqual({ kind: "empty" });
  });

  it("returns empty for a draft row even when the payload leaks it", async () => {
    const draft = documentRow({
      id: "00000000-0000-4000-8000-000000000699",
      slug: "draft-document",
      status: "draft"
    });
    const fake = createFakeSupabase({
      tables: { organization_documents: [documentRow(), draft] }
    });

    expect(
      await fetchPublishedDocumentBySlug(fake.client, "draft-document")
    ).toEqual({ kind: "empty" });
  });

  it("returns empty for an archived row even when the payload leaks it", async () => {
    const archived = documentRow({
      id: "00000000-0000-4000-8000-000000000698",
      slug: "archived-document",
      status: "archived"
    });
    const fake = createFakeSupabase({
      tables: { organization_documents: [documentRow(), archived] }
    });

    expect(
      await fetchPublishedDocumentBySlug(fake.client, "archived-document")
    ).toEqual({ kind: "empty" });
  });

  it("returns the unavailable state without a client", async () => {
    expect(await fetchPublishedDocumentBySlug(null, CANONICAL_SLUG)).toEqual({
      kind: "unavailable"
    });
  });
});

describe("selectReaderTranslation", () => {
  const reader: OrganizationDocumentReader = {
    id: DOC_ID,
    documentType: "regulations",
    language: null,
    publicationDate: null,
    storagePath: null,
    availableLocales: ["en"],
    translations: [
      {
        locale: "en",
        title: "Regulations",
        description: null,
        body: "EN body"
      },
      {
        locale: "pl",
        title: "Regulamin",
        description: null,
        body: null
      },
      {
        locale: "uk",
        title: "Регламент",
        description: null,
        body: "UK body"
      }
    ]
  };

  it("uses the requested locale when its body is present", () => {
    const selected = selectReaderTranslation(reader, "uk");
    expect(selected?.translation.locale).toBe("uk");
    expect(selected?.isFallback).toBe(false);
  });

  it("falls back to English on initial load and flags it", () => {
    const selected = selectReaderTranslation(reader, "pl");
    expect(selected?.translation.locale).toBe("en");
    expect(selected?.isFallback).toBe(true);
  });

  it("never substitutes another non-default locale (no pl↔uk)", () => {
    const onlyPolish: OrganizationDocumentReader = {
      ...reader,
      translations: [
        {
          locale: "pl",
          title: "Regulamin",
          description: null,
          body: "PL body"
        }
      ]
    };

    expect(selectReaderTranslation(onlyPolish, "uk")).toBeNull();
  });

  it("renders only the chosen locale on an explicit switch (no fallback)", () => {
    expect(
      selectReaderTranslation(reader, "pl", { allowFallback: false })
    ).toBeNull();
  });
});
