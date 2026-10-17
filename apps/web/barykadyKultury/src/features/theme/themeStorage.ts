import {
  isTheme,
  THEME_STORAGE_KEY,
  type Theme,
  type ThemeOverride
} from "./theme";

/** The slice of the Storage API the theme persistence needs. */
export type ThemeStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export interface ThemeStore {
  /** Returns the saved explicit choice, or `null` when absent/unavailable. */
  read(): ThemeOverride;
  /** Persists an explicit user choice. Called only from the theme control. */
  write(theme: Theme): void;
  /** Removes the explicit choice so the page follows the system again. */
  clear(): void;
}

/**
 * Wraps optional web storage so persistence can never break the page.
 *
 * WHY the guard: `localStorage` access throws in some privacy modes (the getter
 * itself can throw a `SecurityError`) and `setItem` throws on quota. The theme
 * is a visual preference — if storage is unavailable the page must still render
 * with the system preference rather than throwing during boot (T-010 acceptance
 * criteria). Every operation therefore degrades to "no override" on failure.
 */
export function createThemeStore(storage: ThemeStorage | null): ThemeStore {
  return {
    read() {
      try {
        const value = storage?.getItem(THEME_STORAGE_KEY);
        return isTheme(value) ? value : null;
      } catch {
        return null;
      }
    },
    write(theme) {
      try {
        storage?.setItem(THEME_STORAGE_KEY, theme);
      } catch {
        // Best effort only; an unwritable store must not surface as a crash.
      }
    },
    clear() {
      try {
        storage?.removeItem(THEME_STORAGE_KEY);
      } catch {
        // Ignore: clearing is only used to opt back into the system theme.
      }
    }
  };
}

/**
 * Returns `localStorage` when it is reachable, else `null`.
 *
 * The property read itself is inside the try because accessing
 * `window.localStorage` can throw when storage is disabled, which would
 * otherwise abort module evaluation.
 */
export function getThemeStorage(): ThemeStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Application-wide store backed by `localStorage` when available. */
export const themeStore: ThemeStore = createThemeStore(getThemeStorage());
