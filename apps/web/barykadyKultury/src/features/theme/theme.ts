/**
 * T-010 theme domain — pure logic and the single source of truth for the
 * light/dark contract.
 *
 * Precedence is fixed by docs/DESIGN_SYSTEM.md §5 and
 * docs/PRODUCT_REQUIREMENTS.md §3:
 *
 *   1. an explicit user override (persisted under `bk.theme`), else
 *   2. the operating system `prefers-color-scheme` preference, else
 *   3. light.
 *
 * Everything here is a pure function: the browser surfaces (`localStorage`,
 * `matchMedia`) are supplied by callers, so the module has no hidden globals to
 * stub in tests and the pre-paint bootstrap (`public/theme-init.js`) can mirror
 * this exact contract (guarded by `themeInitParity.test.ts`).
 */

/** The resolved theme actually applied to the document. */
export type Theme = "light" | "dark";

/**
 * A persisted user choice. `null` means "no override" — the page follows the
 * system preference (and keeps following it live).
 */
export type ThemeOverride = Theme | null;

/** `localStorage` key holding the explicit user theme choice (T-010). */
export const THEME_STORAGE_KEY = "bk.theme";

/** Narrows an untrusted value (storage, script input) to a resolved theme. */
export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

export interface ResolveThemeInput {
  /** Current result of `matchMedia('(prefers-color-scheme: dark)')`. */
  systemPrefersDark: boolean;
  /** Raw stored value; untrusted, so an invalid value is ignored. */
  stored: unknown;
}

/**
 * Resolves the theme to apply. A valid stored override always wins; otherwise
 * the system preference decides, defaulting to light when it is false/unknown.
 */
export function resolveTheme({
  systemPrefersDark,
  stored
}: ResolveThemeInput): Theme {
  if (isTheme(stored)) {
    return stored;
  }

  return systemPrefersDark ? "dark" : "light";
}

/**
 * The explicit override produced by activating the theme control: the opposite
 * of the currently resolved theme. Cycling to the opposite value is what makes
 * a single toggle able to pin either theme regardless of the system setting.
 */
export function nextOverride(current: Theme): Theme {
  return current === "dark" ? "light" : "dark";
}
