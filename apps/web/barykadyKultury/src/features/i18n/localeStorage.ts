import { isLocale, type Locale } from "./locales";

/** `localStorage` key holding the explicit user language choice. */
export const LOCALE_STORAGE_KEY = "bk.locale";

/** The slice of the Storage API the locale persistence needs. */
type StorageLike = Pick<Storage, "getItem" | "setItem">;

export interface LocaleStore {
  /** Returns the saved locale, or `null` when absent/invalid/unavailable. */
  read(): Locale | null;
  /** Persists an explicit user choice. Called only from the language switcher. */
  write(locale: Locale): void;
}

/**
 * Wraps optional web storage behind a tiny interface.
 *
 * Two reasons for the indirection: the router guard must *never* write (only
 * an explicit user action may), and tests can inject a fake store without
 * touching `window`. A corrupt or tampered value reads as absent rather than
 * throwing, keeping "do not switch unexpectedly" intact.
 */
export function createLocaleStore(storage: StorageLike | null): LocaleStore {
  return {
    read() {
      if (!storage) return null;
      const value = storage.getItem(LOCALE_STORAGE_KEY);
      return isLocale(value) ? value : null;
    },
    write(locale) {
      storage?.setItem(LOCALE_STORAGE_KEY, locale);
    }
  };
}

/** Application-wide store backed by `localStorage` when available. */
export const localeStore: LocaleStore = createLocaleStore(
  typeof window === "undefined" ? null : window.localStorage
);
