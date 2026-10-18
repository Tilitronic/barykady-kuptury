import { describe, expect, it } from "vitest";

import { publicObjectUrl } from "@/features/files/publicObjectUrl";
import { createFakeSupabase } from "@/test-utils/fakeSupabase";

/**
 * Shared seam axis (T-020): the rule-of-three trigger documented by the
 * T-019 review — `team/portrait.ts` and `projects/cover.ts` were the second
 * near-identical copy, so URL building is extracted here while each feature
 * keeps a thin wrapper that owns its bucket. Null-degradation is the
 * contract every consumer relies on to omit media rather than fabricate it.
 */
describe("publicObjectUrl", () => {
  it("builds the public URL for the given bucket and path", () => {
    const fake = createFakeSupabase();

    expect(publicObjectUrl(fake.client, "public-media", "a/b.png")).toBe(
      "https://fake.supabase.test/storage/v1/object/public/public-media/a/b.png"
    );
    expect(publicObjectUrl(fake.client, "public-documents", "d/x.pdf")).toBe(
      "https://fake.supabase.test/storage/v1/object/public/public-documents/d/x.pdf"
    );
  });

  it("returns null without a client (unconfigured production build)", () => {
    expect(publicObjectUrl(null, "public-media", "a/b.png")).toBeNull();
  });

  it("returns null without a path", () => {
    const fake = createFakeSupabase();

    expect(publicObjectUrl(fake.client, "public-media", null)).toBeNull();
  });
});
