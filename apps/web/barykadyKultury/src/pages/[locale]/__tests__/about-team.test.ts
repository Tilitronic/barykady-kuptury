import { describe, expect, it } from "vitest";
import { nextTick } from "vue";

import AboutTeamPage from "@/pages/[locale]/about-team.vue";
import { createFakeSupabase } from "@/test-utils/fakeSupabase";
import { mountWithPlugins } from "@/test-utils/mount";

/**
 * Spec axis: docs/tickets/T-018-about-team.md — team cards render name +
 * optional role/bio/portrait from `team_members` + translations, optional
 * fields collapse cleanly, portraits get meaningful alt text, the monogram
 * placeholder stays out of the accessibility tree (nothing fabricated), and
 * the shipped state today is the translated empty state (DESIGN_SYSTEM.md §3, §6).
 */

function translation(overrides: Record<string, unknown> = {}) {
  return {
    locale: "en",
    slug: "anna-kowalska",
    role: "Zarząd",
    bio: "Bio.",
    ...overrides
  };
}

function memberRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-4000-8000-000000000801",
    name: "Anna Kowalska",
    status: "published",
    sort_order: 1,
    portrait_path: null,
    updated_at: "2026-01-05T12:00:00Z",
    team_member_translations: [translation()],
    ...overrides
  };
}

async function mountTeam(
  supabase: ReturnType<typeof createFakeSupabase>["client"] | null,
  locale: "en" | "pl" | "uk" = "en"
) {
  const wrapper = await mountWithPlugins(AboutTeamPage, {
    locale,
    supabase,
    initialRoute: `/${locale}/about/team`,
    // Explicit record so `:locale` captures exactly "en|pl|uk" — the default
    // catch-all route would greedily capture the whole path.
    routes: [
      {
        path: "/:locale(en|pl|uk)/about/team",
        name: "about-team",
        component: AboutTeamPage
      }
    ]
  });

  await flushPromises();
  return wrapper;
}

async function flushPromises() {
  await nextTick();
  await new Promise(resolve => setTimeout(resolve, 0));
}

describe("team page", () => {
  it("shows the translated empty state and fabricates nothing when no members are published", async () => {
    const fake = createFakeSupabase({ tables: { team_members: [] } });
    const wrapper = await mountTeam(fake.client, "en");

    expect(wrapper.text()).toContain("No team members are published yet.");
    expect(wrapper.find(".team-card").exists()).toBe(false);
    expect(wrapper.findAll("h2")).toHaveLength(0);
  });

  it("shows the empty state translated into the active locale", async () => {
    const fake = createFakeSupabase({ tables: { team_members: [] } });
    const wrapper = await mountTeam(fake.client, "pl");

    expect(wrapper.text()).toContain("Brak opublikowanych członków zespołu.");
    expect(wrapper.text()).not.toContain("No team members");
  });

  it("renders name and role when the bio is absent", async () => {
    const fake = createFakeSupabase({
      tables: {
        team_members: [
          memberRow({
            team_member_translations: [translation({ bio: null })]
          })
        ]
      }
    });
    const wrapper = await mountTeam(fake.client, "en");

    expect(wrapper.get(".team-card__name").text()).toBe("Anna Kowalska");
    expect(wrapper.get(".team-card__role").text()).toBe("Zarząd");
    expect(wrapper.find(".team-card__bio").exists()).toBe(false);
  });

  it("collapses both optional fields when only a name exists", async () => {
    const fake = createFakeSupabase({
      tables: {
        team_members: [
          memberRow({
            team_member_translations: [translation({ role: null, bio: null })]
          })
        ]
      }
    });
    const wrapper = await mountTeam(fake.client, "en");

    expect(wrapper.get(".team-card__name").text()).toBe("Anna Kowalska");
    expect(wrapper.find(".team-card__role").exists()).toBe(false);
    expect(wrapper.find(".team-card__bio").exists()).toBe(false);
  });

  it("gives a portrait a meaningful alt composed from name and role", async () => {
    const fake = createFakeSupabase({
      tables: {
        team_members: [
          memberRow({
            portrait_path: "team/anna.png",
            team_member_translations: [
              translation({ role: "Prezeska zarządu" })
            ]
          })
        ]
      }
    });
    const wrapper = await mountTeam(fake.client, "pl");

    const img = wrapper.get(".team-card__portrait-img");
    expect(img.attributes("alt")).toBe("Anna Kowalska, Prezeska zarządu");
    expect(img.attributes("src")).toContain("team/anna.png");
    expect(img.attributes("loading")).toBe("lazy");
  });

  it("omits the role from the alt when the member has no role", async () => {
    const fake = createFakeSupabase({
      tables: {
        team_members: [
          memberRow({
            portrait_path: "team/anna.png",
            team_member_translations: [translation({ role: null })]
          })
        ]
      }
    });
    const wrapper = await mountTeam(fake.client, "en");

    expect(wrapper.get(".team-card__portrait-img").attributes("alt")).toBe(
      "Anna Kowalska"
    );
  });

  it("keeps the monogram placeholder out of the accessibility tree when no portrait exists", async () => {
    const fake = createFakeSupabase({
      tables: { team_members: [memberRow()] }
    });
    const wrapper = await mountTeam(fake.client, "en");

    expect(wrapper.find("img").exists()).toBe(false);

    const monogram = wrapper.get(".team-card__monogram");
    expect(monogram.attributes("aria-hidden")).toBe("true");
    expect(monogram.text()).toBe("AK");
  });

  it("renders a long Ukrainian bio in full without truncation", async () => {
    const longBio =
      "Дарина — координаторка проєктів Барикад Культури, відповідальна за " +
      "міжнародну співпрацю, логістику заходів та комунікацію з партнерами " +
      "в Україні та за кордоном. Вона приєдналася до ініціативи у 2022 році " +
      "і відтоді супроводжула десятки культурних подій, благодійних зборів " +
      "та волонтерських програм, поєднуючи практичний досвід із глибокою " +
      "повагою до місцевої громади.";

    const fake = createFakeSupabase({
      tables: {
        team_members: [
          memberRow({
            name: "Daryna Shevchenko",
            team_member_translations: [
              translation({ locale: "uk", role: null, bio: longBio })
            ]
          })
        ]
      }
    });
    const wrapper = await mountTeam(fake.client, "uk");

    expect(wrapper.get(".team-card__bio").text()).toBe(longBio);
  });

  it("names the source language on a card whose translation is an English stand-in", async () => {
    // Requested locale has no translation at all; the English row stands in
    // (required fields are empty for team members), so the card must say so.
    const fake = createFakeSupabase({
      tables: { team_members: [memberRow()] }
    });
    const wrapper = await mountTeam(fake.client, "pl");

    expect(wrapper.text()).toContain("po angielsku");
  });

  it("keeps exactly one h1 and one h2 per member", async () => {
    const fake = createFakeSupabase({
      tables: {
        team_members: [
          memberRow(),
          memberRow({
            id: "00000000-0000-4000-8000-000000000802",
            name: "Oleh Veres",
            sort_order: 2
          })
        ]
      }
    });
    const wrapper = await mountTeam(fake.client, "en");

    expect(wrapper.findAll("h1")).toHaveLength(1);
    expect(wrapper.findAll("h2")).toHaveLength(2);
    expect(wrapper.findAll(".team-card")).toHaveLength(2);
  });

  it("shows the unavailable state without a client", async () => {
    const wrapper = await mountTeam(null, "en");

    expect(wrapper.text()).toContain("temporarily unavailable");
  });
});
