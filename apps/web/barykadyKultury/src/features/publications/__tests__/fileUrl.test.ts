import { describe, expect, it } from "vitest";

import {
  PUBLICATION_FILE_BUCKET,
  publicationFileUrl
} from "@/features/publications/fileUrl";
import { createFakeSupabase } from "@/test-utils/fakeSupabase";

/**
 * Seam axis (T-020): publication files are DOWNLOADS, so they live in the
 * `public-documents` bucket (the row carries no bucket column; T-014 splits
 * MIME by purpose — PDF/DOCX belong to public-documents). Per the T-014
 * download guidance, the URL carries `?download=<safe-name>` so Storage
 * returns Content-Disposition: attachment instead of inline execution.
 */
describe("publicationFileUrl", () => {
  it("builds a public-documents URL with a safe download name", () => {
    const fake = createFakeSupabase();

    expect(
      publicationFileUrl(
        fake.client,
        "fixtures/publications/sample-publication-en.pdf"
      )
    ).toBe(
      `https://fake.supabase.test/storage/v1/object/public/${PUBLICATION_FILE_BUCKET}/fixtures/publications/sample-publication-en.pdf?download=sample-publication-en.pdf`
    );
  });

  it("sanitizes the download name to URL-safe characters only", () => {
    const fake = createFakeSupabase();

    const url = publicationFileUrl(
      fake.client,
      "fixtures/raport roczny v2.pdf"
    );

    expect(url).toContain("?download=raport-roczny-v2.pdf");
  });

  it("returns null without a client or path", () => {
    const fake = createFakeSupabase();

    expect(publicationFileUrl(null, "a/b.pdf")).toBeNull();
    expect(publicationFileUrl(fake.client, null)).toBeNull();
  });
});
