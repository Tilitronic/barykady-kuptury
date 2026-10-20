import { describe, expect, it } from "vitest";

import {
  fetchPublishedPublicationBySlug,
  fetchPublishedPublications,
  findPublicationBySlug,
  type PublicationRowWithTranslations
} from "@/features/publications/api";
import { createFakeSupabase } from "@/test-utils/fakeSupabase";

/**
 * Spec axis (T-020, canonical slug by T-038/D-24): one root slug is shared by
 * every locale. Resolution is STRICT — the published row must carry that root
 * slug AND have a translation for the requested locale — and draft rows never
 * resolve, mirroring `findProjectBySlug`.
 */

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

const CANONICAL_SLUG = "sample-publication";

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
    slug: CANONICAL_SLUG,
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

function eqValue(
  calls: ReturnType<typeof createFakeSupabase>["calls"],
  column: string
): unknown[] {
  return calls
    .filter(call => call.method === "eq" && call.args[0] === column)
    .map(call => call.args[1]);
}

describe("fetchPublishedPublications (T-015 baseline, unchanged)", () => {
  it("still filters to published rows", async () => {
    const fake = createFakeSupabase({ tables: { publications: [] } });

    await fetchPublishedPublications(fake.client, "pl");

    const eq = fake.calls.find(c => c.method === "eq");
    expect(eq?.args).toEqual(["status", "published"]);
  });

  it("maps the canonical root slug, not a locale translation slug", async () => {
    const fake = createFakeSupabase({
      tables: { publications: [publicationRow()] }
    });

    const result = await fetchPublishedPublications(fake.client, "pl");
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;

    expect(result.items[0]?.slug).toBe(CANONICAL_SLUG);
  });
});

describe("findPublicationBySlug", () => {
  const rows = [publicationRow()];

  it("resolves the canonical root slug for a locale that has a translation", () => {
    const row = findPublicationBySlug(rows, CANONICAL_SLUG, "pl");

    expect(row?.id).toBe("00000000-0000-4000-8000-000000000401");
  });

  it("rejects an unknown slug", () => {
    expect(findPublicationBySlug(rows, "not-a-publication", "pl")).toBeNull();
  });

  it("rejects a locale without a translation", () => {
    const enOnly = [
      publicationRow({ publication_translations: [EN_TRANSLATION] })
    ];

    expect(findPublicationBySlug(enOnly, CANONICAL_SLUG, "pl")).toBeNull();
  });

  it("never resolves a draft row, even when the payload contains it", () => {
    const draft = publicationRow({
      id: "00000000-0000-4000-8000-000000000402",
      slug: "draft-leak",
      status: "draft",
      publication_translations: [EN_TRANSLATION]
    });

    expect(findPublicationBySlug([draft], "draft-leak", "en")).toBeNull();
  });
});

describe("fetchPublishedPublicationBySlug", () => {
  it("queries by the canonical root slug", async () => {
    const fake = createFakeSupabase({
      tables: { publications: [publicationRow()] }
    });

    await fetchPublishedPublicationBySlug(fake.client, CANONICAL_SLUG, "pl");

    expect(eqValue(fake.calls, "slug")).toEqual([CANONICAL_SLUG]);
  });

  it("returns the single publication for the canonical slug in the requested locale", async () => {
    const fake = createFakeSupabase({
      tables: { publications: [publicationRow()] }
    });

    const result = await fetchPublishedPublicationBySlug(
      fake.client,
      CANONICAL_SLUG,
      "pl"
    );

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.title).toBe("Przykladowa publikacja (PL)");
    expect(result.items[0]?.slug).toBe(CANONICAL_SLUG);
    expect(result.items[0]?.files).toHaveLength(1);
    expect(result.items[0]?.files[0]?.storagePath).toBe(
      "fixtures/publications/sample-publication-en.pdf"
    );
  });

  it("returns empty when the requested locale has no translation", async () => {
    const fake = createFakeSupabase({
      tables: {
        publications: [
          publicationRow({ publication_translations: [EN_TRANSLATION] })
        ]
      }
    });

    expect(
      await fetchPublishedPublicationBySlug(fake.client, CANONICAL_SLUG, "pl")
    ).toEqual({ kind: "empty" });
  });

  it("returns empty for a draft slug even when the payload leaks the row", async () => {
    const draft = publicationRow({
      id: "00000000-0000-4000-8000-000000000499",
      slug: "draft-leak",
      status: "draft",
      publication_translations: [EN_TRANSLATION]
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
