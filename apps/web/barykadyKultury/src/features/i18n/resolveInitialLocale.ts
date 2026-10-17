import { getBrowserLanguages } from "./browserLocale";
import { localeStore, type LocaleStore } from "./localeStorage";
import { resolveLocale } from "./resolveLocale";
import type { Locale } from "./locales";

export interface InitialLocaleDependencies {
  store?: LocaleStore;
  languages?: readonly string[];
}

/**
 * The locale the root URL should redirect to: a saved explicit choice, then the
 * browser preference, then English (docs/architecture.md §8). The injected
 * dependencies let the router table stay declarative while tests drive the
 * precedence without touching real browser state.
 */
export function resolveInitialLocale(
  dependencies: InitialLocaleDependencies = {}
): Locale {
  const store = dependencies.store ?? localeStore;
  const languages = dependencies.languages ?? getBrowserLanguages();

  return resolveLocale({ saved: store.read(), languages });
}
