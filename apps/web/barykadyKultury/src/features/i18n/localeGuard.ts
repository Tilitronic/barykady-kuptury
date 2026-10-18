import type { NavigationGuard, RouteLocationNormalized } from "vue-router";

import { applyDocumentLocale } from "./documentLocale";
import { isLocale, type Locale } from "./locales";
import type { LocaleStore } from "./localeStorage";
import type { MessageKey } from "./messageKey";
import { applyPageMeta, NOT_FOUND_META } from "./pageMeta";
import { resolveLocale } from "./resolveLocale";

export interface LocaleGuardDependencies {
  /** Document to update; `null` disables metadata writes (non-browser). */
  doc: Document | null;
  /** Persisted-choice store. Read-only here — the guard never writes to it. */
  store: LocaleStore;
  /** Ordered browser language preferences. */
  getLanguages: () => readonly string[];
  /** Applies the locale to the i18n instance. */
  setLocale: (locale: Locale) => void;
  /** Translates a catalogue key for the active locale. */
  translate: (key: MessageKey) => string;
}

/**
 * Resolves the locale that a navigation should activate.
 *
 * The route table constrains the `locale` param to `en|pl|uk`, so a valid param
 * is used directly. Routes without the param (the 404 views) fall back to the
 * saved choice, then the browser preference, then English.
 */
function resolveActiveLocale(
  to: RouteLocationNormalized,
  dependencies: LocaleGuardDependencies
): Locale {
  const { locale } = to.params as { locale?: unknown };
  if (isLocale(locale)) {
    return locale;
  }

  return resolveLocale({
    saved: dependencies.store.read(),
    languages: dependencies.getLanguages()
  });
}

/**
 * Builds the global navigation guard responsible for document-level locale
 * metadata: document `lang`/`dir`, the i18n active locale, and the route title
 * and description.
 *
 * Deliberately narrow: it does not choose URLs, does not redirect, and does not
 * persist anything. Root redirection and the 404 for an unknown locale are owned
 * by the route table (see `src/router/routes.ts`), which keeps the URL
 * authoritative (docs/architecture.md §8) and makes "navigating inside a locale
 * never rewrites the saved choice" a structural property.
 */
export function createLocaleGuard(
  dependencies: LocaleGuardDependencies
): NavigationGuard {
  return to => {
    const locale = resolveActiveLocale(to, dependencies);

    dependencies.setLocale(locale);
    applyDocumentLocale(dependencies.doc, locale);
    // The route table is the single source of truth for page metadata: a route
    // declares its own catalogue keys in `meta.pageMeta`, so adding a route
    // without metadata is caught by the route-table regression gate instead of
    // silently shipping the 404 title (T-011 follow-up defect).
    applyPageMeta(
      dependencies.doc,
      to.meta.pageMeta ?? NOT_FOUND_META,
      dependencies.translate
    );

    return true;
  };
}
