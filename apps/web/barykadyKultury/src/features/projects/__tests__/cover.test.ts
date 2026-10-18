import { describe, expect, it } from "vitest";

import {
  PROJECT_COVER_BUCKET,
  projectCoverUrl
} from "@/features/projects/cover";
import { createFakeSupabase } from "@/test-utils/fakeSupabase";

/**
 * Seam axis: `projectCoverUrl` is the single place that turns a stored
 * `cover_path` into a public-media URL (mirrors the T-018 portrait seam).
 * Every non-buildable case degrades to `null` so the card/detail simply
 * omit the image — no broken frames, no invented covers (DESIGN_SYSTEM.md §3).
 */
describe("projectCoverUrl", () => {
  it("builds the public-media URL from a stored path", () => {
    const fake = createFakeSupabase();

    expect(projectCoverUrl(fake.client, "fixtures/projects/cover.webp")).toBe(
      `https://fake.supabase.test/storage/v1/object/public/${PROJECT_COVER_BUCKET}/fixtures/projects/cover.webp`
    );
  });

  it("returns null without a client (unconfigured production build)", () => {
    expect(projectCoverUrl(null, "fixtures/projects/cover.webp")).toBeNull();
  });

  it("returns null without a stored path", () => {
    const fake = createFakeSupabase();

    expect(projectCoverUrl(fake.client, null)).toBeNull();
  });
});
