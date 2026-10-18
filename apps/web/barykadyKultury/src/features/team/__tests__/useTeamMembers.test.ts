import { describe, expect, it } from "vitest";
import { defineComponent, h, nextTick, ref } from "vue";
import type { SupabaseClient } from "@supabase/supabase-js";

import { useTeamMembers } from "@/features/team/useTeamMembers";
import type { Locale } from "@/features/i18n/locales";
import { createFakeSupabase } from "@/test-utils/fakeSupabase";
import { mountWithPlugins } from "@/test-utils/mount";
import type { Database } from "@/types/database.types";

/**
 * Hook axis: T-018 wires `fetchPublishedTeamMembers` (T-015) into a reactive
 * `ContentResult` mirroring `useDocuments` — loading first, stale responses
 * discarded, and a locale change re-running the query so the header language
 * switcher refreshes the listing.
 */

function memberRow(name: string, sortOrder: number) {
  return {
    id: `00000000-0000-4000-8000-00000000080${sortOrder}`,
    name,
    status: "published",
    sort_order: sortOrder,
    portrait_path: null,
    updated_at: "2026-01-05T12:00:00Z",
    team_member_translations: [
      { locale: "en", slug: name.toLowerCase(), role: null, bio: null }
    ]
  };
}

async function mountProbe(
  supabase: SupabaseClient<Database> | null,
  locale: Locale = "en"
) {
  const activeLocale = ref<Locale>(locale);

  const Probe = defineComponent({
    setup() {
      const hook = useTeamMembers(activeLocale);
      return () => h("div", hook.result.value.kind);
    }
  });

  const wrapper = await mountWithPlugins(Probe, {
    supabase,
    initialRoute: `/${locale}/about/team`
  });

  await flush();
  return { wrapper, activeLocale };
}

async function flush() {
  await nextTick();
  await new Promise(resolve => setTimeout(resolve, 0));
}

describe("useTeamMembers", () => {
  it("resolves published members in sort order after a loading phase", async () => {
    const fake = createFakeSupabase({
      tables: { team_members: [memberRow("First", 1), memberRow("Second", 2)] }
    });
    const { wrapper } = await mountProbe(fake.client);

    // The query shape is the locale-independent ordering contract (T-015).
    expect(
      fake.calls
        .filter(call => call.table === "team_members")
        .map(c => c.method)
    ).toContain("order");
    const orderCall = fake.calls.find(c => c.method === "order");
    expect(orderCall?.args[0]).toBe("sort_order");

    expect(wrapper.text()).toBe("ok");
  });

  it("reports empty when nothing is published", async () => {
    const fake = createFakeSupabase({ tables: { team_members: [] } });
    const { wrapper } = await mountProbe(fake.client);

    expect(wrapper.text()).toBe("empty");
  });

  it("reports unavailable without a client", async () => {
    const { wrapper } = await mountProbe(null);

    expect(wrapper.text()).toBe("unavailable");
  });

  it("re-fetches when the requested locale changes", async () => {
    const fake = createFakeSupabase({
      tables: { team_members: [memberRow("First", 1)] }
    });
    const { activeLocale } = await mountProbe(fake.client, "en");

    activeLocale.value = "uk";
    await flush();

    const selects = fake.calls.filter(
      call => call.table === "team_members" && call.method === "eq"
    );
    // One status filter per fetch: two fetches means the locale change re-ran.
    expect(selects.length).toBeGreaterThanOrEqual(2);
  });
});
