import { flushPromises, mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";

import LanguageSwitcher from "@/components/LanguageSwitcher.vue";
import { LOCALE_STORAGE_KEY } from "@/features/i18n/localeStorage";
import { routes } from "@/router/routes";
import { createTestI18n } from "@/test-utils/mount";

/**
 * docs/PRODUCT_REQUIREMENTS.md §2 item 3: "Provide a visible, keyboard-operable
 * language selector. A manually selected language must persist across visits and
 * route changes." A native `<select>` is used for keyboard/screen-reader
 * semantics; the label provides the accessible name.
 */
async function mountSwitcher(path: string) {
  const router = createRouter({ history: createMemoryHistory(), routes });
  await router.push(path);
  await router.isReady();

  const wrapper = mount(LanguageSwitcher, {
    global: {
      plugins: [createPinia(), createTestI18n("pl"), router]
    }
  });

  return { wrapper, router };
}

describe("LanguageSwitcher", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("exposes one option per supported locale and announces the current one", async () => {
    const { wrapper } = await mountSwitcher("/pl/projects");

    const select = wrapper.get("select");

    expect(select.attributes("value")).toBe("pl");
    expect(
      wrapper.findAll("option").map(option => option.attributes("value"))
    ).toEqual(["en", "pl", "uk"]);
    expect(wrapper.get("label").attributes("for")).toBe(
      select.attributes("id")
    );
  });

  it("persists the choice and keeps the current route when switching", async () => {
    const { wrapper, router } = await mountSwitcher("/pl/projects");

    await wrapper.get("select").setValue("uk");
    await flushPromises();

    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("uk");
    expect(router.currentRoute.value.path).toBe("/uk/projects");
  });
});
