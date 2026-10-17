import { describe, expect, it } from "vitest";

import { THEME_STORAGE_KEY } from "@/features/theme/theme";
import { createThemeController } from "@/features/theme/themeController";
import { createThemeStore } from "@/features/theme/themeStorage";

/**
 * Controller behaviour: the single source of truth that keeps the persisted
 * choice, the resolved theme and the live system listener consistent
 * (docs/DESIGN_SYSTEM.md §5, docs/PRODUCT_REQUIREMENTS.md §3).
 *
 * Everything browser-ish is faked and injected, so the test asserts the
 * *decisions* (when to listen, when to ignore the system, what to persist)
 * rather than DOM/Quasar side effects.
 */
function createHarness(
  options: {
    stored?: string | null;
    systemPrefersDark?: boolean;
  } = {}
) {
  const data = new Map<string, string>();
  if (options.stored != null) {
    data.set(THEME_STORAGE_KEY, options.stored);
  }
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    }
  };

  let systemPrefersDark = options.systemPrefersDark ?? false;
  let listener: ((dark: boolean) => void) | null = null;
  const applied: string[] = [];

  const controller = createThemeController({
    store: createThemeStore(storage),
    readSystemPrefersDark: () => systemPrefersDark,
    watchSystemPrefersDark: onChange => {
      listener = onChange;
      return () => {
        listener = null;
      };
    },
    applyTheme: theme => {
      applied.push(theme);
    }
  });

  return {
    controller,
    applied,
    storage,
    hasListener: () => listener !== null,
    /** Simulates an OS preference change (fires the listener if attached). */
    changeSystemTo: (dark: boolean) => {
      systemPrefersDark = dark;
      listener?.(dark);
    }
  };
}

describe("createThemeController", () => {
  it("applies the system preference and watches it when nothing is stored", () => {
    const harness = createHarness({ stored: null, systemPrefersDark: true });

    harness.controller.init();

    expect(harness.controller.theme.value).toBe("dark");
    expect(harness.controller.override.value).toBeNull();
    expect(harness.hasListener()).toBe(true);
  });

  it("applies a stored override and does not watch the system", () => {
    const harness = createHarness({ stored: "light", systemPrefersDark: true });

    harness.controller.init();

    expect(harness.controller.theme.value).toBe("light");
    expect(harness.controller.override.value).toBe("light");
    expect(harness.hasListener()).toBe(false);
  });

  it("follows live system changes while no override exists", () => {
    const harness = createHarness({ stored: null, systemPrefersDark: false });
    harness.controller.init();
    expect(harness.controller.theme.value).toBe("light");

    harness.changeSystemTo(true);

    expect(harness.controller.theme.value).toBe("dark");
  });

  it("persists an override and ignores later system changes", () => {
    const harness = createHarness({ stored: null, systemPrefersDark: false });
    harness.controller.init();

    harness.controller.setOverride("dark");

    expect(harness.storage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(harness.controller.theme.value).toBe("dark");
    expect(harness.hasListener()).toBe(false);

    harness.changeSystemTo(false);
    expect(harness.controller.theme.value).toBe("dark");
  });

  it("toggles to the opposite of the resolved theme", () => {
    const harness = createHarness({ stored: null, systemPrefersDark: false });
    harness.controller.init();

    harness.controller.toggle();

    expect(harness.controller.theme.value).toBe("dark");
    expect(harness.storage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("clearing the override restores system following", () => {
    const harness = createHarness({ stored: "dark", systemPrefersDark: true });
    harness.controller.init();
    expect(harness.controller.theme.value).toBe("dark");

    harness.controller.setOverride(null);

    expect(harness.storage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(harness.controller.override.value).toBeNull();
    // Re-resolved from the system (still dark) and watching again.
    expect(harness.controller.theme.value).toBe("dark");
    expect(harness.hasListener()).toBe(true);

    harness.changeSystemTo(false);
    expect(harness.controller.theme.value).toBe("light");
  });

  it("dispose detaches the system listener", () => {
    const harness = createHarness({ stored: null });
    harness.controller.init();
    expect(harness.hasListener()).toBe(true);

    harness.controller.dispose();

    expect(harness.hasListener()).toBe(false);
  });
});
