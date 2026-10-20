import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { fetchReaderDocument, parseReaderAst } from "@/features/reader/api";
import type { Database } from "@/types/database.types";

/**
 * Reader data access (T-040). A typed fake implements only the query-builder
 * surface the module uses; no live Supabase, no network. The assertions pin
 * the published-only row read, the owner-specific asset read and the mapping
 * of AST/body/source metadata into the reader model.
 */

interface FakeCall {
  readonly table: string;
  readonly method: string;
  readonly args: readonly unknown[];
}

interface FakeOptions {
  readonly tables?: Readonly<Record<string, readonly unknown[]>>;
  readonly errors?: Readonly<Record<string, { readonly message: string }>>;
}

class FakeBuilder implements PromiseLike<{
  data: unknown;
  error: { message: string } | null;
}> {
  constructor(
    private readonly table: string,
    private readonly options: FakeOptions,
    private readonly calls: FakeCall[]
  ) {}

  private record(method: string, args: unknown[]): this {
    this.calls.push({ table: this.table, method, args });
    return this;
  }

  select(...args: unknown[]): this {
    return this.record("select", args);
  }

  eq(...args: unknown[]): this {
    return this.record("eq", args);
  }

  limit(...args: unknown[]): this {
    return this.record("limit", args);
  }

  order(...args: unknown[]): this {
    return this.record("order", args);
  }

  overrideTypes(...args: unknown[]): this {
    return this.record("overrideTypes", args);
  }

  // A PostgREST builder is thenable; this fake mirrors that shape.
  // oxlint-disable-next-line unicorn/no-thenable
  then<
    TResult1 = { data: unknown; error: { message: string } | null },
    TResult2 = never
  >(
    onfulfilled?:
      | ((value: {
          data: unknown;
          error: { message: string } | null;
        }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.result()).then(onfulfilled, onrejected);
  }

  private result(): { data: unknown; error: { message: string } | null } {
    const failure = this.options.errors?.[this.table];
    if (failure) return { data: null, error: failure };

    return {
      data: this.options.tables?.[this.table] ?? [],
      error: null
    };
  }
}

function createFakeSupabase(options: FakeOptions = {}) {
  const calls: FakeCall[] = [];
  const from = (table: string) => new FakeBuilder(table, options, calls);

  return {
    client: { from } as unknown as SupabaseClient<Database>,
    calls
  };
}

const AST = {
  kind: "document",
  blocks: [
    {
      kind: "paragraph",
      children: [{ kind: "text", value: "Reader text" }]
    }
  ]
};

function documentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-4000-8000-000000000601",
    slug: "regulations",
    document_type: "regulations",
    language: null,
    publication_date: null,
    updated_at: "2026-10-20T12:00:00Z",
    source_provider: "upload",
    source_path: "sources/regulations.docx",
    source_mime:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    source_external_id: null,
    source_synced_at: null,
    allow_original_download: true,
    organization_document_translations: [
      {
        locale: "en",
        title: "Regulations",
        description: "English description",
        body: "Reader text",
        body_ast: AST,
        body_ast_version: 1
      },
      {
        locale: "pl",
        title: "Regulamin",
        description: null,
        body: "Polski tekst",
        body_ast: null,
        body_ast_version: null
      },
      {
        locale: "uk",
        title: "Регламент",
        description: null,
        body: "   ",
        body_ast: null,
        body_ast_version: null
      }
    ],
    ...overrides
  };
}

function publicationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-4000-8000-000000000401",
    slug: "sample-publication",
    language: "en",
    publication_date: "2026-02-01",
    external_url: "https://example.org/publication",
    updated_at: "2026-10-20T12:00:00Z",
    source_provider: "google_doc",
    source_path: null,
    source_mime: null,
    source_external_id: "drive-doc-123",
    source_synced_at: "2026-10-19T08:00:00Z",
    allow_original_download: false,
    publication_translations: [
      {
        locale: "en",
        title: "Sample publication",
        abstract: "Sample abstract",
        body: "Sample body",
        body_ast: null,
        body_ast_version: null
      }
    ],
    ...overrides
  };
}

const ASSET = {
  id: "00000000-0000-4000-8000-000000000701",
  locale: "en",
  storage_path: "content-assets/doc/en/image.png",
  mime_type: "image/png",
  width: 640,
  height: 360,
  sha256: "a".repeat(64),
  size_bytes: 1024
};

describe("parseReaderAst", () => {
  it("accepts a version-1 document", () => {
    expect(parseReaderAst(AST, 1)).toEqual(AST);
  });

  it("rejects unsupported versions and malformed documents", () => {
    expect(parseReaderAst(AST, 2)).toBeNull();
    expect(parseReaderAst(AST, null)).toBeNull();
    expect(parseReaderAst(null, 1)).toBeNull();
    expect(parseReaderAst("{}", 1)).toBeNull();
    expect(parseReaderAst([], 1)).toBeNull();
    expect(parseReaderAst({ kind: "paragraph", blocks: [] }, 1)).toBeNull();
    expect(parseReaderAst({ kind: "document" }, 1)).toBeNull();
  });
});

describe("fetchReaderDocument", () => {
  it("returns unavailable without a client", async () => {
    await expect(
      fetchReaderDocument(null, "document", "regulations")
    ).resolves.toEqual({ kind: "unavailable" });
  });

  it("returns empty for a blank slug without querying", async () => {
    const fake = createFakeSupabase();

    await expect(
      fetchReaderDocument(fake.client, "document", "   ")
    ).resolves.toEqual({ kind: "empty" });
    expect(fake.calls).toHaveLength(0);
  });

  it("reads a published document with translations, assets and source metadata", async () => {
    const fake = createFakeSupabase({
      tables: {
        organization_documents: [documentRow()],
        content_assets: [ASSET]
      }
    });

    const result = await fetchReaderDocument(
      fake.client,
      "document",
      "  regulations  "
    );

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;

    const model = result.items[0];
    expect(model).toMatchObject({
      id: "00000000-0000-4000-8000-000000000601",
      kind: "document",
      slug: "regulations",
      documentType: "regulations",
      language: null,
      publicationDate: null,
      externalUrl: null,
      availableLocales: ["en", "pl"],
      source: {
        provider: "upload",
        path: "sources/regulations.docx",
        externalId: null,
        allowOriginalDownload: true
      }
    });
    expect(model?.translations).toHaveLength(3);
    expect(model?.translations[0]).toMatchObject({
      locale: "en",
      title: "Regulations",
      description: "English description",
      bodyAst: AST,
      body: "Reader text",
      hasReadableContent: true
    });
    expect(model?.translations[2]?.hasReadableContent).toBe(false);
    expect(model?.assets).toEqual([
      {
        id: ASSET.id,
        locale: "en",
        storagePath: ASSET.storage_path,
        mimeType: "image/png",
        width: 640,
        height: 360,
        sha256: ASSET.sha256,
        sizeBytes: 1024
      }
    ]);

    // Published-only canonical lookup, never a locale filter.
    expect(fake.calls).toContainEqual({
      table: "organization_documents",
      method: "eq",
      args: ["slug", "regulations"]
    });
    expect(fake.calls).toContainEqual({
      table: "organization_documents",
      method: "eq",
      args: ["status", "published"]
    });
    expect(fake.calls).toContainEqual({
      table: "organization_documents",
      method: "limit",
      args: [1]
    });
    expect(fake.calls).toContainEqual({
      table: "content_assets",
      method: "eq",
      args: ["organization_document_id", "00000000-0000-4000-8000-000000000601"]
    });
  });

  it("reads a publication and maps the abstract/body/source", async () => {
    const fake = createFakeSupabase({
      tables: {
        publications: [publicationRow()],
        content_assets: []
      }
    });

    const result = await fetchReaderDocument(
      fake.client,
      "publication",
      "sample-publication"
    );

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;

    const model = result.items[0];
    expect(model).toMatchObject({
      kind: "publication",
      documentType: null,
      language: "en",
      publicationDate: "2026-02-01",
      externalUrl: "https://example.org/publication",
      availableLocales: ["en"],
      source: {
        provider: "google_doc",
        path: null,
        externalId: "drive-doc-123",
        syncedAt: "2026-10-19T08:00:00Z",
        allowOriginalDownload: false
      }
    });
    expect(model?.translations[0]).toMatchObject({
      locale: "en",
      title: "Sample publication",
      description: "Sample abstract",
      body: "Sample body",
      bodyAst: null,
      hasReadableContent: true
    });
    expect(fake.calls).toContainEqual({
      table: "content_assets",
      method: "eq",
      args: ["publication_id", "00000000-0000-4000-8000-000000000401"]
    });
  });

  it("excludes an unsupported AST version from available locales", async () => {
    const fake = createFakeSupabase({
      tables: {
        organization_documents: [
          documentRow({
            organization_document_translations: [
              {
                locale: "en",
                title: "Unsupported",
                description: null,
                body: null,
                body_ast: AST,
                body_ast_version: 2
              }
            ]
          })
        ],
        content_assets: []
      }
    });

    const result = await fetchReaderDocument(
      fake.client,
      "document",
      "regulations"
    );

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.items[0]?.availableLocales).toEqual([]);
    expect(result.items[0]?.translations[0]).toMatchObject({
      bodyAst: null,
      hasReadableContent: false
    });
  });

  it("returns empty when no published row matches the slug", async () => {
    const fake = createFakeSupabase({
      tables: { organization_documents: [], content_assets: [] }
    });

    await expect(
      fetchReaderDocument(fake.client, "document", "missing")
    ).resolves.toEqual({ kind: "empty" });
  });

  it("maps a row query failure to unavailable", async () => {
    const fake = createFakeSupabase({
      errors: { organization_documents: { message: "boom" } }
    });

    await expect(
      fetchReaderDocument(fake.client, "document", "regulations")
    ).resolves.toEqual({ kind: "unavailable" });
  });

  it("maps an asset query failure to unavailable", async () => {
    const fake = createFakeSupabase({
      tables: { organization_documents: [documentRow()] },
      errors: { content_assets: { message: "boom" } }
    });

    await expect(
      fetchReaderDocument(fake.client, "document", "regulations")
    ).resolves.toEqual({ kind: "unavailable" });
  });
});
