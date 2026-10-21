import { describe, expect, it, vi } from "vitest";

import {
  createOriginalDownloadHandler,
  ORIGINAL_SIGNED_URL_TTL_SECONDS,
  type OriginalDownloadDependencies,
  type OriginalDownloadTarget
} from "../originalDownloadHandler";

/**
 * T-041 S4 — original-download policy. The handler is the security boundary:
 * published-only, toggle-on, source-path present, short-lived URL, no-store.
 * Supabase/storage are injected fakes; no credentials or network.
 */
const TARGET: OriginalDownloadTarget = {
  id: "00000000-0000-4000-8000-000000000001",
  status: "published",
  sourcePath: "sources/document/1/en/report.docx",
  allowOriginalDownload: true
};

function request(
  path = "/.netlify/functions/content-original?kind=document&slug=regulations",
  method = "GET"
): Request {
  return new Request(`https://example.test${path}`, { method });
}

function handler(overrides: Partial<OriginalDownloadDependencies> = {}) {
  return createOriginalDownloadHandler({
    lookup: async () => TARGET,
    createSignedUrl: async () =>
      "https://storage.example.test/object/sign/content-sources/report.docx",
    ...overrides
  });
}

describe("createOriginalDownloadHandler", () => {
  it("redirects to a short-lived signed URL for a published, enabled source", async () => {
    const createSignedUrl = vi.fn(async () => "https://signed.example/report");
    const response = await handler({ createSignedUrl })(request());

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://signed.example/report"
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(createSignedUrl).toHaveBeenCalledWith(
      TARGET.sourcePath,
      ORIGINAL_SIGNED_URL_TTL_SECONDS
    );
  });

  it("never serves a draft/archived row", async () => {
    const response = await handler({
      lookup: async () => ({ ...TARGET, status: "draft" })
    })(request());

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "not_found" });
  });

  it("honours the default-off toggle", async () => {
    const response = await handler({
      lookup: async () => ({ ...TARGET, allowOriginalDownload: false })
    })(request());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "download_disabled"
    });
  });

  it("rejects a missing source path even when the toggle is on", async () => {
    const response = await handler({
      lookup: async () => ({ ...TARGET, sourcePath: null })
    })(request());

    expect(response.status).toBe(403);
  });

  it("rejects invalid kind/slug input before lookup", async () => {
    const lookup = vi.fn(async () => TARGET);

    expect(
      (
        await handler({ lookup })(
          request(
            "/.netlify/functions/content-original?kind=team&slug=regulations"
          )
        )
      ).status
    ).toBe(400);
    expect(
      (
        await handler({ lookup })(
          request(
            "/.netlify/functions/content-original?kind=document&slug=../x"
          )
        )
      ).status
    ).toBe(400);
    expect(lookup).not.toHaveBeenCalled();
  });

  it("rejects non-GET/HEAD methods", async () => {
    const response = await handler()(
      request(
        "/.netlify/functions/content-original?kind=document&slug=regulations",
        "POST"
      )
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, HEAD");
  });

  it("returns HEAD without redirecting the caller into a body", async () => {
    const response = await handler()(
      request(
        "/.netlify/functions/content-original?kind=document&slug=regulations",
        "HEAD"
      )
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("storage.example");
    expect(await response.text()).toBe("");
  });

  it("collapses lookup/signing failures to a stable 502", async () => {
    expect(
      (
        await handler({
          lookup: async () => {
            throw new Error("database password leaked?");
          }
        })(request())
      ).status
    ).toBe(502);

    const unavailable = await handler({
      createSignedUrl: async () => null
    })(request());
    expect(unavailable.status).toBe(502);
    expect(JSON.stringify(await unavailable.json())).not.toContain("source");
  });
});
