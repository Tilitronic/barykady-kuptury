import { describe, expect, it, vi } from "vitest";

import {
  createGoogleDriveClient,
  DOCX_MIME,
  DriveExportTooLargeError,
  DriveRequestError
} from "../googleDriveClient";

/** T-042 — Drive client contract with a fake fetch; no Google access. */
const METADATA = {
  id: "drive-file-1",
  name: "Statute",
  mimeType: "application/vnd.google-apps.document",
  modifiedTime: "2030-05-01T10:00:00.000Z"
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" }
  });
}

describe("createGoogleDriveClient", () => {
  it("requests only the metadata fields the sync engine needs", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(METADATA));
    const client = createGoogleDriveClient({
      accessToken: "server-token",
      fetchImpl
    });

    await expect(client.getFileMetadata("drive-file-1")).resolves.toEqual(
      METADATA
    );

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      URL,
      RequestInit
    ];
    expect(url.toString()).toContain("/drive/v3/files/drive-file-1");
    expect(url.searchParams.get("fields")).toBe(
      "id,name,mimeType,modifiedTime"
    );
    expect(url.searchParams.get("supportsAllDrives")).toBe("true");
    expect((init.headers as Record<string, string>).authorization).toBe(
      "Bearer server-token"
    );
  });

  it("exports DOCX with the required MIME type", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const fetchImpl = vi.fn(
      async () =>
        new Response(bytes, {
          status: 200,
          headers: { "content-length": String(bytes.byteLength) }
        })
    );
    const client = createGoogleDriveClient({
      accessToken: "server-token",
      fetchImpl
    });

    await expect(client.exportDocx("drive-file-1")).resolves.toEqual(
      bytes.buffer
    );
    const [url] = fetchImpl.mock.calls[0] as unknown as [URL];
    expect(url.searchParams.get("mimeType")).toBe(DOCX_MIME);
  });

  it("rejects a declared export over 10 MB before reading", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(null, {
          status: 200,
          headers: { "content-length": String(10 * 1024 * 1024 + 1) }
        })
    );
    const client = createGoogleDriveClient({
      accessToken: "server-token",
      fetchImpl
    });

    await expect(client.exportDocx("big")).rejects.toBeInstanceOf(
      DriveExportTooLargeError
    );
  });

  it("rejects an undeclared export whose bytes exceed the cap", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(new Uint8Array(16), { status: 200 })
    );
    const client = createGoogleDriveClient({
      accessToken: "server-token",
      fetchImpl,
      maxExportBytes: 8
    });

    await expect(client.exportDocx("big")).rejects.toBeInstanceOf(
      DriveExportTooLargeError
    );
  });

  it("maps upstream failures to a stable DriveRequestError", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("upstream secret", { status: 403 })
    );
    const client = createGoogleDriveClient({
      accessToken: "server-token",
      fetchImpl
    });

    await expect(client.getFileMetadata("x")).rejects.toMatchObject({
      name: "DriveRequestError",
      status: 403,
      message: "Drive metadata failed"
    });
    expect(DriveRequestError).toBeDefined();
  });
});
