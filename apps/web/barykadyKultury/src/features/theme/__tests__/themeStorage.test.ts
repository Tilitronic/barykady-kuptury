import { describe, expect, it } from "vitest";

import { THEME_STORAGE_KEY } from "@/features/theme/theme";
import { createThemeStore } from "@/features/theme/themeStorage";

/**
 * Spec axis: docs/PRODUCT_REQUIREMENTS.md §3 and T-010 scope — "Storage failure
 * (privacy mode) must not break the page — guarded access with tests."
 *
 * Every storage interaction is wrapped, so a private-mode SecurityError or a
 * quota error degrades to "no override" (system preference) instead of throwing
 * during boot. The store is injected so tests never touch a real `window`.
 */
function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    }
  };
}

describe("createThemeStore", () => {
  it("reads a valid stored override", () => {
    const store = createThemeStore(
      memoryStorage({ [THEME_STORAGE_KEY]: "dark" })
    );

    expect(store.read()).toBe("dark");
  });

  it("returns null for an absent, invalid or empty value", () => {
    expect(createThemeStore(memoryStorage()).read()).toBeNull();
    expect(
      createThemeStore(memoryStorage({ [THEME_STORAGE_KEY]: "blue" })).read()
    ).toBeNull();
    expect(
      createThemeStore(memoryStorage({ [THEME_STORAGE_KEY]: "" })).read()
    ).toBeNull();
  });

  it("writes and clears the stored override", () => {
    const storage = memoryStorage();
    const store = createThemeStore(storage);

    store.write("dark");
    expect(storage.getItem(THEME_STORAGE_KEY)).toBe("dark");

    store.clear();
    expect(storage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it("does not throw when reading throws (privacy mode)", () => {
    const store = createThemeStore({
      getItem() {
        throw new Error("SecurityError: storage is blocked");
      },
      setItem() {},
      removeItem() {}
    });

    expect(() => store.read()).not.toThrow();
    expect(store.read()).toBeNull();
  });

  it("does not throw when writing or clearing throws (quota / privacy mode)", () => {
    const store = createThemeStore({
      getItem: () => null,
      setItem() {
        throw new Error("QuotaExceededError");
      },
      removeItem() {
        throw new Error("SecurityError");
      }
    });

    expect(() => store.write("dark")).not.toThrow();
    expect(() => store.clear()).not.toThrow();
  });

  it("works without any storage (non-browser environment)", () => {
    const store = createThemeStore(null);

    expect(store.read()).toBeNull();
    expect(() => store.write("light")).not.toThrow();
    expect(() => store.clear()).not.toThrow();
  });
});
