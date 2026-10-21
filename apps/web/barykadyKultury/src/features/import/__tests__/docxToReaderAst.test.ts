import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import type {
  ReaderImageBlock,
  ReaderTableBlock
} from "@/features/reader/types";

import {
  collectDocxImage,
  docxToReaderAst,
  htmlToReaderAst,
  type DocxImageLike
} from "../docxToReaderAst";
import { ImportConversionError } from "../errors";
import { DEFAULT_IMPORT_LIMITS } from "../limits";
import type { ExtractedImage, ImportIssue } from "../types";

const IMAGE_ID = "0f8fad5b-d9cb-469f-a165-70867728950e";

function image(overrides: Partial<ExtractedImage> = {}): ExtractedImage {
  return {
    id: IMAGE_ID,
    fileName: "image-1.png",
    mimeType: "image/png",
    bytes: new Uint8Array([1, 2, 3]).buffer,
    alt: "",
    needsAlt: true,
    ...overrides
  };
}

function fixtureBytes(): ArrayBuffer {
  const path = resolve(
    process.cwd(),
    "src/features/import/__tests__/fixtures/minimal.docx"
  );
  const buffer = readFileSync(path);
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer;
}

/**
 * T-041 S2 — DOCX → ReaderDocument v1.
 *
 * Authority:
 * - docs/tickets/T-041-content-import.md §Conversion pipeline — mammoth HTML is
 *   parsed with rehype-parse and sanitized with hast-util-sanitize before it is
 *   mapped; images are extracted with convertImage; tables keep caption/scope/
 *   spans.
 * - supabase/migrations/20261020160000_reader_ast.sql — heading levels 2–4,
 *   table semantics, image asset UUID + alt rules.
 * - docs/tickets/DECISIONS.md D-33/D-36/D-37.
 */
describe("htmlToReaderAst", () => {
  it("sanitizes unsupported markup and attributes before mapping", () => {
    const result = htmlToReaderAst(
      [
        "<h1>Heading</h1>",
        '<p onclick="alert(1)">Hello <strong>world</strong><script>alert(1)</script></p>',
        '<iframe src="https://evil.example"></iframe>',
        "<style>body{display:none}</style>",
        '<p><a href="javascript:alert(1)">bad link</a></p>',
        '<img src="https://evil.example/pixel.png" onerror="alert(1)">'
      ].join("")
    );

    const serialized = JSON.stringify(result.ast);
    expect(serialized).not.toContain("script");
    expect(serialized).not.toContain("iframe");
    expect(serialized).not.toContain("javascript:");
    expect(serialized).not.toContain("evil.example");
    expect(result.ast.blocks[0]).toEqual({
      kind: "heading",
      level: 2,
      children: [{ kind: "text", value: "Heading" }]
    });
    expect(result.ast.blocks).toContainEqual({
      kind: "paragraph",
      children: [{ kind: "text", value: "bad link" }]
    });
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "unsafeLink", severity: "warning" })
    );
  });

  it("maps a table caption, header row, th scope and col/row spans", () => {
    const result = htmlToReaderAst(
      [
        '<p class="import-caption">Table 1: Results</p>',
        "<table>",
        '<thead><tr><th scope="col" colspan="2">Group</th></tr></thead>',
        "<tbody>",
        '<tr><th scope="row">Alpha</th><td rowspan="2">1</td></tr>',
        "<tr><td>2</td></tr>",
        "</tbody>",
        "</table>"
      ].join("")
    );

    const table = result.ast.blocks.find(
      (block): block is ReaderTableBlock => block.kind === "table"
    );
    expect(table).toMatchObject({
      kind: "table",
      caption: "Table 1: Results",
      headerRows: 1
    });
    expect(table?.rows[0]?.[0]).toEqual({
      header: true,
      scope: "col",
      colspan: 2,
      children: [{ kind: "text", value: "Group" }]
    });
    expect(table?.rows[1]?.[0]).toEqual({
      header: true,
      scope: "row",
      children: [{ kind: "text", value: "Alpha" }]
    });
    expect(table?.rows[1]?.[1]).toEqual({
      header: false,
      rowspan: 2,
      children: [{ kind: "text", value: "1" }]
    });
  });

  it("attaches a caption that follows a table (Word's usual caption position)", () => {
    const result = htmlToReaderAst(
      '<table><tr><td>A</td></tr></table><p class="import-caption">After caption</p>'
    );

    expect(result.ast.blocks).toHaveLength(1);
    expect(result.ast.blocks[0]).toMatchObject({
      kind: "table",
      caption: "After caption"
    });
  });

  it("maps an extracted image and flags missing alt text as blocking", () => {
    const result = htmlToReaderAst(
      `<p>Before</p><img src="asset:${IMAGE_ID}" alt=""><p>After</p>`,
      { images: [image()] }
    );

    const mapped = result.ast.blocks.find(
      (block): block is ReaderImageBlock => block.kind === "image"
    );
    expect(mapped).toEqual({
      kind: "image",
      assetId: IMAGE_ID,
      alt: "image-1.png"
    });
    expect(result.images[0]).toMatchObject({
      id: IMAGE_ID,
      alt: "",
      needsAlt: true
    });
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "imageAltMissing",
        severity: "blocking"
      })
    );
    expect(result.publishable).toBe(false);
  });

  it("keeps DOCX alt text and clears the blocking issue", () => {
    const result = htmlToReaderAst(
      `<img src="asset:${IMAGE_ID}" alt="A red dot">`,
      { images: [image()] }
    );

    expect(result.ast.blocks).toEqual([
      { kind: "image", assetId: IMAGE_ID, alt: "A red dot" }
    ]);
    expect(result.images[0]).toMatchObject({
      id: IMAGE_ID,
      alt: "A red dot",
      needsAlt: false
    });
    expect(result.publishable).toBe(true);
  });
});

describe("docxToReaderAst", () => {
  it("converts a real DOCX fixture with headings, text, a table and an image", async () => {
    const result = await docxToReaderAst(fixtureBytes(), {
      createAssetId: () => IMAGE_ID
    });

    expect(result.publishable).toBe(true);
    expect(result.ast.blocks[0]).toMatchObject({
      kind: "heading",
      level: 2,
      children: [{ kind: "text", value: "Imported heading" }]
    });

    const table = result.ast.blocks.find(
      (block): block is ReaderTableBlock => block.kind === "table"
    );
    expect(table?.caption).toBe("Table 1: Caption from DOCX");
    expect(table?.rows).toHaveLength(2);
    expect(table?.rows[0]?.[0]).toMatchObject({
      header: true,
      scope: "col"
    });

    const mappedImage = result.ast.blocks.find(
      (block): block is ReaderImageBlock => block.kind === "image"
    );
    expect(mappedImage).toEqual({
      kind: "image",
      assetId: IMAGE_ID,
      alt: "A red dot"
    });
    expect(result.images).toHaveLength(1);
    expect(result.images[0]).toMatchObject({
      id: IMAGE_ID,
      mimeType: "image/png",
      alt: "A red dot",
      needsAlt: false
    });
  });

  it("rejects a DOCX whose zip exceeds the configured entry limit before inflation", async () => {
    await expect(
      docxToReaderAst(fixtureBytes(), {
        limits: { ...DEFAULT_IMPORT_LIMITS, maxDocxEntries: 1 }
      })
    ).rejects.toMatchObject({
      code: "docxUnsafeZip",
      name: "ImportConversionError"
    });
  });

  it("rejects bytes that are not a DOCX zip", async () => {
    await expect(
      docxToReaderAst(new TextEncoder().encode("not a zip").buffer)
    ).rejects.toMatchObject({ code: "docxUnsafeZip" });
  });
});

describe("collectDocxImage", () => {
  const imageLike = (
    contentType: string,
    bytes: ArrayBuffer = new Uint8Array([1, 2, 3]).buffer
  ): DocxImageLike => ({
    contentType,
    readAsArrayBuffer: async () => bytes
  });

  it("extracts a PNG with a generated UUID and a reviewed file name", async () => {
    const images: ExtractedImage[] = [];
    const issues: ImportIssue[] = [];

    const result = await collectDocxImage(imageLike("image/png"), {
      images,
      issues,
      limits: DEFAULT_IMPORT_LIMITS,
      createAssetId: () => IMAGE_ID
    });

    expect(result).toEqual({ src: `asset:${IMAGE_ID}` });
    expect(images[0]).toMatchObject({
      id: IMAGE_ID,
      fileName: "image-1.png",
      mimeType: "image/png",
      alt: "",
      needsAlt: true
    });
    expect(issues).toEqual([]);
  });

  it("rejects unsupported image MIME types", async () => {
    const images: ExtractedImage[] = [];
    const issues: ImportIssue[] = [];

    const result = await collectDocxImage(imageLike("image/gif"), {
      images,
      issues,
      limits: DEFAULT_IMPORT_LIMITS
    });

    expect(result).toEqual({ src: "" });
    expect(images).toEqual([]);
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: "imageUnsupported",
        severity: "blocking",
        detail: "image/gif"
      })
    );
  });

  it("rejects an image above the configured size limit", async () => {
    const images: ExtractedImage[] = [];
    const issues: ImportIssue[] = [];

    const result = await collectDocxImage(
      imageLike("image/png", new ArrayBuffer(16)),
      {
        images,
        issues,
        limits: { ...DEFAULT_IMPORT_LIMITS, maxImageBytes: 8 }
      }
    );

    expect(result).toEqual({ src: "" });
    expect(images).toEqual([]);
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: "imageUnsupported",
        severity: "blocking"
      })
    );
  });
});

describe("ImportConversionError", () => {
  it("carries a stable code for localized messages", () => {
    const error = new ImportConversionError("odtDeferred");
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("ImportConversionError");
    expect(error.code).toBe("odtDeferred");
  });
});
