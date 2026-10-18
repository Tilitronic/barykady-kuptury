import { describe, expect, it } from "vitest";

import {
  TEAM_PORTRAIT_BUCKET,
  teamPortraitUrl
} from "@/features/team/portrait";
import { createFakeSupabase } from "@/test-utils/fakeSupabase";

/**
 * Seam axis: `teamPortraitUrl` is the single place that turns a stored
 * `portrait_path` into a public URL (T-014 `public-media` bucket), and every
 * non-buildable case must degrade to `null` so the card shows the neutral
 * monogram instead of a broken or fabricated image (DESIGN_SYSTEM.md §3).
 */
describe("teamPortraitUrl", () => {
  it("builds the public-media URL from a stored path", () => {
    const fake = createFakeSupabase();

    const url = teamPortraitUrl(fake.client, "team/anna.png");

    expect(url).toBe(
      `https://fake.supabase.test/storage/v1/object/public/${TEAM_PORTRAIT_BUCKET}/team/anna.png`
    );
  });

  it("returns null without a client (unconfigured production build)", () => {
    expect(teamPortraitUrl(null, "team/anna.png")).toBeNull();
  });

  it("returns null without a stored path", () => {
    const fake = createFakeSupabase();

    expect(teamPortraitUrl(fake.client, null)).toBeNull();
  });
});
