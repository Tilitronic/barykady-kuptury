import { describe, expect, it } from "vitest";

import {
  isTheme,
  nextOverride,
  resolveTheme,
  THEME_STORAGE_KEY
} from "@/features/theme/theme";

/**
 * Spec axis: docs/DESIGN_SYSTEM.md §5 ("Initial theme follows
 * prefers-color-scheme. A user's explicit toggle overrides system preference and
 * persists.") and docs/PRODUCT_REQUIREMENTS.md §3.
 *
 * Three-state precedence, proven in isolation: stored override > system
 * preference > light fallback. `resolveTheme` is pure — every browser surface is
 * supplied by the caller, so there are no hidden globals to stub and the
 * pre-paint script can mirror the exact same contract (T-010 parity test).
 */
describe("resolveTheme precedence", () => {
  it("lets a stored override win over the system preference", () => {
    expect(resolveTheme({ systemPrefersDark: false, stored: "dark" })).toBe(
      "dark"
    );
    expect(resolveTheme({ systemPrefersDark: true, stored: "light" })).toBe(
      "light"
    );
  });

  it("applies the system preference when no override is stored", () => {
    expect(resolveTheme({ systemPrefersDark: true, stored: null })).toBe(
      "dark"
    );
    expect(resolveTheme({ systemPrefersDark: false, stored: null })).toBe(
      "light"
    );
  });

  it("ignores an invalid stored value and falls back to the system preference", () => {
    expect(resolveTheme({ systemPrefersDark: true, stored: "blue" })).toBe(
      "dark"
    );
    expect(resolveTheme({ systemPrefersDark: false, stored: 42 })).toBe(
      "light"
    );
    expect(resolveTheme({ systemPrefersDark: false, stored: undefined })).toBe(
      "light"
    );
  });

  it("falls back to light when nothing selects a dark theme", () => {
    expect(resolveTheme({ systemPrefersDark: false, stored: null })).toBe(
      "light"
    );
  });
});

describe("nextOverride", () => {
  it("cycles to the opposite explicit theme", () => {
    expect(nextOverride("light")).toBe("dark");
    expect(nextOverride("dark")).toBe("light");
  });
});

describe("isTheme", () => {
  it("accepts only the two resolved theme values", () => {
    expect(isTheme("light")).toBe(true);
    expect(isTheme("dark")).toBe(true);
    expect(isTheme("system")).toBe(false);
    expect(isTheme(null)).toBe(false);
    expect(isTheme(undefined)).toBe(false);
  });
});

describe("THEME_STORAGE_KEY", () => {
  it("is the documented `bk.theme` storage key", () => {
    expect(THEME_STORAGE_KEY).toBe("bk.theme");
  });
});
