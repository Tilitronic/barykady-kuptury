import { describe, expect, it } from "vitest";

import {
  ALLOWED_EXTENSIONS,
  MAX_UPLOAD_BYTES,
  makeCollisionSafeName,
  validateUpload
} from "@/features/files/validateUpload";

/**
 * T-014 upload validation contract.
 *
 * Authority:
 * - docs/architecture.md §6 — safe file names, reject active content, validate
 *   type and size.
 * - docs/tickets/T-014-storage-policies.md — extension + MIME + size +
 *   sanitisation + collision-safe appending; no SVG/HTML/JS upload path.
 *
 * The validator is pure (no Supabase import) so it can run in the admin upload
 * path before a request is made. These tests pin the boundary between the
 * client-side guard and the bucket-level MIME/size policy.
 */
const file = (name: string, type: string, size = 1024) => ({
  name,
  type,
  size
});

describe("validateUpload", () => {
  it("accepts a valid PDF exactly at the size boundary", () => {
    expect(
      validateUpload(file("report.pdf", "application/pdf", MAX_UPLOAD_BYTES))
    ).toEqual({
      ok: true,
      fileName: "report.pdf",
      mimeType: "application/pdf",
      size: MAX_UPLOAD_BYTES
    });
  });

  it("accepts a valid PNG exactly at the size boundary", () => {
    expect(
      validateUpload(file("cover.png", "image/png", MAX_UPLOAD_BYTES))
    ).toMatchObject({
      ok: true,
      fileName: "cover.png",
      mimeType: "image/png",
      size: MAX_UPLOAD_BYTES
    });
  });

  it("rejects a file one byte over the size boundary", () => {
    expect(
      validateUpload(
        file("report.pdf", "application/pdf", MAX_UPLOAD_BYTES + 1)
      )
    ).toMatchObject({ ok: false, code: "file-too-large" });
  });

  it("rejects .svg as active content", () => {
    expect(validateUpload(file("logo.svg", "image/svg+xml"))).toMatchObject({
      ok: false,
      code: "active-content"
    });
  });

  it("rejects .html as active content", () => {
    expect(validateUpload(file("page.html", "text/html"))).toMatchObject({
      ok: false,
      code: "active-content"
    });
  });

  it("rejects .js as active content", () => {
    expect(
      validateUpload(file("script.js", "application/javascript"))
    ).toMatchObject({ ok: false, code: "active-content" });
  });

  it("rejects an active MIME type even when the extension is allowed", () => {
    expect(validateUpload(file("report.pdf", "image/svg+xml"))).toMatchObject({
      ok: false,
      code: "active-content"
    });
  });

  it("rejects a ../ filename as path traversal", () => {
    expect(
      validateUpload(file("../report.pdf", "application/pdf"))
    ).toMatchObject({ ok: false, code: "path-traversal" });
  });

  it("rejects a backslash path as path traversal", () => {
    expect(
      validateUpload(file("..\\report.pdf", "application/pdf"))
    ).toMatchObject({ ok: false, code: "path-traversal" });
  });

  it("rejects a mismatched extension and MIME type", () => {
    expect(validateUpload(file("report.pdf", "image/png"))).toMatchObject({
      ok: false,
      code: "mime-extension-mismatch"
    });
  });

  it("allows both .jpg and .jpeg for image/jpeg", () => {
    expect(validateUpload(file("photo.jpg", "image/jpeg"))).toMatchObject({
      ok: true,
      mimeType: "image/jpeg"
    });
    expect(validateUpload(file("photo.jpeg", "image/jpeg"))).toMatchObject({
      ok: true,
      mimeType: "image/jpeg"
    });
  });

  it("rejects an unsupported extension", () => {
    expect(
      validateUpload(file("archive.zip", "application/zip"))
    ).toMatchObject({ ok: false, code: "unsupported-extension" });
  });

  it("rejects an empty filename", () => {
    expect(validateUpload(file("", "application/pdf"))).toMatchObject({
      ok: false,
      code: "empty-name"
    });
  });

  it("strips unicode control characters from the stored name", () => {
    expect(
      validateUpload(file("re\u0000po\u202Ert.pdf", "application/pdf"))
    ).toMatchObject({ ok: true, fileName: "report.pdf" });
  });

  it("normalises MIME parameters and case", () => {
    expect(
      validateUpload(file("REPORT.PDF", "Application/PDF; charset=binary"))
    ).toMatchObject({
      ok: true,
      fileName: "REPORT.PDF",
      mimeType: "application/pdf"
    });
  });

  it("appends a collision-safe suffix", () => {
    expect(
      validateUpload(file("report.pdf", "application/pdf"), {
        existingNames: ["report.pdf"]
      })
    ).toMatchObject({ ok: true, fileName: "report-1.pdf" });
  });

  it("increments the suffix until the name is free", () => {
    expect(
      makeCollisionSafeName("report.pdf", ["report.pdf", "report-1.pdf"])
    ).toBe("report-2.pdf");
  });

  it("treats collisions case-insensitively", () => {
    expect(makeCollisionSafeName("Report.PDF", ["report.pdf"])).toBe(
      "Report-1.PDF"
    );
  });

  it("exports the documented extension allow-list", () => {
    expect(ALLOWED_EXTENSIONS).toEqual([
      ".pdf",
      ".png",
      ".jpg",
      ".jpeg",
      ".webp",
      ".docx"
    ]);
  });
});
