import { describe, expect, it } from "vitest";

import { fileTypeLabel } from "@/features/files/fileTypeLabel";

/**
 * Pure display helper (T-020): maps the MIME types the `public-documents`
 * bucket actually accepts (T-014: PDF, DOCX) to their conventional acronym.
 * Anything else yields `null` so the UI omits the type chip rather than
 * inventing a name for a format it cannot verify.
 */
describe("fileTypeLabel", () => {
  it("labels the two bucket-allowed document types", () => {
    expect(fileTypeLabel("application/pdf")).toBe("PDF");
    expect(
      fileTypeLabel(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      )
    ).toBe("DOCX");
  });

  it("returns null for unknown or missing MIME types", () => {
    expect(fileTypeLabel("application/zip")).toBeNull();
    expect(fileTypeLabel("image/png")).toBeNull();
    expect(fileTypeLabel(null)).toBeNull();
  });
});
