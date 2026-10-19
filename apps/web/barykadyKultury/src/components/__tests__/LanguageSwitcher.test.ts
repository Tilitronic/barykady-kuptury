import { flushPromises, mount, VueWrapper } from "@vue/test-utils";
import { createPinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";

import LanguageSwitcher from "@/components/LanguageSwitcher.vue";
import { LOCALE_STORAGE_KEY } from "@/features/i18n/localeStorage";
import { routes } from "@/router/routes";
import { createTestI18n } from "@/test-utils/mount";

/**
 * docs/PRODUCT_REQUIREMENTS.md §2 item 3: "Provide a visible, keyboard-operable
 * language selector. A manually selected language must persist across visits
 * and route changes."
 *
 * The picker is a native fieldset radiogroup — one radio per locale, shown as
 * flag + short code (🇬🇧 EN / 🇵🇱 PL / 🇺🇦 UA). The checked radio announces
 * the current locale; the `<legend>` names the group. Display codes never
 * change the machine codes: the radio values stay the routing/storage locale
 * (`uk`, not `UA`).
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

function radioByValue(wrapper: VueWrapper, value: string) {
  return wrapper
    .findAll('input[type="radio"]')
    .find(input => input.attributes("value") === value);
}

describe("LanguageSwitcher", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("exposes one radio per supported locale and announces the current one", async () => {
    const { wrapper } = await mountSwitcher("/pl/projects");

    const inputs = wrapper.findAll('input[type="radio"]');
    // Machine codes are untouched: `uk` stays `uk` even though the badge
    // shows `UA`.
    expect(inputs.map(input => input.attributes("value"))).toEqual([
      "en",
      "pl",
      "uk"
    ]);
    expect(new Set(inputs.map(input => input.attributes("name")))).toEqual(
      new Set(["locale"])
    );

    const checked = inputs.filter(
      input => (input.element as HTMLInputElement).checked
    );
    expect(checked).toHaveLength(1);
    expect(checked.map(input => input.attributes("value"))).toEqual(["pl"]);

    // Group name from the legend, localised like everything else.
    expect(wrapper.get("fieldset").get("legend").text()).toBe("Język");
  });

  it("pairs each visible code with its autonym and hides the flag from AT", async () => {
    const { wrapper } = await mountSwitcher("/pl/projects");

    // Approximate the computed accessible name: the label's text with every
    // aria-hidden subtree removed (the accname algorithm skips them), so the
    // decorative flag and the visible code badge do not double up with the
    // sr-only "autonym + code" name.
    const accessibleNames = wrapper.findAll("label").map(label => {
      const clone = label.element.cloneNode(true) as HTMLElement;
      clone
        .querySelectorAll('[aria-hidden="true"]')
        .forEach(node => node.remove());
      return (clone.textContent ?? "").replace(/\s+/g, " ").trim();
    });

    // WCAG 2.5.3: the visible code is contained in the accessible name,
    // which also carries the autonym (T-009: languages are named in their
    // own language, never translated).
    expect(accessibleNames).toEqual([
      "English EN",
      "Polski PL",
      "Українська UA"
    ]);

    const flags = wrapper.findAll(".language-switcher__flag");
    expect(flags).toHaveLength(3);
    for (const flag of flags) {
      expect(flag.attributes("aria-hidden")).toBe("true");
    }
  });

  it("persists the choice and keeps the current route when switching", async () => {
    const { wrapper, router } = await mountSwitcher(
      "/pl/projects?src=test#section"
    );

    await radioByValue(wrapper, "uk")!.setValue();
    await flushPromises();

    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("uk");
    expect(router.currentRoute.value.path).toBe("/uk/projects");
    // Query and hash survive the locale swap — the user keeps their place.
    expect(router.currentRoute.value.query).toEqual({ src: "test" });
    expect(router.currentRoute.value.hash).toBe("#section");

    // After navigation the new locale's radio is the announced current one.
    expect(
      (radioByValue(wrapper, "uk")!.element as HTMLInputElement).checked
    ).toBe(true);
  });
});
