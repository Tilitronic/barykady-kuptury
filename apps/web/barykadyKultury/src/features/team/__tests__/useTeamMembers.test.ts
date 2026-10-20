import { describe, expect, it } from "vitest";
import { defineComponent, h, nextTick, ref } from "vue";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  useTeamMembers,
  type TeamMemberView
} from "@/features/team/useTeamMembers";
import type { Locale } from "@/features/i18n/locales";
import { createFakeSupabase } from "@/test-utils/fakeSupabase";
import { mountWithPlugins } from "@/test-utils/mount";
import type { ContentResult } from "@/shared/content/result";
import type { Database } from "@/types/database.types";

/**
 * Hook axis: T-018 wires `fetchPublishedTeamMembers` (T-015) into a reactive
 * `ContentResult` mirroring `useDocuments` — loading first, stale responses
 * discarded, and a locale change re-running the query so the header language
 * switcher refreshes the listing. The hook is also the portrait-URL seam:
 * each item carries a resolved `portraitUrl` (or null) so `PersonCard`
 * receives plain data and never touches the client (review, Standards 1).
 */

function memberRow(
  name: string,
  sortOrder: number,
  portraitPath: string | null = null
) {
  return {
    id: `00000000-0000-4000-8000-00000000080${sortOrder}`,
    name,
    status: "published",
    sort_order: sortOrder,
    portrait_path: portraitPath,
    updated_at: "2026-01-05T12:00:00Z",
    team_member_translations: [{ locale: "en", role: null, bio: null }]
  };
}

async function mountProbe(
  supabase: SupabaseClient<Database> | null,
  locale: Locale = "en"
) {
  const activeLocale = ref<Locale>(locale);

  let hook!: { readonly result: { value: ContentResult<TeamMemberView> } };

  const Probe = defineComponent({
    setup() {
      hook = useTeamMembers(activeLocale);
      return () => h("div", hook.result.value.kind);
    }
  });

  const wrapper = await mountWithPlugins(Probe, {
    supabase,
    initialRoute: `/${locale}/about/team`
  });

  return { wrapper, activeLocale, hook };
}

async function flush() {
  await nextTick();
  await new Promise(resolve => setTimeout(resolve, 0));
}

describe("useTeamMembers", () => {
  it("starts in the loading state, then resolves the published members", async () => {
    const fake = createFakeSupabase({
      tables: { team_members: [memberRow("First", 1), memberRow("Second", 2)] }
    });
    const { wrapper } = await mountProbe(fake.client);

    // Immediate pre-fetch state: loading, not a guessed empty/ok.
    expect(wrapper.text()).toBe("loading");

    await flush();
    expect(wrapper.text()).toBe("ok");

    // The query shape is the locale-independent ordering contract (T-015).
    expect(
      fake.calls
        .filter(call => call.table === "team_members")
        .map(c => c.method)
    ).toContain("order");
    const orderCall = fake.calls.find(c => c.method === "order");
    expect(orderCall?.args[0]).toBe("sort_order");
  });

  it("carries the resolved portraitUrl on each view-model item", async () => {
    const fake = createFakeSupabase({
      tables: {
        team_members: [
          memberRow("First", 1, "team/first.png"),
          memberRow("Second", 2)
        ]
      }
    });
    const { wrapper, hook } = await mountProbe(fake.client);
    await flush();

    expect(wrapper.text()).toBe("ok");
    const items =
      hook.result.value.kind === "ok" ? hook.result.value.items : [];
    expect(items).toHaveLength(2);
    expect(items[0]?.portraitUrl).toContain("team/first.png");
    expect(items[1]?.portraitUrl).toBeNull();
  });

  it("reports empty when nothing is published", async () => {
    const fake = createFakeSupabase({ tables: { team_members: [] } });
    const { wrapper } = await mountProbe(fake.client);
    await flush();

    expect(wrapper.text()).toBe("empty");
  });

  it("reports unavailable without a client", async () => {
    const { wrapper } = await mountProbe(null);
    await flush();

    expect(wrapper.text()).toBe("unavailable");
  });

  it("re-fetches when the requested locale changes", async () => {
    const fake = createFakeSupabase({
      tables: { team_members: [memberRow("First", 1)] }
    });
    const { activeLocale } = await mountProbe(fake.client, "en");
    await flush();

    activeLocale.value = "uk";
    await flush();

    const selects = fake.calls.filter(
      call => call.table === "team_members" && call.method === "eq"
    );
    // One status filter per fetch: two fetches means the locale change re-ran.
    expect(selects.length).toBeGreaterThanOrEqual(2);
  });
});
