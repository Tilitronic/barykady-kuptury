/**
 * T-042 — injectable Google Drive client.
 *
 * The sync engine depends on this tiny interface, never on `fetch`/Google
 * directly, so every test uses deterministic fixtures. The binding supplies an
 * access token resolved from the per-admin vault; no token is ever logged.
 *
 * Export is DOCX only. The 10 MB cap is checked from `content-length` before
 * reading and again from the actual bytes (headers can lie/be absent).
 *
 * D-41 review fix: every Drive call is scoped to the configured shared NGO
 * folder. `sharedFolderId` is required — there is no "no folder configured"
 * pass-through. `getFileMetadata` reads `parents`; `exportDocx` calls the same
 * check before reading bytes, so an out-of-folder id cannot be exported even
 * when a caller bypasses the sync engine. Each hop has its own AbortController
 * timeout code (`drive-metadata-timeout`, `drive-export-timeout`).
 */

import { GOOGLE_DRIVE_TIMEOUT_MS, withAbortTimeout } from "./timeouts";

export const DRIVE_EXPORT_MAX_BYTES = 10 * 1024 * 1024;
export const GOOGLE_DOC_MIME = "application/vnd.google-apps.document";
export const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export interface DriveFileMetadata {
  readonly id: string;
  readonly name: string;
  readonly mimeType: string;
  readonly modifiedTime: string;
  /** Drive parents; used to prove the file lives in the shared NGO folder. */
  readonly parents?: readonly string[];
}

export interface DriveClient {
  getFileMetadata(fileId: string): Promise<DriveFileMetadata>;
  exportDocx(fileId: string): Promise<ArrayBuffer>;
}

export class DriveRequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "DriveRequestError";
    this.status = status;
  }
}

export class DriveExportTooLargeError extends Error {
  readonly code = "export-too-large";

  constructor(sizeBytes: number) {
    super(`Drive export exceeds the limit (${sizeBytes} bytes)`);
    this.name = "DriveExportTooLargeError";
  }
}

export class DriveOutOfFolderError extends Error {
  readonly code = "out-of-folder";

  constructor() {
    super("The Google Doc is outside the configured shared folder");
    this.name = "DriveOutOfFolderError";
  }
}

export class DriveFolderNotConfiguredError extends Error {
  readonly code = "folder-not-configured";

  constructor() {
    super("The shared Google Drive folder is not configured");
    this.name = "DriveFolderNotConfiguredError";
  }
}

export class DriveTimeoutError extends Error {
  readonly code: "drive-metadata-timeout" | "drive-export-timeout";

  constructor(code: DriveTimeoutError["code"]) {
    super(`Drive call timed out (${code})`);
    this.name = "DriveTimeoutError";
    this.code = code;
  }
}

export interface GoogleDriveClientOptions {
  readonly accessToken: string;
  readonly fetchImpl?: typeof fetch;
  readonly maxExportBytes?: number;
  /**
   * The single shared NGO folder every import must belong to (D-41).
   * Required: a blank value is a configuration error, never an unscoped call.
   */
  readonly sharedFolderId: string;
  readonly timeoutMs?: number;
}

const DRIVE_FILES_BASE = "https://www.googleapis.com/drive/v3/files";
const METADATA_FIELDS = "id,name,mimeType,modifiedTime,parents";

function authHeaders(accessToken: string): Record<string, string> {
  return {
    authorization: `Bearer ${accessToken}`,
    accept: "application/json"
  };
}

function readMetadata(payload: unknown): DriveFileMetadata | null {
  if (typeof payload !== "object" || payload === null) return null;
  const row = payload as Record<string, unknown>;
  if (
    typeof row.id !== "string" ||
    typeof row.name !== "string" ||
    typeof row.mimeType !== "string" ||
    typeof row.modifiedTime !== "string"
  ) {
    return null;
  }
  const parents = Array.isArray(row.parents)
    ? row.parents.filter((value): value is string => typeof value === "string")
    : undefined;
  return {
    id: row.id,
    name: row.name,
    mimeType: row.mimeType,
    modifiedTime: row.modifiedTime,
    ...(parents !== undefined ? { parents } : {})
  };
}

export function createGoogleDriveClient(
  options: GoogleDriveClientOptions
): DriveClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const maxExportBytes = options.maxExportBytes ?? DRIVE_EXPORT_MAX_BYTES;
  const timeoutMs = options.timeoutMs ?? GOOGLE_DRIVE_TIMEOUT_MS;
  const verifiedFiles = new Set<string>();

  function requireFolderId(): string {
    const value = options.sharedFolderId.trim();
    if (value === "") throw new DriveFolderNotConfiguredError();
    return value;
  }

  async function getFileMetadata(fileId: string): Promise<DriveFileMetadata> {
    const folderId = requireFolderId();
    const url = new URL(`${DRIVE_FILES_BASE}/${encodeURIComponent(fileId)}`);
    url.searchParams.set("fields", METADATA_FIELDS);
    url.searchParams.set("supportsAllDrives", "true");

    let response: Response;
    try {
      response = await withAbortTimeout(
        "drive-metadata-timeout",
        timeoutMs,
        signal =>
          fetchImpl(url, {
            method: "GET",
            headers: authHeaders(options.accessToken),
            signal
          })
      );
    } catch (error) {
      if (error instanceof DriveTimeoutError) throw error;
      if ((error as { code?: unknown }).code === "drive-metadata-timeout") {
        throw new DriveTimeoutError("drive-metadata-timeout");
      }
      throw error;
    }

    if (!response.ok) {
      throw new DriveRequestError(response.status, "Drive metadata failed");
    }
    const metadata = readMetadata(await response.json());
    if (metadata === null) {
      throw new DriveRequestError(502, "Drive metadata was malformed");
    }
    if (
      metadata.parents === undefined ||
      !metadata.parents.includes(folderId)
    ) {
      throw new DriveOutOfFolderError();
    }
    verifiedFiles.add(fileId);
    return metadata;
  }

  async function exportDocx(fileId: string): Promise<ArrayBuffer> {
    requireFolderId();
    // The export endpoint does not carry a folder filter, so prove the parent
    // relationship first (cached after the sync engine's metadata call).
    if (!verifiedFiles.has(fileId)) {
      await getFileMetadata(fileId);
    }

    const url = new URL(
      `${DRIVE_FILES_BASE}/${encodeURIComponent(fileId)}/export`
    );
    url.searchParams.set("mimeType", DOCX_MIME);
    url.searchParams.set("supportsAllDrives", "true");

    let response: Response;
    try {
      response = await withAbortTimeout(
        "drive-export-timeout",
        timeoutMs,
        signal =>
          fetchImpl(url, {
            method: "GET",
            headers: authHeaders(options.accessToken),
            signal
          })
      );
    } catch (error) {
      if ((error as { code?: unknown }).code === "drive-export-timeout") {
        throw new DriveTimeoutError("drive-export-timeout");
      }
      throw error;
    }

    if (!response.ok) {
      throw new DriveRequestError(response.status, "Drive export failed");
    }

    const declared = Number.parseInt(
      response.headers.get("content-length") ?? "",
      10
    );
    if (Number.isInteger(declared) && declared > maxExportBytes) {
      throw new DriveExportTooLargeError(declared);
    }

    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > maxExportBytes) {
      throw new DriveExportTooLargeError(bytes.byteLength);
    }
    return bytes;
  }

  return { getFileMetadata, exportDocx };
}
