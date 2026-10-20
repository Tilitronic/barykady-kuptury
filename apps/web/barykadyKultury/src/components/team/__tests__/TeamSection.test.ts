import { describe, expect, it } from "vitest";
import { flushPromises } from "@vue/test-utils";

import { createFakeSupabase } from "@/test-utils/fakeSupabase";
import { mountWithPlugins } from "@/test-utils/mount";

import TeamSection from "../TeamSection.vue";

/**
 * T-039 — the team section extracted from `about-team.vue` (D-25). The page
 * route is gone; the section IS the team surface, anchored at `#team` with a
 * focusable heading for deep links, keeping T-018's independent
 * loading/empty/unavailable states.
 */

const MEMBERS = [
  {
    id: "00000000-0000-4000-8000-000000000801",
    name: "Anna Kowalska",
    status: "published",
    sort_order: 1,
    portrait_path: null,
    updated_at: "2026-01-05T12:00:00Z",
    team_member_translations: [
      {
        locale: "en",
        role: "Chair of the board",
        bio: "Coordinates the board."
      }
    ]
  },
  {
    id: "00000000-0000-4000-8000-000000000802",
    name: "Oleh Veres",
    status: "published",
    sort_order: 2,
    portrait_path: null,
    updated_at: "2026-01-05T12:00:00Z",
    team_member_translations: [{ locale: "en", role: "Treasurer", bio: null }]
  }
];

function mountSection(
  supabase: ReturnType<typeof createFakeSupabase>["client"]
) {
  return mountWithPlugins(TeamSection, {
    supabase,
    props: { locale: "en" },
    initialRoute: "/en"
  });
}

describe("TeamSection", () => {
  it("renders the anchored section with a focusable heading", async () => {
    const fake = createFakeSupabase({ tables: { team_members: MEMBERS } });
    const wrapper = await mountSection(fake.client);
    await flushPromises();

    const section = wrapper.get("section#team");
    const heading = section.get("h2");
    expect(heading.attributes("tabindex")).toBe("-1");
    expect(heading.text()).toBe("Team");
  });

  it("renders member cards in sort order when data exists", async () => {
    const fake = createFakeSupabase({ tables: { team_members: MEMBERS } });
    const wrapper = await mountSection(fake.client);
    await flushPromises();

    const names = wrapper.findAll(".team-card__name").map(n => n.text());
    expect(names).toEqual(["Anna Kowalska", "Oleh Veres"]);
  });

  it("shows the translated empty state without fabricating people", async () => {
    const fake = createFakeSupabase({ tables: {} });
    const wrapper = await mountSection(fake.client);
    await flushPromises();

    expect(wrapper.text()).toContain("No team members are published yet.");
    expect(wrapper.findAll(".team-card")).toHaveLength(0);
  });

  it("shows the unavailable state when the query errors", async () => {
    const fake = createFakeSupabase({ error: { message: "boom" } });
    const wrapper = await mountSection(fake.client);
    await flushPromises();

    expect(wrapper.text()).toContain(
      "This content is temporarily unavailable."
    );
  });
});
