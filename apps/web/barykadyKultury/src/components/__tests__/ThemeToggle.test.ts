import { mount, VueWrapper } from "@vue/test-utils";
import { beforeEach, describe, expect, it } from "vitest";

import ThemeToggle from "@/components/ThemeToggle.vue";
import { THEME_STORAGE_KEY } from "@/features/theme/theme";
import { themeController } from "@/features/theme/themeRuntime";
import { createTestI18n } from "@/test-utils/mount";

/**
 * Component contract for the theme control (docs/PRODUCT_REQUIREMENTS.md §3,
 * docs/DESIGN_SYSTEM.md §5/§6).
 *
 * The control is a labelled ON/OFF switch (user decision, brand-fixes
 * series): a native `input[type=checkbox]` with `role="switch"`, wrapped in
 * the `<label>` that carries the visible text — so the accessible name is
 * exactly the visible words (WCAG 2.5.3). The tests assert:
 *  - one switch control, no fieldset/radiogroup remnants;
 *  - `aria-checked` mirrors the RESOLVED theme (system-following included);
 *  - activation pins the override through the real controller and persists
 *    to `localStorage[THEME_STORAGE_KEY]`;
 *  - the label text in all three locales.
 *
 * The controller is the app-wide singleton so the test exercises the real
 * persistence path rather than a stand-in.
 */
type Locale = "en" | "pl" | "uk";

/**
 * Visible label == accessible name, per catalogue. These are also the
 * strings the E2E specs target with getByRole("switch", { name }).
 */
const SWITCH_NAMES: Record<Locale, string> = {
  en: "Dark mode",
  pl: "Tryb ciemny",
  uk: "Темний режим"
};

function mountToggle(locale: Locale = "en") {
  return mount(ThemeToggle, {
    global: { plugins: [createTestI18n(locale)] }
  });
}

function switchInput(wrapper: VueWrapper) {
  return wrapper.get('input[type="checkbox"]');
}

function isChecked(wrapper: VueWrapper): boolean {
  return (switchInput(wrapper).element as HTMLInputElement).checked;
}

describe("ThemeToggle — labelled dark-mode switch", () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset the shared controller to "follow the system" between tests.
    themeController.setOverride(null);
  });

  it("is a single native checkbox exposed as a switch, named by its visible label", () => {
    const wrapper = mountToggle();
    const input = switchInput(wrapper);

    expect(input.attributes("role")).toBe("switch");
    expect(["true", "false"]).toContain(input.attributes("aria-checked"));

    // The control lives inside its label; the label's only text is the
    // visible name (no hidden extras), so accessible name == visible text.
    const label = wrapper.get("label");
    expect(label.find('input[type="checkbox"]').exists()).toBe(true);
    expect(label.text().trim()).toBe(SWITCH_NAMES.en);

    // Radiogroup remnants are gone.
    expect(wrapper.find("fieldset").exists()).toBe(false);
    expect(wrapper.find("legend").exists()).toBe(false);
    expect(wrapper.findAll('input[type="radio"]')).toHaveLength(0);
  });

  it("mirrors the RESOLVED theme, not just the stored override", () => {
    themeController.setOverride("dark");
    let wrapper = mountToggle();
    expect(isChecked(wrapper)).toBe(true);
    expect(switchInput(wrapper).attributes("aria-checked")).toBe("true");

    themeController.setOverride("light");
    wrapper = mountToggle();
    expect(isChecked(wrapper)).toBe(false);
    expect(switchInput(wrapper).attributes("aria-checked")).toBe("false");
  });

  it("activating the switch pins the opposite override and persists it", async () => {
    themeController.setOverride("light");
    const wrapper = mountToggle();

    await switchInput(wrapper).setValue(true);

    expect(themeController.theme.value).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(isChecked(wrapper)).toBe(true);

    await switchInput(wrapper).setValue(false);

    expect(themeController.theme.value).toBe("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    expect(isChecked(wrapper)).toBe(false);
  });

  it("labels the switch in every supported locale", () => {
    for (const locale of ["en", "pl", "uk"] as const) {
      const wrapper = mountToggle(locale);
      expect(wrapper.get("label").text().trim()).toBe(SWITCH_NAMES[locale]);
    }
  });
});
