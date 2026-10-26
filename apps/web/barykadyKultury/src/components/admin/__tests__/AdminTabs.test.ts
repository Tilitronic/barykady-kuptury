import { describe, expect, it } from "vitest";

import { mountWithPlugins } from "@/test-utils/mount";

import AdminTabs from "../AdminTabs.vue";

/**
 * T-048 — the settings tab strip reuses the AdminLocaleTabs keyboard contract
 * (roving tabindex + arrows/Home/End). These assertions pin the interaction
 * contract so the two surfaces cannot drift.
 */

const TABS = [
  { id: "general", label: "General", testId: "settings-tab-general" },
  { id: "contacts", label: "Contacts", testId: "settings-tab-contacts" },
  { id: "projects", label: "Projects", testId: "settings-tab-projects" }
];

async function mountTabs(active = "general") {
  return mountWithPlugins(AdminTabs, {
    props: { tabs: TABS, active, label: "Settings sections", idPrefix: "test" }
  });
}

describe("AdminTabs", () => {
  it("renders a tablist with a roving tabindex", async () => {
    const wrapper = await mountTabs("contacts");

    expect(wrapper.get('[role="tablist"]').attributes("aria-label")).toBe(
      "Settings sections"
    );
    expect(
      wrapper.get('[data-testid="settings-tab-general"]').attributes("tabindex")
    ).toBe("-1");
    expect(
      wrapper
        .get('[data-testid="settings-tab-contacts"]')
        .attributes("tabindex")
    ).toBe("0");
    expect(
      wrapper
        .get('[data-testid="settings-tab-contacts"]')
        .attributes("aria-selected")
    ).toBe("true");
  });

  it("moves selection with ArrowLeft/ArrowRight and wraps", async () => {
    const wrapper = await mountTabs("general");
    const tablist = wrapper.get('[role="tablist"]');

    await tablist.trigger("keydown", { key: "ArrowRight" });
    expect(wrapper.emitted("update:active")?.at(-1)).toEqual(["contacts"]);

    await tablist.trigger("keydown", { key: "ArrowLeft" });
    expect(wrapper.emitted("update:active")?.at(-1)).toEqual(["projects"]);
  });

  it("supports Home/End and ignores unrelated keys", async () => {
    const wrapper = await mountTabs("contacts");
    const tablist = wrapper.get('[role="tablist"]');

    await tablist.trigger("keydown", { key: "End" });
    expect(wrapper.emitted("update:active")?.at(-1)).toEqual(["projects"]);

    await tablist.trigger("keydown", { key: "Home" });
    expect(wrapper.emitted("update:active")?.at(-1)).toEqual(["general"]);

    await tablist.trigger("keydown", { key: "Tab" });
    expect(wrapper.emitted("update:active")).toHaveLength(2);
  });

  it("emits a click selection and no duplicate for the active tab", async () => {
    const wrapper = await mountTabs("general");

    await wrapper.get('[data-testid="settings-tab-projects"]').trigger("click");
    expect(wrapper.emitted("update:active")?.at(-1)).toEqual(["projects"]);

    await wrapper.get('[data-testid="settings-tab-general"]').trigger("click");
    expect(wrapper.emitted("update:active")).toHaveLength(1);
  });
});
