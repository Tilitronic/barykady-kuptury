import { nextTick } from "vue";
import { mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { describe, expect, it } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";

import AppHeader from "@/components/navigation/AppHeader.vue";
import { routes } from "@/router/routes";
import { createTestI18n } from "@/test-utils/mount";

/**
 * T-011 — AppHeader mobile drawer contract.
 *
 * The mobile drawer must:
 * - be keyboard operable (toggle on click/Enter/Space),
 * - close on Escape key,
 * - return focus to the trigger button on close,
 * - expose explicit open/close state via aria-expanded.
 *
 * (docs/DESIGN_SYSTEM.md §4/§6; T-011 TDD plan step 2)
 */

async function mountHeader(path = "/en") {
  const router = createRouter({ history: createMemoryHistory(), routes });
  await router.push(path);
  await router.isReady();

  const wrapper = mount(AppHeader, {
    global: { plugins: [createPinia(), createTestI18n("en"), router] },
    attachTo: document.body
  });

  await nextTick();
  return { wrapper, router };
}

describe("AppHeader mobile navigation", () => {
  it("exposes a toggle button with aria-expanded=false when closed", async () => {
    const { wrapper } = await mountHeader();

    const trigger = wrapper.get("[data-testid='menu-trigger']");
    expect(trigger.attributes("aria-expanded")).toBe("false");
    expect(trigger.attributes("type")).toBe("button");
  });

  it("sets aria-expanded=true when the menu is opened", async () => {
    const { wrapper } = await mountHeader();

    const trigger = wrapper.get("[data-testid='menu-trigger']");
    await trigger.trigger("click");
    await nextTick();

    expect(trigger.attributes("aria-expanded")).toBe("true");
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const { wrapper } = await mountHeader();

    const trigger = wrapper.get("[data-testid='menu-trigger']");

    // Open the menu
    await trigger.trigger("click");
    await nextTick();
    expect(trigger.attributes("aria-expanded")).toBe("true");

    // Dispatch Escape on the panel element (the @keydown handler is on the
    // panel wrapper; it also fires when bubbling from any child inside it).
    const panel = wrapper.get("#app-panel");
    await panel.trigger("keydown", { key: "Escape" });
    await nextTick();

    // Drawer must be closed
    expect(trigger.attributes("aria-expanded")).toBe("false");

    // Focus must return to the trigger button
    expect(document.activeElement).toBe(trigger.element);
  });

  it("clicking the trigger again closes the menu", async () => {
    const { wrapper } = await mountHeader();

    const trigger = wrapper.get("[data-testid='menu-trigger']");
    await trigger.trigger("click");
    await nextTick();
    expect(trigger.attributes("aria-expanded")).toBe("true");

    await trigger.trigger("click");
    await nextTick();
    expect(trigger.attributes("aria-expanded")).toBe("false");
  });

  it("renders all six nav destinations", async () => {
    const { wrapper } = await mountHeader();

    const links = wrapper.findAll("[data-testid='main-nav'] a");
    expect(links.length).toBeGreaterThanOrEqual(6);
  });

  it("sets aria-current=page on the active route link", async () => {
    const { wrapper } = await mountHeader("/en/projects");

    // Find the "Projects" link and check aria-current
    const links = wrapper.findAll("[data-testid='main-nav'] a");
    const activeLinks = links.filter(
      l => l.attributes("aria-current") === "page"
    );

    expect(activeLinks).toHaveLength(1);
    expect(activeLinks[0]!.attributes("href")).toContain("/projects");
  });
});
