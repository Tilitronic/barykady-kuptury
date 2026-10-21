import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { ReaderDocumentV1 } from "@/features/reader/types";
import type { Database } from "@/types/database.types";

import {
  persistConvertedTranslation,
  type PersistConvertedInput
} from "../persistConvertedTranslation";
import type { ConversionResult, ExtractedImage } from "../types";

const ENTITY_ID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const ASSET_ID = "1f8fad5b-d9cb-469f-a165-70867728950e";

function png(): ArrayBuffer {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13, false);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  view.setUint32(16, 10, false);
  view.setUint32(20, 10, false);
  return bytes.buffer;
}

function ast(): ReaderDocumentV1 {
  return {
    kind: "document",
    blocks: [
      { kind: "heading", level: 2, children: [{ kind: "text", value: "Hi" }] },
      { kind: "image", assetId: ASSET_ID, alt: "Image alt" }
    ]
  };
}

function image(): ExtractedImage {
  return {
    id: ASSET_ID,
    fileName: "image-1.png",
    mimeType: "image/png",
    bytes: png(),
    alt: "Image alt",
    needsAlt: false
  };
}

function result(overrides: Partial<ConversionResult> = {}): ConversionResult {
  return {
    ast: ast(),
    images: [image()],
    issues: [],
    publishable: true,
    ...overrides
  };
}

interface Upload {
  readonly bucket: string;
  readonly path: string;
  readonly options: unknown;
}

function createClient(
  options: {
    rpcData?: string | null;
    rpcError?: { message: string } | null;
    uploadError?: { message: string } | null;
  } = {}
) {
  const uploads: Upload[] = [];
  const removals: { bucket: string; paths: readonly string[] }[] = [];
  const rpcCalls: { name: string; args: Record<string, unknown> }[] = [];

  const client = {
    storage: {
      from: (bucket: string) => ({
        upload: async (
          path: string,
          _bytes: ArrayBuffer,
          uploadOptions: unknown
        ) => {
          uploads.push({ bucket, path, options: uploadOptions });
          return { error: options.uploadError ?? null };
        },
        remove: async (paths: readonly string[]) => {
          removals.push({ bucket, paths });
          return { error: null };
        }
      })
    },
    rpc: async (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      return {
        data: options.rpcData === undefined ? ENTITY_ID : options.rpcData,
        error: options.rpcError ?? null
      };
    }
  };

  return {
    client: client as unknown as SupabaseClient<Database>,
    uploads,
    removals,
    rpcCalls
  };
}

function input(
  overrides: Partial<PersistConvertedInput> = {}
): PersistConvertedInput {
  return {
    kind: "document",
    slug: "imported-doc",
    locale: "en",
    title: "Imported document",
    description: "Description",
    documentType: "report",
    status: "published",
    result: result(),
    source: { provider: "manual" },
    ...overrides
  };
}

describe("persistConvertedTranslation", () => {
  it("uploads images, calls the RPC once and never sends body", async () => {
    const fake = createClient();
    const response = await persistConvertedTranslation(fake.client, input(), {
      createEntityId: () => "path-scope-id",
      now: () => new Date("2030-05-01T00:00:00Z")
    });

    expect(response.entityId).toBe(ENTITY_ID);
    expect(fake.uploads).toHaveLength(1);
    expect(fake.uploads[0]).toMatchObject({
      bucket: "public-media",
      path: `content-assets/document/path-scope-id/en/${ASSET_ID}.png`
    });

    expect(fake.rpcCalls).toHaveLength(1);
    const args = fake.rpcCalls[0]!.args;
    expect(args).toMatchObject({
      p_kind: "document",
      p_slug: "imported-doc",
      p_locale: "en",
      p_title: "Imported document",
      p_status: "published",
      p_source_provider: "manual"
    });
    expect(args).not.toHaveProperty("p_body");
    expect(args.p_body_ast).toEqual(ast());
    expect(args.p_assets).toEqual([
      expect.objectContaining({
        id: ASSET_ID,
        mime_type: "image/png",
        width: 10,
        height: 10,
        size_bytes: 33
      })
    ]);
  });

  it("stores an upload original in the private source bucket", async () => {
    const fake = createClient();
    const response = await persistConvertedTranslation(
      fake.client,
      input({
        source: {
          provider: "upload",
          file: {
            fileName: "report.docx",
            mimeType: "text/markdown",
            bytes: png()
          }
        }
      })
    );

    expect(fake.uploads.map(upload => upload.bucket)).toEqual([
      "public-media",
      "content-sources"
    ]);
    expect(fake.uploads[1]).toMatchObject({
      path: expect.stringMatching(
        /^sources\/document\/.*\/en\/.*-report\.docx$/
      )
    });
    expect(response.sourcePath).toMatch(/^sources\/document\//);
    expect(fake.rpcCalls[0]!.args).toMatchObject({
      p_source_provider: "upload",
      p_source_synced_at: expect.any(String)
    });
  });

  it("rejects published content with blocking issues", async () => {
    const fake = createClient();
    await expect(
      persistConvertedTranslation(
        fake.client,
        input({
          result: result({
            publishable: false,
            issues: [{ code: "imageAltMissing", severity: "blocking" }]
          })
        })
      )
    ).rejects.toMatchObject({ code: "blockingIssues" });
    expect(fake.rpcCalls).toHaveLength(0);
  });

  it("allows a draft with blocking issues", async () => {
    const fake = createClient();
    await expect(
      persistConvertedTranslation(
        fake.client,
        input({
          status: "draft",
          result: result({
            publishable: false,
            issues: [{ code: "imageAltMissing", severity: "blocking" }]
          })
        })
      )
    ).resolves.toMatchObject({ entityId: ENTITY_ID });
  });

  it("rejects a missing title and an invalid Google source", async () => {
    const fake = createClient();

    await expect(
      persistConvertedTranslation(fake.client, input({ title: "  " }))
    ).rejects.toMatchObject({ code: "titleRequired" });

    await expect(
      persistConvertedTranslation(
        fake.client,
        input({ source: { provider: "google_doc" } })
      )
    ).rejects.toMatchObject({ code: "invalidSource" });
  });

  it("rejects an original download without a source file", async () => {
    const fake = createClient();
    await expect(
      persistConvertedTranslation(
        fake.client,
        input({ source: { provider: "manual", allowOriginalDownload: true } })
      )
    ).rejects.toMatchObject({ code: "invalidSource" });
  });

  it("cleans up uploaded objects when the RPC fails", async () => {
    const fake = createClient({
      rpcError: { message: "asset belongs to another owner" }
    });

    await expect(
      persistConvertedTranslation(fake.client, input())
    ).rejects.toMatchObject({ code: "persistFailed" });

    expect(fake.removals).toEqual([
      {
        bucket: "public-media",
        paths: [
          expect.stringMatching(
            new RegExp(`^content-assets/document/.+/en/${ASSET_ID}\\.png$`)
          )
        ]
      }
    ]);
  });

  it("surfaces an image metadata failure before any RPC write", async () => {
    const fake = createClient();
    const badImage = { ...image(), bytes: new ArrayBuffer(3) };

    await expect(
      persistConvertedTranslation(
        fake.client,
        input({ result: result({ images: [badImage] }) })
      )
    ).rejects.toMatchObject({ code: "imageMetadataFailed" });
    expect(fake.rpcCalls).toHaveLength(0);
  });
});
