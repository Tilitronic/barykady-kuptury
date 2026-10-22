import { describe, expect, it, vi } from "vitest";

import {
  createGoogleDriveClient,
  DOCX_MIME,
  DriveExportTooLargeError,
  DriveFolderNotConfiguredError,
  DriveOutOfFolderError,
  DriveRequestError,
  DriveTimeoutError
} from "../googleDriveClient";

/** T-042 — Drive client contract with a fake fetch; no Google access. */
const FOLDER = "shared-folder-1";
const METADATA = {
  id: "drive-file-1",
  name: "Statute",
  mimeType: "application/vnd.google-apps.document",
  modifiedTime: "2030-05-01T10:00:00.000Z",
  parents: [FOLDER]
};

function requestUrl(input: string | URL | Request): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function client(
  fetchImpl: typeof fetch,
  overrides: Partial<Parameters<typeof createGoogleDriveClient>[0]> = {}
) {
  return createGoogleDriveClient({
    accessToken: "server-token",
    fetchImpl,
    sharedFolderId: FOLDER,
    ...overrides
  });
}

/** Routes metadata/export so the mandatory folder check succeeds first. */
function driveRouter(input: {
  metadata?: unknown;
  exportResponse: () => Response;
}) {
  return vi.fn(async (request: string | URL | Request) => {
    if (requestUrl(request).includes("/export")) {
      return input.exportResponse();
    }
    return jsonResponse(input.metadata ?? METADATA);
  });
}

describe("createGoogleDriveClient", () => {
  it("requests only the metadata fields the sync engine needs", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(METADATA));
    await expect(
      client(fetchImpl as unknown as typeof fetch).getFileMetadata(
        "drive-file-1"
      )
    ).resolves.toEqual(METADATA);

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      URL,
      RequestInit
    ];
    expect(url.toString()).toContain("/drive/v3/files/drive-file-1");
    expect(url.searchParams.get("fields")).toBe(
      "id,name,mimeType,modifiedTime,parents"
    );
    expect(url.searchParams.get("supportsAllDrives")).toBe("true");
    expect((init.headers as Record<string, string>).authorization).toBe(
      "Bearer server-token"
    );
  });

  it("exports DOCX with the required MIME type", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const fetchImpl = driveRouter({
      exportResponse: () =>
        new Response(bytes, {
          status: 200,
          headers: { "content-length": String(bytes.byteLength) }
        })
    });

    await expect(
      client(fetchImpl as unknown as typeof fetch).exportDocx("drive-file-1")
    ).resolves.toEqual(bytes.buffer);
    const exportCall = fetchImpl.mock.calls.find(([request]) =>
      requestUrl(request).includes("/export")
    );
    const [url] = exportCall as unknown as [URL];
    expect(url.searchParams.get("mimeType")).toBe(DOCX_MIME);
  });

  it("rejects a declared export over 10 MB before reading", async () => {
    const fetchImpl = driveRouter({
      exportResponse: () =>
        new Response(null, {
          status: 200,
          headers: { "content-length": String(10 * 1024 * 1024 + 1) }
        })
    });

    await expect(
      client(fetchImpl as unknown as typeof fetch).exportDocx("big")
    ).rejects.toBeInstanceOf(DriveExportTooLargeError);
  });

  it("rejects an undeclared export whose bytes exceed the cap", async () => {
    const fetchImpl = driveRouter({
      exportResponse: () => new Response(new Uint8Array(16), { status: 200 })
    });

    await expect(
      client(fetchImpl as unknown as typeof fetch, {
        maxExportBytes: 8
      }).exportDocx("big")
    ).rejects.toBeInstanceOf(DriveExportTooLargeError);
  });

  it("maps upstream failures to a stable DriveRequestError", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("upstream secret", { status: 403 })
    );

    await expect(
      client(fetchImpl as unknown as typeof fetch).getFileMetadata("x")
    ).rejects.toMatchObject({
      name: "DriveRequestError",
      status: 403,
      message: "Drive metadata failed"
    });
    expect(DriveRequestError).toBeDefined();
  });
});

describe("shared-folder enforcement (D-41)", () => {
  it("accepts a file whose parent is the configured NGO folder", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(METADATA));

    await expect(
      client(fetchImpl as unknown as typeof fetch).getFileMetadata(
        "drive-file-1"
      )
    ).resolves.toEqual(METADATA);
  });

  it("refuses a file from an admin's personal Drive", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ ...METADATA, parents: ["personal-folder"] })
    );

    await expect(
      client(fetchImpl as unknown as typeof fetch).getFileMetadata(
        "drive-file-1"
      )
    ).rejects.toBeInstanceOf(DriveOutOfFolderError);
  });

  it("fails closed when the configured folder id is blank", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(METADATA));

    await expect(
      client(fetchImpl as unknown as typeof fetch, {
        sharedFolderId: ""
      }).getFileMetadata("drive-file-1")
    ).rejects.toBeInstanceOf(DriveFolderNotConfiguredError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("re-checks the folder before exporting without a prior metadata call", async () => {
    const fetchImpl = driveRouter({
      metadata: { ...METADATA, parents: ["personal-folder"] },
      exportResponse: () =>
        new Response(new Uint8Array([1, 2, 3]), { status: 200 })
    });

    await expect(
      client(fetchImpl as unknown as typeof fetch).exportDocx("drive-file-1")
    ).rejects.toBeInstanceOf(DriveOutOfFolderError);
  });
});

describe("external call timeouts", () => {
  it("aborts metadata with a distinct drive-metadata-timeout code", async () => {
    const fetchImpl = vi.fn(
      async (_input: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        })
    );

    await expect(
      client(fetchImpl as unknown as typeof fetch, {
        timeoutMs: 5
      }).getFileMetadata("drive-file-1")
    ).rejects.toMatchObject({
      name: "DriveTimeoutError",
      code: "drive-metadata-timeout"
    } satisfies Partial<DriveTimeoutError>);
  });

  it("aborts export with a distinct drive-export-timeout code", async () => {
    const fetchImpl = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        if (!requestUrl(input).includes("/export")) {
          return jsonResponse(METADATA);
        }
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        });
      }
    );

    await expect(
      client(fetchImpl as unknown as typeof fetch, { timeoutMs: 5 }).exportDocx(
        "drive-file-1"
      )
    ).rejects.toMatchObject({
      name: "DriveTimeoutError",
      code: "drive-export-timeout"
    } satisfies Partial<DriveTimeoutError>);
  });
});
