import { describe, expect, it } from "vitest";

import { convertSource } from "../convertSource";
import { ImportConversionError } from "../errors";
import { DEFAULT_IMPORT_LIMITS } from "../limits";
import { validateImportFile } from "../validateImportFile";

/**
 * T-041 S2 — import boundary: file-type/size gates and format dispatch.
 *
 * Authority:
 * - docs/tickets/T-041-content-import.md §Conversion pipeline (limits) and
 *   D-35 (ODT deferred, localized save-as-DOCX guidance).
 * - src/features/files/validateUpload.ts — the existing extension/MIME/size
 *   guard is EXTENDED with Markdown, not reimplemented.
 */
describe("validateImportFile", () => {
  it("accepts Markdown by extension and MIME type", () => {
    expect(
      validateImportFile({
        name: "article.md",
        type: "text/markdown",
        size: 42
      })
    ).toMatchObject({
      format: "markdown",
      fileName: "article.md",
      extension: ".md",
      size: 42
    });
  });

  it("accepts a browser reporting text/plain for Markdown", () => {
    expect(
      validateImportFile({ name: "article.md", type: "text/plain", size: 42 })
    ).toMatchObject({ format: "markdown" });
  });

  it("accepts DOCX with the Open XML MIME type", () => {
    expect(
      validateImportFile({
        name: "report.docx",
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        size: 42
      })
    ).toMatchObject({ format: "docx", extension: ".docx" });
  });

  it("rejects ODT with the save-as-DOCX guidance code", () => {
    expect(() =>
      validateImportFile({
        name: "report.odt",
        type: "application/vnd.oasis.opendocument.text",
        size: 42
      })
    ).toThrowError(
      expect.objectContaining({ code: "odtDeferred" }) as ImportConversionError
    );
  });

  it("rejects macro-enabled DOCM with the save-as-DOCX guidance code", () => {
    expect(() =>
      validateImportFile({
        name: "report.docm",
        type: "application/vnd.ms-word.document.macroEnabled.12",
        size: 42
      })
    ).toThrowError(
      expect.objectContaining({ code: "docmRejected" }) as ImportConversionError
    );
  });

  it("rejects unsupported extensions such as PDF", () => {
    expect(() =>
      validateImportFile({
        name: "report.pdf",
        type: "application/pdf",
        size: 42
      })
    ).toThrowError(
      expect.objectContaining({
        code: "unsupportedExtension"
      }) as ImportConversionError
    );
  });

  it("rejects a MIME/extension mismatch", () => {
    expect(() =>
      validateImportFile({ name: "article.md", type: "image/png", size: 42 })
    ).toThrowError(
      expect.objectContaining({
        code: "mimeExtensionMismatch"
      }) as ImportConversionError
    );
  });

  it("rejects an empty file", () => {
    expect(() =>
      validateImportFile({ name: "article.md", type: "text/markdown", size: 0 })
    ).toThrowError(
      expect.objectContaining({ code: "emptyFile" }) as ImportConversionError
    );
  });

  it("applies the smaller Markdown size limit", () => {
    expect(() =>
      validateImportFile(
        {
          name: "article.md",
          type: "text/markdown",
          size: DEFAULT_IMPORT_LIMITS.maxMarkdownBytes + 1
        },
        DEFAULT_IMPORT_LIMITS
      )
    ).toThrowError(
      expect.objectContaining({ code: "fileTooLarge" }) as ImportConversionError
    );
  });
});

describe("convertSource", () => {
  it("dispatches Markdown bytes to the Markdown converter", async () => {
    const result = await convertSource({
      fileName: "article.md",
      mimeType: "text/markdown",
      bytes: new TextEncoder().encode("# Heading\n\nBody.").buffer
    });

    expect(result.ast.blocks).toEqual([
      {
        kind: "heading",
        level: 2,
        children: [{ kind: "text", value: "Heading" }]
      },
      {
        kind: "paragraph",
        children: [{ kind: "text", value: "Body." }]
      }
    ]);
  });

  it("rejects a whitespace-only Markdown document", async () => {
    await expect(
      convertSource({
        fileName: "empty.md",
        mimeType: "text/markdown",
        bytes: new TextEncoder().encode("   \n\n").buffer
      })
    ).rejects.toMatchObject({ code: "emptyDocument" });
  });
});
