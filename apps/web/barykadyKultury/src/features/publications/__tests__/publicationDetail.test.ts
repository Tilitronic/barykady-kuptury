import { describe, expect, it } from "vitest";

import {
  fetchPublicationDetail,
  mapPublicationDetail,
  publicationFilesForLocale,
  selectPublicationDetailTranslation,
  type PublicationRowWithTranslations,
  type PublicationTranslation
} from "@/features/publications/api";
import { createFakeSupabase } from "@/test-utils/fakeSupabase";

/**
 * D-38 publication detail (T-040 review fix).
 *
 * Row strictness stays published + canonical slug. Translation strictness is
 * preferred locale → English → first available, and files follow the chosen
 * translation's locale — the metadata/files side of the reader fallback.
 */

const CANONICAL_SLUG = "sample-publication";

const EN_FILE = {
  locale: "en",
  label: "Sample PDF (English)",
  storage_path: "fixtures/publications/sample-en.pdf",
  mime_type: "application/pdf",
  file_size_bytes: 12345
};

const PL_FILE = {
  locale: "pl",
  label: "Sample PDF (Polish)",
  storage_path: "fixtures/publications/sample-pl.pdf",
  mime_type: "application/pdf",
  file_size_bytes: 23456
};

const EN_TRANSLATION = {
  locale: "en",
  title: "Sample Publication (EN)",
  abstract: "Abstract (EN)",
  authors: "Author One",
  body: "English body",
  body_ast: { kind: "document", blocks: [] },
  body_ast_version: 1
};

const PL_TRANSLATION = {
  locale: "pl",
  title: "Przykladowa publikacja (PL)",
  abstract: "Streszczenie (PL)",
  authors: "Autor Dwaj",
  body: null,
  body_ast: null,
  body_ast_version: null
};

const UK_TRANSLATION = {
  locale: "uk",
  title: "Зразкова публікація (UK)",
  abstract: "Анотація (UK)",
  authors: "Автор Три",
  body: null,
  body_ast: null,
  body_ast_version: null
};

function publicationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-4000-8000-000000000401",
    slug: CANONICAL_SLUG,
    status: "published",
    language: "en",
    publication_date: "2026-02-01",
    external_url: "https://example.org/publication",
    sort_order: 1,
    published_at: "2026-02-01T09:00:00Z",
    created_at: "2026-02-01T09:00:00Z",
    updated_at: "2026-02-01T09:00:00Z",
    publication_translations: [EN_TRANSLATION, PL_TRANSLATION],
    publication_files: [EN_FILE, PL_FILE],
    ...overrides
  } as unknown as PublicationRowWithTranslations;
}

function domainTranslation(
  overrides: Partial<PublicationTranslation> = {}
): PublicationTranslation {
  return {
    locale: "en",
    title: "Title",
    abstract: null,
    authors: null,
    body: null,
    bodyAst: null,
    bodyAstVersion: null,
    ...overrides
  };
}

describe("selectPublicationDetailTranslation", () => {
  it("prefers the requested locale when it is available", () => {
    const selected = selectPublicationDetailTranslation(
      [
        domainTranslation({ locale: "en" }),
        domainTranslation({ locale: "pl" }),
        domainTranslation({ locale: "uk" })
      ],
      "pl"
    );

    expect(selected).toMatchObject({
      translation: { locale: "pl" },
      availableLocales: ["en", "pl", "uk"],
      isFallback: false
    });
  });

  it("falls back to English when the requested locale is missing", () => {
    const selected = selectPublicationDetailTranslation(
      [
        domainTranslation({ locale: "en" }),
        domainTranslation({ locale: "pl" })
      ],
      "uk"
    );

    expect(selected).toMatchObject({
      translation: { locale: "en" },
      isFallback: true
    });
  });

  it("falls back to the first available translation when English is missing", () => {
    const selected = selectPublicationDetailTranslation(
      [
        domainTranslation({ locale: "pl" }),
        domainTranslation({ locale: "uk" })
      ],
      "en"
    );

    expect(selected).toMatchObject({
      translation: { locale: "pl" },
      availableLocales: ["pl", "uk"],
      isFallback: true
    });
  });

  it("returns null when no translation exists", () => {
    expect(selectPublicationDetailTranslation([], "pl")).toBeNull();
  });
});

describe("publicationFilesForLocale", () => {
  it("keeps only the resolved locale's files", () => {
    expect(
      publicationFilesForLocale(
        [
          {
            locale: "en",
            label: "EN",
            storagePath: "en.pdf",
            mimeType: "application/pdf",
            sizeBytes: 1
          },
          {
            locale: "pl",
            label: "PL",
            storagePath: "pl.pdf",
            mimeType: "application/pdf",
            sizeBytes: 2
          }
        ],
        "pl"
      ).map(file => file.storagePath)
    ).toEqual(["pl.pdf"]);
  });
});

describe("mapPublicationDetail", () => {
  it("uses the chosen translation for metadata and only its files", () => {
    const detail = mapPublicationDetail(publicationRow(), "pl");

    expect(detail).not.toBeNull();
    expect(detail).toMatchObject({
      publication: {
        slug: CANONICAL_SLUG,
        title: "Przykladowa publikacja (PL)",
        abstract: "Streszczenie (PL)",
        authors: "Autor Dwaj",
        publicationDate: "2026-02-01",
        externalUrl: "https://example.org/publication",
        isFallback: false
      },
      translation: {
        locale: "pl",
        body: null,
        bodyAst: null,
        bodyAstVersion: null
      },
      availableLocales: ["en", "pl"],
      isFallback: false
    });
    expect(detail?.files.map(file => file.storagePath)).toEqual([
      "fixtures/publications/sample-pl.pdf"
    ]);
  });

  it("keeps English metadata available when the preferred locale is missing", () => {
    const detail = mapPublicationDetail(publicationRow(), "uk");

    expect(detail).toMatchObject({
      publication: {
        title: "Sample Publication (EN)",
        authors: "Author One",
        publicationDate: "2026-02-01"
      },
      translation: { locale: "en", bodyAst: { kind: "document", blocks: [] } },
      isFallback: true
    });
    expect(detail?.files.map(file => file.locale)).toEqual(["en"]);
  });

  it("returns no files when the chosen locale has no file row", () => {
    const withUkTranslation = publicationRow({
      publication_translations: [EN_TRANSLATION, PL_TRANSLATION, UK_TRANSLATION]
    });

    const detail = mapPublicationDetail(withUkTranslation, "uk");

    expect(detail?.translation.locale).toBe("uk");
    expect(detail?.files).toEqual([]);
  });

  it("returns null when the row has no translatable text", () => {
    expect(
      mapPublicationDetail(
        publicationRow({ publication_translations: [] }),
        "en"
      )
    ).toBeNull();
  });
});

describe("fetchPublicationDetail", () => {
  it("queries the published canonical slug and returns the D-38 detail", async () => {
    const fake = createFakeSupabase({
      tables: { publications: [publicationRow()] }
    });

    const result = await fetchPublicationDetail(
      fake.client,
      `  ${CANONICAL_SLUG}  `,
      "pl"
    );

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.translation.locale).toBe("pl");
    expect(result.items[0]?.files.map(file => file.locale)).toEqual(["pl"]);

    const equates = fake.calls.filter(call => call.method === "eq");
    expect(equates).toContainEqual({
      table: "publications",
      method: "eq",
      args: ["status", "published"]
    });
    expect(equates).toContainEqual({
      table: "publications",
      method: "eq",
      args: ["slug", CANONICAL_SLUG]
    });
  });

  it("serves EN metadata/files when the preferred locale has no translation", async () => {
    const fake = createFakeSupabase({
      tables: { publications: [publicationRow()] }
    });

    const result = await fetchPublicationDetail(
      fake.client,
      CANONICAL_SLUG,
      "uk"
    );

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.items[0]).toMatchObject({
      publication: {
        title: "Sample Publication (EN)",
        authors: "Author One",
        publicationDate: "2026-02-01"
      },
      translation: { locale: "en" },
      isFallback: true
    });
    expect(result.items[0]?.files.map(file => file.locale)).toEqual(["en"]);
  });

  it("never resolves a draft leak and maps it to empty", async () => {
    const fake = createFakeSupabase({
      tables: {
        publications: [
          publicationRow({
            status: "draft",
            slug: "draft-leak",
            publication_translations: [EN_TRANSLATION]
          })
        ]
      }
    });

    await expect(
      fetchPublicationDetail(fake.client, "draft-leak", "en")
    ).resolves.toEqual({ kind: "empty" });
  });

  it("returns empty for a blank slug without querying", async () => {
    const fake = createFakeSupabase();

    await expect(
      fetchPublicationDetail(fake.client, "   ", "en")
    ).resolves.toEqual({ kind: "empty" });
    expect(fake.calls).toHaveLength(0);
  });

  it("returns unavailable without a client", async () => {
    await expect(
      fetchPublicationDetail(null, CANONICAL_SLUG, "en")
    ).resolves.toEqual({ kind: "unavailable" });
  });

  it("maps a query failure to unavailable", async () => {
    const fake = createFakeSupabase({
      error: { message: "boom" }
    });

    await expect(
      fetchPublicationDetail(fake.client, CANONICAL_SLUG, "en")
    ).resolves.toEqual({ kind: "unavailable" });
  });
});
