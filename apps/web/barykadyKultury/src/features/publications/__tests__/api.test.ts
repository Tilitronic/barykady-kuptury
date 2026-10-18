import { describe, expect, it } from "vitest";

import {
  fetchPublishedPublicationBySlug,
  fetchPublishedPublications,
  findPublicationBySlug,
  type PublicationRowWithTranslations
} from "@/features/publications/api";
import { createFakeSupabase } from "@/test-utils/fakeSupabase";

/**
 * Spec axis (T-020): the by-slug read added on top of the T-015 module.
 * Slug resolution is STRICT on (requestedLocale, slug) — the T-019 precedent
 * (ticket line: "an English fallback slug must not silently resolve a Polish
 * URL") — and draft rows never resolve, mirroring `findProjectBySlug`.
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

const EN_FILE = {
  locale: "en",
  label: "Sample PDF (English, fictional)",
  storage_path: "fixtures/publications/sample-publication-en.pdf",
  mime_type: "application/pdf",
  file_size_bytes: 12345
};

function publicationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-4000-8000-000000000401",
    status: "published",
    language: "en",
    publication_date: "2026-02-01",
    external_url: null,
    sort_order: 1,
    published_at: "2026-02-01T09:00:00Z",
    created_at: "2026-02-01T09:00:00Z",
    updated_at: "2026-02-01T09:00:00Z",
    publication_translations: [EN_TRANSLATION, PL_TRANSLATION],
    publication_files: [EN_FILE],
    ...overrides
  } as unknown as PublicationRowWithTranslations;
}

describe("fetchPublishedPublications (T-015 baseline, unchanged)", () => {
  it("still filters to published rows", async () => {
    const fake = createFakeSupabase({ tables: { publications: [] } });

    await fetchPublishedPublications(fake.client, "pl");

    const eq = fake.calls.find(c => c.method === "eq");
    expect(eq?.args).toEqual(["status", "published"]);
  });
});

describe("findPublicationBySlug", () => {
  const rows = [publicationRow()];

  it("resolves the exact (locale, slug) pair", () => {
    const row = findPublicationBySlug(rows, "przykladowa-publikacja", "pl");

    expect(row?.id).toBe("00000000-0000-4000-8000-000000000401");
  });

  it("does not resolve the English slug through a Polish URL", () => {
    expect(findPublicationBySlug(rows, "sample-publication", "pl")).toBeNull();
  });

  it("never resolves a draft row, even when the payload contains it", () => {
    const draft = publicationRow({
      id: "00000000-0000-4000-8000-000000000402",
      status: "draft",
      publication_translations: [{ ...EN_TRANSLATION, slug: "draft-leak" }]
    });

    expect(findPublicationBySlug([draft], "draft-leak", "en")).toBeNull();
  });
});

describe("fetchPublishedPublicationBySlug", () => {
  it("returns the single publication whose own locale carries the slug", async () => {
    const fake = createFakeSupabase({
      tables: { publications: [publicationRow()] }
    });

    const result = await fetchPublishedPublicationBySlug(
      fake.client,
      "przykladowa-publikacja",
      "pl"
    );

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.title).toBe("Przykladowa publikacja (PL)");
    expect(result.items[0]?.files).toHaveLength(1);
    expect(result.items[0]?.files[0]?.storagePath).toBe(
      "fixtures/publications/sample-publication-en.pdf"
    );
  });

  it("returns empty — not a fallback resolution — when another locale owns the slug", async () => {
    const fake = createFakeSupabase({
      tables: { publications: [publicationRow()] }
    });

    expect(
      await fetchPublishedPublicationBySlug(
        fake.client,
        "sample-publication",
        "pl"
      )
    ).toEqual({ kind: "empty" });
  });

  it("returns empty for a draft slug even when the payload leaks the row", async () => {
    const draft = publicationRow({
      id: "00000000-0000-4000-8000-000000000499",
      status: "draft",
      publication_translations: [{ ...EN_TRANSLATION, slug: "draft-leak" }]
    });
    const fake = createFakeSupabase({
      tables: { publications: [publicationRow(), draft] }
    });

    expect(
      await fetchPublishedPublicationBySlug(fake.client, "draft-leak", "en")
    ).toEqual({ kind: "empty" });
  });

  it("returns the unavailable state without a client", async () => {
    expect(await fetchPublishedPublicationBySlug(null, "any", "en")).toEqual({
      kind: "unavailable"
    });
  });
});
