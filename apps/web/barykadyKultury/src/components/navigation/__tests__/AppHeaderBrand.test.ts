import { flushPromises } from "@vue/test-utils";
import { mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { describe, expect, it } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";

import AppHeader from "@/components/navigation/AppHeader.vue";
import { routes } from "@/router/routes";
import { createTestI18n } from "@/test-utils/mount";

/**
 * T-044 — the brand link navigates through RouterLink alone.
 *
 * WHY: the previous anchor used `@click.prevent` + a manual `router.push`,
 * which hijacked modified clicks (Ctrl/Cmd+click could no longer open the
 * home page in a new tab — the browser default was prevented and the SPA
 * navigated instead). A RouterLink keeps one native navigation mechanism:
 * plain clicks stay client-side, modified clicks pass through untouched.
 */

async function mountHeader(locale: "en" | "pl" | "uk" = "en") {
  const router = createRouter({ history: createMemoryHistory(), routes });
  await router.push(`/${locale}`);
  await router.isReady();

  const wrapper = mount(AppHeader, {
    global: { plugins: [createPinia(), createTestI18n(locale), router] },
    attachTo: document.body
  });
  await flushPromises();
  return { wrapper, router };
}

describe("AppHeader brand link", () => {
  it("is an anchor to the locale home with the logo aria-label and focus ring", async () => {
    const { wrapper } = await mountHeader("pl");

    const brand = wrapper.get(".app-header__brand");
    expect(brand.element.tagName).toBe("A");
    expect(brand.attributes("href")).toBe("/pl");
    expect(brand.attributes("aria-label")).toBe("Barykady Kultury");
    expect(brand.classes()).toContain("focus-ring");
    // The logotype lockup stays inside the link and remains decorative —
    // the link's aria-label carries the name (DESIGN_SYSTEM.md §1).
    expect(brand.find(".brand-logo__img").exists()).toBe(true);
  });

  it("navigates in-app on a plain click", async () => {
    const { wrapper, router } = await mountHeader("uk");

    await wrapper.get(".app-header__brand").trigger("click");
    await flushPromises();

    expect(router.currentRoute.value.path).toBe("/uk");
  });

  it("leaves modified clicks to the browser (open-in-new-tab survives)", async () => {
    const { wrapper, router } = await mountHeader("pl");

    const brand = wrapper.get(".app-header__brand").element;
    const event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      ctrlKey: true
    });
    brand.dispatchEvent(event);
    await flushPromises();

    // RouterLink's guard skips modified clicks WITHOUT preventDefault, so the
    // browser opens a new tab; the SPA must not move.
    expect(event.defaultPrevented).toBe(false);
    expect(router.currentRoute.value.path).toBe("/pl");
  });

  it("renders the brand through RouterLink (linked-class on the home route)", async () => {
    const { wrapper } = await mountHeader("en");

    // Observability that the migration happened: only a RouterLink (not a
    // plain anchor) puts vue-router's linked class on the element.
    expect(wrapper.get(".app-header__brand").classes()).toContain(
      "router-link-active"
    );
  });
});
