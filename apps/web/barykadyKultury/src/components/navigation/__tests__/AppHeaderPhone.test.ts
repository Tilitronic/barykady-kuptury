import { flushPromises, mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";

import AppHeader from "@/components/navigation/AppHeader.vue";
import { routes } from "@/router/routes";
import { createTestI18n } from "@/test-utils/mount";

/**
 * Phone-band header (< 600 px, owner-approved lane): the header collapses to
 * a slim strip — brand + ONE search trigger + the hamburger fallback — the
 * section links live in the bottom bar, and the drawer landmark is renamed
 * to "Full menu" so the bottom bar keeps the only "Main navigation" name.
 * jsdom cannot media-query CSS, so the band is driven through matchMedia.
 */

function stubPhoneBand(matches: boolean): void {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      media: query,
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn()
    }))
  });
}

async function mountHeader() {
  const router = createRouter({ history: createMemoryHistory(), routes });
  await router.push("/en");
  await router.isReady();

  const wrapper = mount(AppHeader, {
    global: {
      plugins: [createPinia(), createTestI18n("en"), router],
      stubs: { QTooltip: true }
    },
    attachTo: document.body
  });
  await flushPromises();
  return wrapper;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("AppHeader — phone band", () => {
  it("keeps exactly one search trigger in the action strip and renames the drawer nav", async () => {
    stubPhoneBand(true);
    const wrapper = await mountHeader();

    const triggers = wrapper.findAll("[data-testid='site-search-trigger']");
    expect(triggers).toHaveLength(1);
    // The trigger sits in the header action cell, not in the drawer panel.
    expect(
      wrapper
        .get(".app-header__actions")
        .find("[data-testid='site-search-trigger']")
        .exists()
    ).toBe(true);
    expect(
      wrapper
        .get("#app-panel .app-header__controls")
        .find("[data-testid='site-search-trigger']")
        .exists()
    ).toBe(false);

    expect(wrapper.get("#app-nav").attributes("aria-label")).toBe("Full menu");
    // The bottom bar renders the main navigation landmark once.
    const navs = wrapper
      .findAll("nav")
      .filter(nav => nav.attributes("aria-label") === "Main navigation");
    expect(navs).toHaveLength(1);
    expect(navs[0]!.attributes("data-testid")).toBe("bottom-nav");
  });

  it("tablet/desktop keep the search in the controls cluster and one 'Main navigation' drawer", async () => {
    stubPhoneBand(false);
    const wrapper = await mountHeader();

    expect(
      wrapper
        .get(".app-header__controls")
        .find("[data-testid='site-search-trigger']")
        .exists()
    ).toBe(true);
    expect(wrapper.findAll("[data-testid='site-search-trigger']")).toHaveLength(
      1
    );
    expect(wrapper.get("#app-nav").attributes("aria-label")).toBe(
      "Main navigation"
    );
    expect(wrapper.find("[data-testid='bottom-nav']").exists()).toBe(true); // present but CSS-hidden — display swap is E2E-verified
  });
});
