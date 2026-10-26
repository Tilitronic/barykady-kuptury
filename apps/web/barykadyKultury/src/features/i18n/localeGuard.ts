import type { NavigationGuard, RouteLocationNormalized } from "vue-router";

import { applySeoHead, buildSeoHead } from "@/features/seo/seoHead";

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
  /**
   * T-034: absolute site origin for canonical/`og:url` links. Production passes
   * `VITE_SITE_URL` (docs/environment.md); when absent the document origin is
   * used, which keeps previews correct without inventing a production domain.
   */
  siteUrl?: string | null;
}

/**
 * Canonical origin for the current document. An explicitly configured origin
 * wins (it is stable across preview deploys); otherwise the live origin is the
 * only truthful value available.
 */
function resolveSiteUrl(
  configured: string | null | undefined,
  doc: Document | null
): string | null {
  const trimmed = configured?.trim() ?? "";
  if (trimmed !== "") return trimmed;
  return doc?.location?.origin ?? null;
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
    const pageMeta = to.meta.pageMeta ?? NOT_FOUND_META;
    applyPageMeta(dependencies.doc, pageMeta, dependencies.translate);

    // T-034: title/description are written above; the canonical/hreflang/OG
    // graph is derived from the same route facts so the two can never disagree.
    // `to.path` excludes query/hash — the reader's `?lang=` (D-27) must not
    // create a second canonical URL.
    applySeoHead(
      dependencies.doc,
      buildSeoHead({
        pageMeta,
        locale,
        path: to.path,
        noindex: to.meta.noindex === true,
        siteUrl: resolveSiteUrl(dependencies.siteUrl, dependencies.doc),
        translate: dependencies.translate
      })
    );

    return true;
  };
}
