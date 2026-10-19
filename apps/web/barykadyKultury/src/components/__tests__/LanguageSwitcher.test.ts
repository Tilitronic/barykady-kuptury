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
 * The switcher is a hover-expanding disclosure (user decision,
 * language-hover-switcher): a `<button aria-expanded aria-controls>` showing
 * ONLY the current locale (label + flag + code + chevron), expanding on
 * hover / keyboard focus / click-tap into a panel of per-locale option
 * buttons. The current option carries aria-current. Machine codes are
 * untouched: option targets still route/store `uk` even though the badge
 * shows `UA`.
 */
const mounted: VueWrapper[] = [];

async function mountSwitcher(path: string, locale: "en" | "pl" | "uk" = "pl") {
  const router = createRouter({ history: createMemoryHistory(), routes });
  await router.push(path);
  await router.isReady();

  const wrapper = mount(LanguageSwitcher, {
    attachTo: document.body,
    global: {
      plugins: [createPinia(), createTestI18n(locale), router]
    }
  });
  mounted.push(wrapper);

  return { wrapper, router };
}

function triggerButton(wrapper: VueWrapper) {
  return wrapper.get("button.language-switcher__trigger");
}

function optionButtons(wrapper: VueWrapper) {
  return wrapper.findAll("button.language-switcher__option");
}

/**
 * Approximate the computed accessible name: element text with every
 * aria-hidden subtree removed (the accname algorithm skips them), so the
 * decorative flag, code badge and chevron do not double up with the
 * sr-only "autonym + code" name.
 */
function accessibleName(wrapper: { element: Element }) {
  const clone = wrapper.element.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('[aria-hidden="true"]').forEach(node => node.remove());
  return (clone.textContent ?? "").replace(/\s+/g, " ").trim();
}

describe("LanguageSwitcher — hover disclosure", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    while (mounted.length > 0) {
      mounted.pop()?.unmount();
    }
  });

  it("collapses to the current locale only and is not expanded", async () => {
    const { wrapper } = await mountSwitcher("/pl/projects");

    const trigger = triggerButton(wrapper);
    expect(trigger.attributes("aria-expanded")).toBe("false");
    expect(trigger.attributes("aria-controls")).toBe("bk-language-options");

    // Collapsed visible text: label + current code only (PL, not EN/UA).
    const visible = accessibleName(trigger);
    expect(visible).toContain("Język");
    expect(visible).toContain("PL");

    // Options exist in the DOM but are hidden (display:none) → out of tab
    // order and invisible until the panel opens.
    const options = optionButtons(wrapper);
    expect(options).toHaveLength(3);
    for (const option of options) {
      expect(option.isVisible()).toBe(false);
    }
  });

  it("names the trigger with the localised label plus the current locale", async () => {
    const { wrapper } = await mountSwitcher("/pl/projects");

    // Visible "Język" + "PL" ⊆ accessible name "Język Polski PL"
    // (WCAG 2.5.3; T-009 autonym principle kept).
    expect(accessibleName(triggerButton(wrapper))).toBe("Język Polski PL");
    // The hint tooltip tells pointer users what the control is for.
    expect(triggerButton(wrapper).attributes("title")).toBe("Zmień język");
  });

  it("expands on pointer hover and collapses again on leave", async () => {
    const { wrapper } = await mountSwitcher("/pl/projects");

    await wrapper.trigger("mouseenter");
    expect(triggerButton(wrapper).attributes("aria-expanded")).toBe("true");
    for (const option of optionButtons(wrapper)) {
      expect(option.isVisible()).toBe(true);
    }

    await wrapper.trigger("mouseleave");
    expect(triggerButton(wrapper).attributes("aria-expanded")).toBe("false");
  });

  it("expands on keyboard focus (Tab) without any click", async () => {
    const { wrapper } = await mountSwitcher("/pl/projects");

    await wrapper.trigger("focusin");
    expect(triggerButton(wrapper).attributes("aria-expanded")).toBe("true");
  });

  it("toggles open/closed on click (touch has no hover)", async () => {
    const { wrapper } = await mountSwitcher("/pl/projects");
    const trigger = triggerButton(wrapper);

    await trigger.trigger("click");
    expect(trigger.attributes("aria-expanded")).toBe("true");

    await trigger.trigger("click");
    expect(trigger.attributes("aria-expanded")).toBe("false");
  });

  it("Escape closes the panel and returns focus to the trigger", async () => {
    const { wrapper } = await mountSwitcher("/pl/projects");

    await wrapper.trigger("focusin"); // keyboard opens
    expect(triggerButton(wrapper).attributes("aria-expanded")).toBe("true");

    await wrapper.trigger("keydown", { key: "Escape" });

    expect(triggerButton(wrapper).attributes("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(triggerButton(wrapper).element);
  });

  it("marks the current option with aria-current and a visible check", async () => {
    const { wrapper } = await mountSwitcher("/pl/projects");
    await wrapper.trigger("mouseenter");

    const [en, pl, uk] = optionButtons(wrapper);
    expect(en?.attributes("aria-current")).toBeUndefined();
    expect(pl?.attributes("aria-current")).toBe("true");
    expect(uk?.attributes("aria-current")).toBeUndefined();
    expect(pl?.text()).toContain("✓");
  });

  it("keeps autonym + code accessible names for every option", async () => {
    const { wrapper } = await mountSwitcher("/pl/projects");
    await wrapper.trigger("mouseenter");

    expect(
      optionButtons(wrapper).map(option => accessibleName(option))
    ).toEqual(["English EN", "Polski PL", "Українська UA"]);
  });

  it("persists the choice, keeps route/query/hash, and closes the panel", async () => {
    const { wrapper, router } = await mountSwitcher(
      "/pl/projects?src=test#section"
    );

    await wrapper.trigger("mouseenter");
    const uk = optionButtons(wrapper)[2];
    expect(uk).toBeDefined();
    await uk!.trigger("click");
    await flushPromises();

    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("uk");
    expect(router.currentRoute.value.path).toBe("/uk/projects");
    // Query and hash survive the locale swap — the user keeps their place.
    expect(router.currentRoute.value.query).toEqual({ src: "test" });
    expect(router.currentRoute.value.hash).toBe("#section");

    // Panel collapses after the selection.
    expect(triggerButton(wrapper).attributes("aria-expanded")).toBe("false");

    // The collapsed trigger now shows the NEW current locale.
    expect(accessibleName(triggerButton(wrapper))).toBe("Język Українська UA");
  });

  it("labels the trigger in every supported locale", async () => {
    const cases = [
      { locale: "en", name: "Language English EN", title: "Change language" },
      { locale: "pl", name: "Język Polski PL", title: "Zmień język" },
      { locale: "uk", name: "Мова Українська UA", title: "Змінити мову" }
    ] as const;

    for (const { locale, name, title } of cases) {
      const { wrapper } = await mountSwitcher(`/${locale}`, locale);
      const trigger = triggerButton(wrapper);
      expect(accessibleName(trigger)).toBe(name);
      expect(trigger.attributes("title")).toBe(title);
    }
  });
});
