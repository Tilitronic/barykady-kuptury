import { describe, expect, it } from "vitest";

import { useUpload } from "@/features/files/useUpload";
import { createFakeSupabase } from "@/test-utils/fakeSupabase";

/**
 * T-029 RED contract — the one upload seam.
 *
 * Authority:
 *   - docs/architecture.md §6 — validate type/size and safe name before any
 *     bytes are transferred; the bucket policy is the server authority.
 *   - docs/tickets/T-029-admin-publications-documents.md — upload →
 *     persist storage path → clean up the object when the row insert fails.
 *   - T-014/T-027/T-028 — the same validation/upload sequence already existed
 *     three times (cover, portrait, import); this composable is the shared
 *     implementation.
 */

function pdf(name = "report.pdf") {
  return new File(["%PDF-1.4"], name, { type: "application/pdf" });
}

function svg() {
  return new File(["<svg/>"], "logo.svg", { type: "image/svg+xml" });
}

describe("useUpload", () => {
  it("calls validateUpload before the storage upload", async () => {
    const fake = createFakeSupabase();
    const upload = useUpload({
      supabase: fake.client,
      bucket: "public-documents",
      folder: "publications"
    });

    const result = await upload.upload(svg());

    expect(result).toMatchObject({ ok: false, code: "invalid-upload" });
    // No bytes reached Storage: the decisive ordering guarantee.
    expect(fake.storageCalls).toHaveLength(0);
  });

  it("uploads the sanitised name to the chosen bucket and never returns a URL", async () => {
    const fake = createFakeSupabase();
    const upload = useUpload({
      supabase: fake.client,
      bucket: "public-documents",
      folder: "publications"
    });

    const result = await upload.upload(pdf());

    expect(result).toMatchObject({
      ok: true,
      path: "publications/report.pdf",
      mimeType: "application/pdf",
      size: 8
    });
    expect(fake.storageCalls).toEqual([
      {
        op: "upload",
        bucket: "public-documents",
        path: "publications/report.pdf",
        contentType: "application/pdf"
      }
    ]);
    expect(JSON.stringify(result)).not.toContain("http");
  });

  it("validates every file before transferring any bytes", async () => {
    const fake = createFakeSupabase();
    const upload = useUpload({
      supabase: fake.client,
      bucket: "public-documents",
      folder: "publications"
    });

    const result = await upload.uploadMany([pdf(), svg()]);

    expect(result).toMatchObject({ ok: false, code: "invalid-upload" });
    expect(fake.storageCalls).toHaveLength(0);
  });

  it("cleans up the object when the row insert fails", async () => {
    const fake = createFakeSupabase();
    const upload = useUpload({
      supabase: fake.client,
      bucket: "public-documents",
      folder: "publications"
    });

    const result = await upload.uploadAndPersist(pdf(), async () => ({
      ok: false,
      code: "failed"
    }));

    expect(result).toMatchObject({
      ok: false,
      code: "persist-failed",
      cleanedUp: true
    });
    expect(fake.storageCalls.map(call => call.op)).toEqual([
      "upload",
      "remove"
    ]);
    expect(fake.storageCalls[1]).toMatchObject({
      bucket: "public-documents",
      path: "publications/report.pdf"
    });
  });

  it("removes a replaced object only after a successful insert", async () => {
    const fake = createFakeSupabase();
    const upload = useUpload({
      supabase: fake.client,
      bucket: "public-documents"
    });

    const result = await upload.uploadAndPersist(
      pdf(),
      async () => ({ ok: true, id: "publication-1" }),
      ["publications/old.pdf"]
    );

    expect(result).toMatchObject({ ok: true });
    expect(fake.storageCalls.map(call => call.path)).toEqual([
      "report.pdf",
      "publications/old.pdf"
    ]);
  });

  it("reports unavailable without a client and makes no request", async () => {
    const upload = useUpload({
      supabase: null,
      bucket: "public-documents"
    });

    expect(await upload.upload(pdf())).toMatchObject({
      ok: false,
      code: "unavailable"
    });
  });
});
