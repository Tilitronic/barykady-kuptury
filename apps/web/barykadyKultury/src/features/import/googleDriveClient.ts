/**
 * T-042 — injectable Google Drive client.
 *
 * The sync engine depends on this tiny interface, never on `fetch`/Google
 * directly, so every test uses deterministic fixtures. The binding supplies an
 * access token resolved from `googleCredentials.ts`; no token is ever logged.
 *
 * Export is DOCX only. The 10 MB cap is checked from `content-length` before
 * reading and again from the actual bytes (headers can lie/be absent).
 */

export const DRIVE_EXPORT_MAX_BYTES = 10 * 1024 * 1024;
export const GOOGLE_DOC_MIME = "application/vnd.google-apps.document";
export const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export interface DriveFileMetadata {
  readonly id: string;
  readonly name: string;
  readonly mimeType: string;
  readonly modifiedTime: string;
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

export interface GoogleDriveClientOptions {
  readonly accessToken: string;
  readonly fetchImpl?: typeof fetch;
  readonly maxExportBytes?: number;
}

const DRIVE_FILES_BASE = "https://www.googleapis.com/drive/v3/files";
const METADATA_FIELDS = "id,name,mimeType,modifiedTime";

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
  return {
    id: row.id,
    name: row.name,
    mimeType: row.mimeType,
    modifiedTime: row.modifiedTime
  };
}

export function createGoogleDriveClient(
  options: GoogleDriveClientOptions
): DriveClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const maxExportBytes = options.maxExportBytes ?? DRIVE_EXPORT_MAX_BYTES;

  return {
    async getFileMetadata(fileId: string): Promise<DriveFileMetadata> {
      const url = new URL(`${DRIVE_FILES_BASE}/${encodeURIComponent(fileId)}`);
      url.searchParams.set("fields", METADATA_FIELDS);
      url.searchParams.set("supportsAllDrives", "true");

      const response = await fetchImpl(url, {
        method: "GET",
        headers: authHeaders(options.accessToken)
      });

      if (!response.ok) {
        throw new DriveRequestError(response.status, "Drive metadata failed");
      }
      const metadata = readMetadata(await response.json());
      if (metadata === null) {
        throw new DriveRequestError(502, "Drive metadata was malformed");
      }
      return metadata;
    },

    async exportDocx(fileId: string): Promise<ArrayBuffer> {
      const url = new URL(
        `${DRIVE_FILES_BASE}/${encodeURIComponent(fileId)}/export`
      );
      url.searchParams.set("mimeType", DOCX_MIME);
      url.searchParams.set("supportsAllDrives", "true");

      const response = await fetchImpl(url, {
        method: "GET",
        headers: authHeaders(options.accessToken)
      });

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
  };
}
