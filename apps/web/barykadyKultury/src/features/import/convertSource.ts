import { docxToReaderAst, type DocxConversionOptions } from "./docxToReaderAst";
import { ImportConversionError } from "./errors";
import { DEFAULT_IMPORT_LIMITS, type ImportLimits } from "./limits";
import {
  markdownToReaderAst,
  type MarkdownConversionOptions
} from "./mdastToReaderAst";
import type { ConversionResult, ConversionSource } from "./types";
import { validateImportFile } from "./validateImportFile";

export interface ConvertSourceOptions {
  readonly limits?: ImportLimits;
  readonly markdown?: MarkdownConversionOptions;
  readonly docx?: Omit<DocxConversionOptions, "limits">;
}

/**
 * Isomorphic import entry point shared by the worker and future T-042
 * background function (D-33/D-40): validate the boundary, then dispatch to the
 * format converter. The returned AST is the only content representation that
 * leaves this module; no HTML string or mdast tree crosses the worker boundary.
 */
export async function convertSource(
  source: ConversionSource,
  options: ConvertSourceOptions = {}
): Promise<ConversionResult> {
  const limits = options.limits ?? DEFAULT_IMPORT_LIMITS;

  const detected = validateImportFile(
    {
      name: source.fileName,
      type: source.mimeType,
      size: source.bytes.byteLength
    },
    limits
  );

  if (detected.format === "markdown") {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(
      source.bytes
    );
    if (text.trim() === "") {
      throw new ImportConversionError("emptyDocument", source.fileName);
    }
    return markdownToReaderAst(text, options.markdown);
  }

  return docxToReaderAst(source.bytes, {
    limits,
    ...(options.docx?.createAssetId !== undefined
      ? { createAssetId: options.docx.createAssetId }
      : {})
  });
}
