import { describe, expect, it } from "vitest";

import { documentFileUrl } from "@/features/documents/fileUrl";
import { createFakeSupabase } from "@/test-utils/fakeSupabase";

/**
 * T-029 — public document download seam.
 *
 * The URL must be a public `public-documents` object with the attachment
 * policy; a missing client/path degrades to `null` so the card omits the
 * action instead of rendering a broken link.
 */
describe("documentFileUrl", () => {
  it("builds a public-documents download URL with a safe attachment name", () => {
    const fake = createFakeSupabase();

    expect(documentFileUrl(fake.client, "documents/Statute 2026.pdf")).toBe(
      "https://fake.supabase.test/storage/v1/object/public/public-documents/documents/Statute 2026.pdf?download=statute-2026.pdf"
    );
  });

  it("returns null without a client or path", () => {
    const fake = createFakeSupabase();

    expect(documentFileUrl(null, "documents/statute.pdf")).toBeNull();
    expect(documentFileUrl(fake.client, null)).toBeNull();
  });
});
