import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it } from "vitest";

import ThemeToggle from "@/components/ThemeToggle.vue";
import { THEME_STORAGE_KEY } from "@/features/theme/theme";
import { themeController } from "@/features/theme/themeRuntime";
import { createTestI18n } from "@/test-utils/mount";

/**
 * Component contract for the theme control (docs/TESTING.md §2 lists
 * language/theme controls under component tests; docs/DESIGN_SYSTEM.md §5/§6
 * require an accessible visible label or a clear pressed state and keyboard
 * operability).
 *
 * The controller is the app-wide singleton so the test exercises the real
 * persistence path rather than a stand-in.
 */
function mountToggle(locale: "en" | "pl" | "uk" = "en") {
  return mount(ThemeToggle, {
    global: { plugins: [createTestI18n(locale)] }
  });
}

describe("ThemeToggle", () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset the shared controller to "follow the system" between tests.
    themeController.setOverride(null);
  });

  it("is a native button with a non-empty accessible name and a pressed state", () => {
    const wrapper = mountToggle();
    const button = wrapper.get("button");

    expect(button.attributes("type")).toBe("button");
    expect(button.text().trim().length).toBeGreaterThan(0);
    expect(["true", "false"]).toContain(button.attributes("aria-pressed"));
  });

  it("exposes the resolved state and pins the opposite theme on activation", async () => {
    themeController.setOverride("light");
    const wrapper = mountToggle();
    const button = wrapper.get("button");

    expect(button.attributes("aria-pressed")).toBe("false");

    await button.trigger("click");

    expect(button.attributes("aria-pressed")).toBe("true");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("labels the control in every supported locale", () => {
    expect(mountToggle("en").get("button").text()).toBe("Toggle dark theme");
    expect(mountToggle("pl").get("button").text()).toBe("Przełącz tryb ciemny");
    expect(mountToggle("uk").get("button").text()).toBe(
      "Перемкнути темну тему"
    );
  });
});
