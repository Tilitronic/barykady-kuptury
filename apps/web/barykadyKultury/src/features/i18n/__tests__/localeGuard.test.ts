import { describe, expect, it } from "vitest";
import type { NavigationGuard, RouteLocationNormalized } from "vue-router";

import { createLocaleGuard } from "@/features/i18n/localeGuard";
import type { Locale } from "@/features/i18n/locales";
import type { LocaleStore } from "@/features/i18n/localeStorage";
import type { LocalePageMeta } from "@/features/i18n/pageMeta";

/**
 * Guards the invariants from docs/PRODUCT_REQUIREMENTS.md §2:
 * - the active route's locale drives document `lang`/`dir` (item 7);
 * - navigating inside a locale never rewrites the persisted choice (item 4);
 * - title/description follow the route (docs/architecture.md §8).
 *
 * The guard never decides the URL: root redirection and the 404 for an unknown
 * locale segment are owned by the explicit route table (`src/router/routes.ts`),
 * which keeps "the URL is authoritative" a structural property.
 */

function routeOf(
  path: string,
  locale?: string,
  pageMeta?: LocalePageMeta
): RouteLocationNormalized {
  return {
    path,
    params: locale === undefined ? {} : { locale },
    meta: pageMeta === undefined ? {} : { pageMeta }
  } as unknown as RouteLocationNormalized;
}

/** Invokes the guard with a no-op `next` (the guard decides synchronously). */
function run(
  guard: NavigationGuard,
  to: RouteLocationNormalized,
  from: RouteLocationNormalized
) {
  return guard(to, from, () => undefined);
}

function createStore(saved: Locale | null) {
  const writes: Locale[] = [];
  const store: LocaleStore = {
    read: () => saved,
    write: locale => {
      writes.push(locale);
    }
  };
  return { store, writes };
}

function createDeps(
  overrides: Partial<{
    saved: Locale | null;
    languages: readonly string[];
  }> = {}
) {
  const { store, writes } = createStore(overrides.saved ?? null);
  const applied: Locale[] = [];
  const guard = createLocaleGuard({
    doc: document,
    store,
    getLanguages: () => overrides.languages ?? ["en-US"],
    setLocale: locale => {
      applied.push(locale);
    },
    translate: key => key
  });
  return { guard, writes, applied };
}

describe("locale navigation guard", () => {
  it("applies the route locale to document metadata and i18n", () => {
    const { guard, applied } = createDeps();

    const result = run(
      guard,
      routeOf("/pl/projects", "pl"),
      routeOf("/pl", "pl")
    );

    expect(result).toBe(true);
    expect(applied).toEqual(["pl"]);
    expect(document.documentElement.lang).toBe("pl");
    expect(document.documentElement.dir).toBe("ltr");
  });

  it("applies route title and description from the route's pageMeta", () => {
    const { guard } = createDeps();

    run(
      guard,
      routeOf("/en/projects", "en", {
        titleKey: "projects.title",
        descriptionKey: "projects.description"
      }),
      routeOf("/en", "en")
    );

    expect(document.title).toBe("projects.title");
    expect(
      document
        .querySelector('meta[name="description"]')
        ?.getAttribute("content")
    ).toBe("projects.description");
  });

  it("falls back to the not-found metadata when a route declares none", () => {
    const { guard } = createDeps();

    run(guard, routeOf("/404", undefined), routeOf("/en", "en"));

    expect(document.title).toBe("notFound.title");
  });

  it("never rewrites the persisted choice when navigating inside a locale", () => {
    const { guard, writes } = createDeps({ saved: "pl" });

    run(guard, routeOf("/pl", "pl"), routeOf("/", undefined));
    run(guard, routeOf("/pl/projects", "pl"), routeOf("/pl", "pl"));

    expect(writes).toEqual([]);
  });

  it("falls back to the saved choice for routes without a locale segment", () => {
    const { guard, applied } = createDeps({ saved: "uk" });

    run(guard, routeOf("/404", undefined), routeOf("/pl", "pl"));

    expect(applied).toEqual(["uk"]);
    expect(document.documentElement.lang).toBe("uk");
    expect(document.title).toBe("notFound.title");
  });
});
