import type { ReaderDocumentV1 } from "../reader/types";

import type { ImportErrorCode } from "./errors";

/** Formats the import pipeline accepts in this release (D-28/D-35). */
export const IMPORT_FORMATS = ["markdown", "docx"] as const;
export type ImportFormat = (typeof IMPORT_FORMATS)[number];

/** MIME types allowed for extracted reader images (D-36). */
export const IMPORT_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp"
] as const;
export type ImportImageMimeType = (typeof IMPORT_IMAGE_MIME_TYPES)[number];

/**
 * Non-fatal conversion feedback. `blocking` means the content must not be
 * published until an admin resolves it (T-041: missing image alt blocks
 * publish); `warning` means the content is safe but something was removed or
 * simplified.
 */
export type ImportIssueCode =
  | "rawHtmlDropped"
  | "unsafeLink"
  | "remoteImageStripped"
  | "imageUnresolved"
  | "nestedListFlattened"
  | "unsupportedFormatting"
  | "imageAltMissing"
  | "imageUnsupported"
  | "docxWarning";

export interface ImportIssue {
  readonly code: ImportIssueCode;
  readonly severity: "warning" | "blocking";
  readonly detail?: string;
}

/**
 * An image extracted from DOCX. `id` is a provisional `content_assets.id`:
 * the persistence seam inserts the row with this exact UUID, so the AST
 * `assetId` and the database ownership check agree in the same transaction
 * (D-36). Bytes stay in the admin/worker boundary; the public reader only ever
 * sees `assetId`.
 */
export interface ExtractedImage {
  readonly id: string;
  /** Collision-safe storage name; used as the fallback alt text for review. */
  readonly fileName: string;
  readonly mimeType: ImportImageMimeType;
  readonly bytes: ArrayBuffer;
  /** Empty when the DOCX had no alt text. */
  readonly alt: string;
  /** True until an admin supplies alt text; blocks publish. */
  readonly needsAlt: boolean;
}

export interface ConversionResult {
  readonly ast: ReaderDocumentV1;
  readonly images: readonly ExtractedImage[];
  readonly issues: readonly ImportIssue[];
  /** False while any blocking issue remains (e.g. missing image alt). */
  readonly publishable: boolean;
}

/** Input is transferred to the worker, so `bytes` is a transferable buffer. */
export interface ConversionSource {
  readonly fileName: string;
  readonly mimeType: string;
  readonly bytes: ArrayBuffer;
}

/** The seam the worker implements; tests and future server imports inject fakes. */
export interface Converter {
  convert(source: ConversionSource): Promise<ConversionResult>;
}

/** Worker request/response protocol (structured-clone safe). */
export interface WorkerRequest {
  readonly kind: "convert";
  readonly source: ConversionSource;
}

export type WorkerResponse =
  | { readonly ok: true; readonly result: ConversionResult }
  | {
      readonly ok: false;
      readonly error: {
        readonly code: ImportErrorCode;
        readonly detail?: string;
      };
    };
