import {
  extensionOf,
  type UploadFileLike,
  validateUpload,
  type AllowedMimeType
} from "../files/validateUpload";

import { ImportConversionError } from "./errors";
import { DEFAULT_IMPORT_LIMITS, type ImportLimits } from "./limits";
import type { ImportFormat } from "./types";

/** A browser `File` (or a test double) before its bytes are read. */
export interface ImportFileLike extends UploadFileLike {
  readonly name: string;
  readonly type: string;
  readonly size: number;
}

export interface DetectedImportFile {
  readonly format: ImportFormat;
  readonly fileName: string;
  readonly mimeType: AllowedMimeType;
  readonly extension: ".md" | ".docx";
  readonly size: number;
}

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * T-041 import gate.
 *
 * Reuses `validateUpload` for path/name sanitisation, active-content rejection,
 * MIME/extension consistency and the size ceiling. Import adds:
 * - the smaller worker-safe limits (`limits.ts`),
 * - Markdown as an accepted source format,
 * - actionable codes for ODT/DOCM instead of a generic "unsupported file".
 *
 * D-35 deliberately has no ODT converter. The UI maps `odtDeferred` /
 * `docmRejected` to a localized "Save as DOCX" message; the code, not the
 * English text, crosses this boundary.
 */
export function validateImportFile(
  file: ImportFileLike,
  limits: ImportLimits = DEFAULT_IMPORT_LIMITS
): DetectedImportFile {
  if (!Number.isInteger(file.size) || file.size < 0) {
    throw new ImportConversionError("invalidSize");
  }
  if (file.size === 0) {
    throw new ImportConversionError("emptyFile", file.name);
  }

  // The docx ceiling is the larger of the two, so it is the correct first
  // gate; Markdown is checked again after the format is known.
  const validation = validateUpload(file, {
    maxBytes: limits.maxDocxCompressedBytes
  });

  if (!validation.ok) {
    switch (validation.code) {
      case "file-too-large":
        throw new ImportConversionError("fileTooLarge", file.name);
      case "invalid-size":
        throw new ImportConversionError("invalidSize", file.name);
      case "empty-name":
      case "path-traversal":
        throw new ImportConversionError("invalidFileName", file.name);
      case "active-content":
        throw new ImportConversionError("activeContent", file.name);
      case "unsupported-mime":
        throw new ImportConversionError("unsupportedMime", file.name);
      case "mime-extension-mismatch":
        throw new ImportConversionError("mimeExtensionMismatch", file.name);
      case "unsupported-extension": {
        const extension = extensionOf(file.name);
        if (extension === ".odt") {
          throw new ImportConversionError("odtDeferred", file.name);
        }
        if (extension === ".docm") {
          throw new ImportConversionError("docmRejected", file.name);
        }
        throw new ImportConversionError("unsupportedExtension", file.name);
      }
    }
  }

  const extension = extensionOf(validation.fileName);
  if (extension === ".md") {
    if (validation.size > limits.maxMarkdownBytes) {
      throw new ImportConversionError("fileTooLarge", file.name);
    }
    return {
      format: "markdown",
      fileName: validation.fileName,
      mimeType: validation.mimeType,
      extension: ".md",
      size: validation.size
    };
  }

  if (extension === ".docx" && validation.mimeType === DOCX_MIME) {
    return {
      format: "docx",
      fileName: validation.fileName,
      mimeType: validation.mimeType,
      extension: ".docx",
      size: validation.size
    };
  }

  throw new ImportConversionError("unsupportedExtension", file.name);
}
