import { describe, expect, it } from "vitest";

import {
  publishSitePage,
  saveSitePage,
  unpublishSitePage
} from "@/features/admin/content/api";
import {
  emptySitePageForm,
  updateSitePageTranslation
} from "@/features/admin/content/sitePageForm";
import { createFakeSupabase } from "@/test-utils/fakeSupabase";

/**
 * T-028 — the site page mutation seam must use the paired T-045-style RPCs,
 * not a sequence of table writes (architector: copy the proven pattern per
 * entity). These assertions pin the client/server contract the pgTAP suite
 * proves at the database boundary.
 */

function form() {
  const base = { ...emptySitePageForm("about"), id: "page-1" };
  return updateSitePageTranslation(base, "en", {
    title: "About us",
    body: "EN body",
    metaDescription: "Meta"
  });
}

describe("admin site page API", () => {
  it("saves root + complete translation set through save_site_page_v1", async () => {
    const fake = createFakeSupabase({ rpc: { data: "page-1" } });

    const result = await saveSitePage(fake.client, form());

    expect(result).toEqual({ ok: true, id: "page-1" });
    expect(fake.rpcCalls).toHaveLength(1);
    expect(fake.rpcCalls[0]?.name).toBe("save_site_page_v1");
    expect(fake.rpcCalls[0]?.args).toMatchObject({
      p_id: "page-1",
      p_status: "draft",
      p_published_at: null,
      p_translations: [
        {
          locale: "en",
          title: "About us",
          body: "EN body",
          metaDescription: "Meta"
        }
      ]
    });
  });

  it("publishes with a timestamp and unpublishes with null", async () => {
    const fake = createFakeSupabase();

    await publishSitePage(
      fake.client,
      "page-1",
      new Date("2026-06-01T12:00:00Z")
    );
    await unpublishSitePage(fake.client, "page-1");

    expect(fake.rpcCalls.map(call => call.name)).toEqual([
      "transition_site_page_v1",
      "transition_site_page_v1"
    ]);
    expect(fake.rpcCalls[0]?.args).toMatchObject({
      p_id: "page-1",
      p_status: "published",
      p_published_at: "2026-06-01T12:00:00.000Z"
    });
    expect(fake.rpcCalls[1]?.args).toMatchObject({
      p_id: "page-1",
      p_status: "draft",
      p_published_at: null
    });
  });
});
