/**
 * T-041 import errors.
 *
 * The converter never returns a raw exception to the admin UI: it returns a
 * stable code that the i18n catalogue maps to a localized message (EN/PL/UK).
 * The code is also part of the worker protocol, so it must stay serializable
 * and free of browser-only types.
 */
export type ImportErrorCode =
  | "emptyFile"
  | "fileTooLarge"
  | "invalidSize"
  | "invalidFileName"
  | "unsupportedExtension"
  | "unsupportedMime"
  | "mimeExtensionMismatch"
  | "activeContent"
  | "odtDeferred"
  | "docmRejected"
  | "docxUnsafeZip"
  | "docxMacros"
  | "docxInvalid"
  | "emptyDocument"
  | "conversionFailed"
  | "conversionTimeout";

/** A conversion failure that the UI can localize from `code`. */
export class ImportConversionError extends Error {
  readonly code: ImportErrorCode;
  readonly detail: string | undefined;

  constructor(code: ImportErrorCode, detail?: string) {
    super(detail === undefined ? code : `${code}: ${detail}`);
    this.name = "ImportConversionError";
    this.code = code;
    this.detail = detail;
  }
}

export function isImportConversionError(
  value: unknown
): value is ImportConversionError {
  return (
    value instanceof ImportConversionError ||
    (typeof value === "object" &&
      value !== null &&
      (value as { name?: unknown }).name === "ImportConversionError" &&
      typeof (value as { code?: unknown }).code === "string")
  );
}
