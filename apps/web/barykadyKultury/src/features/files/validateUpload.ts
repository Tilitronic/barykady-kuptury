/**
 * T-014 — pure upload validation for the admin upload path.
 *
 * Authority:
 * - docs/architecture.md §6: validate upload type and size, use safe file
 *   names, reject active/executable content, and never render untrusted
 *   SVG/HTML as inline active content.
 * - docs/tickets/T-014-storage-policies.md: extension allow-list, MIME
 *   allow-list, extension↔MIME consistency, size boundary, filename
 *   sanitisation and collision-safe name appending.
 *
 * This module deliberately has no Supabase import. The bucket-level
 * `allowed_mime_types` and `file_size_limit` are the server-side authority;
 * this validator is the fast, testable client guard that keeps obviously
 * invalid files from ever reaching the network. The two must agree.
 */

/** 50 MiB. Mirrors the bucket-level `file_size_limit` set in the migration. */
export const MAX_UPLOAD_BYTES = 52_428_800;

/**
 * SVG, HTML and JavaScript are absent by design: they can execute when served
 * inline. DOCX is included because D-12 recommends publishing the original
 * regulation documents alongside a PDF.
 */
export const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".docx"
] as const;

export type AllowedExtension = (typeof ALLOWED_EXTENSIONS)[number];

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

/**
 * One extension may map to one or more MIME types. `.jpg`/`.jpeg` share
 * `image/jpeg`; the other extensions are unambiguous.
 */
const MIME_BY_EXTENSION: Record<AllowedExtension, readonly AllowedMimeType[]> =
  {
    ".pdf": ["application/pdf"],
    ".png": ["image/png"],
    ".jpg": ["image/jpeg"],
    ".jpeg": ["image/jpeg"],
    ".webp": ["image/webp"],
    ".docx": [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ]
  };

const ACTIVE_CONTENT_EXTENSIONS = new Set<string>([
  ".svg",
  ".svgz",
  ".html",
  ".htm",
  ".xhtml",
  ".js",
  ".mjs",
  ".cjs"
]);

const ACTIVE_CONTENT_MIME_TYPES = new Set<string>([
  "image/svg+xml",
  "text/html",
  "application/xhtml+xml",
  "text/javascript",
  "application/javascript",
  "application/x-javascript",
  "application/ecmascript",
  "text/ecmascript"
]);

/**
 * C0/C1 controls, soft hyphen, bidi overrides, zero-width characters, word
 * joiners and BOM. These can disguise a file's real extension or spoof a
 * filename in the UI. Expressed as code-point ranges (rather than a regex
 * containing control characters) so the intent is explicit and lint-clean.
 */
function isUnsafeCodePoint(codePoint: number): boolean {
  return (
    (codePoint >= 0x00 && codePoint <= 0x1f) ||
    (codePoint >= 0x7f && codePoint <= 0x9f) ||
    codePoint === 0x00ad ||
    codePoint === 0x061c ||
    codePoint === 0x180e ||
    (codePoint >= 0x200b && codePoint <= 0x200f) ||
    (codePoint >= 0x202a && codePoint <= 0x202e) ||
    (codePoint >= 0x2060 && codePoint <= 0x206f) ||
    codePoint === 0xfeff
  );
}

export interface UploadFileLike {
  readonly name: string;
  readonly type: string;
  readonly size: number;
}

export type UploadRejectionCode =
  | "empty-name"
  | "path-traversal"
  | "unsupported-extension"
  | "unsupported-mime"
  | "mime-extension-mismatch"
  | "active-content"
  | "file-too-large"
  | "invalid-size";

export interface ValidatedUpload {
  readonly ok: true;
  /** Sanitised, collision-safe name to store (not the raw browser name). */
  readonly fileName: string;
  readonly mimeType: AllowedMimeType;
  readonly size: number;
}

export interface UploadRejection {
  readonly ok: false;
  readonly code: UploadRejectionCode;
  readonly message: string;
}

export type UploadValidation = ValidatedUpload | UploadRejection;

export interface ValidateUploadOptions {
  /** Names already present in the destination folder, for collision checks. */
  readonly existingNames?: readonly string[];
}

function reject(code: UploadRejectionCode, message: string): UploadRejection {
  return { ok: false, code, message };
}

function normalizeMimeType(raw: string): string {
  // Browsers may append parameters (e.g. "; charset=binary"); only the media
  // type is meaningful for the allow-list comparison.
  return (raw.split(";")[0] ?? "").trim().toLowerCase();
}

function extensionOf(name: string): string | null {
  const dot = name.lastIndexOf(".");
  // A leading dot (".pdf") has no stem and is not an acceptable file name.
  if (dot <= 0) {
    return null;
  }
  return name.slice(dot).toLowerCase();
}

/**
 * Removes characters that are never safe in a stored file name. Keeps the
 * original case because storage keys are case-sensitive and users expect the
 * name they chose.
 */
export function sanitizeFileName(name: string): string {
  return Array.from(name.normalize("NFC"))
    .filter(character => !isUnsafeCodePoint(character.codePointAt(0) ?? 0))
    .join("")
    .trim();
}

/**
 * Returns `fileName` if it is free, otherwise appends `-1`, `-2`, … before the
 * extension. Comparison is case-insensitive so `Report.PDF` cannot shadow
 * `report.pdf` on a case-insensitive filesystem or in a human listing.
 */
export function makeCollisionSafeName(
  fileName: string,
  existingNames: readonly string[] = []
): string {
  const taken = new Set(existingNames.map(name => name.toLowerCase()));
  if (!taken.has(fileName.toLowerCase())) {
    return fileName;
  }

  const dot = fileName.lastIndexOf(".");
  const stem = dot > 0 ? fileName.slice(0, dot) : fileName;
  const extension = dot > 0 ? fileName.slice(dot) : "";

  let counter = 1;
  let candidate = `${stem}-${counter}${extension}`;
  while (taken.has(candidate.toLowerCase())) {
    counter += 1;
    candidate = `${stem}-${counter}${extension}`;
  }

  return candidate;
}

export function validateUpload(
  file: UploadFileLike,
  options: ValidateUploadOptions = {}
): UploadValidation {
  if (typeof file.name !== "string" || file.name.trim() === "") {
    return reject("empty-name", "A file name is required.");
  }

  // Reject traversal before sanitisation: stripping separators would silently
  // turn "../../x.pdf" into a harmless-looking name and hide the attack.
  if (
    file.name.includes("/") ||
    file.name.includes("\\") ||
    file.name.includes("..")
  ) {
    return reject(
      "path-traversal",
      "File names may not contain path segments."
    );
  }

  const sanitized = sanitizeFileName(file.name);
  if (sanitized === "") {
    return reject("empty-name", "A file name is required.");
  }

  const extension = extensionOf(sanitized);
  if (!extension) {
    return reject(
      "unsupported-extension",
      "The file has no supported extension."
    );
  }

  if (ACTIVE_CONTENT_EXTENSIONS.has(extension)) {
    return reject(
      "active-content",
      "SVG, HTML and JavaScript uploads are not permitted."
    );
  }

  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(extension)) {
    return reject(
      "unsupported-extension",
      `Unsupported file extension: ${extension}`
    );
  }

  const mimeType = normalizeMimeType(file.type);
  if (ACTIVE_CONTENT_MIME_TYPES.has(mimeType)) {
    return reject(
      "active-content",
      "SVG, HTML and JavaScript uploads are not permitted."
    );
  }

  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType)) {
    return reject(
      "unsupported-mime",
      `Unsupported MIME type: ${mimeType === "" ? "(empty)" : mimeType}`
    );
  }

  const expectedMimeTypes = MIME_BY_EXTENSION[extension as AllowedExtension];
  if (!expectedMimeTypes.includes(mimeType as AllowedMimeType)) {
    return reject(
      "mime-extension-mismatch",
      "The file extension does not match its MIME type."
    );
  }

  if (!Number.isInteger(file.size) || file.size < 0) {
    return reject("invalid-size", "The file size is invalid.");
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return reject(
      "file-too-large",
      `Files may not exceed ${MAX_UPLOAD_BYTES} bytes.`
    );
  }

  return {
    ok: true,
    fileName: makeCollisionSafeName(sanitized, options.existingNames),
    mimeType: mimeType as AllowedMimeType,
    size: file.size
  };
}
