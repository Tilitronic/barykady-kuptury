import { describe, expect, it } from "vitest";
import type {
  RouteLocationNormalized,
  RouteRecordRaw,
  Router
} from "vue-router";
import { createMemoryHistory, createRouter } from "vue-router";

import { createLocaleGuard } from "@/features/i18n/localeGuard";
import { routes } from "@/router/routes";

/**
 * Regression gate for the T-011 follow-up defect (2026-10-18): seven routes
 * rendered correctly but resolved to the *not-found* document metadata because
 * `pageMeta.ts` kept a hand-maintained path map that was never extended.
 *
 * This test iterates the real route table, resolves a concrete URL for every
 * named non-redirect route, runs the actual navigation guard, and fails if any
 * real page resolves to `notFound.title`. Adding a route without `meta.pageMeta`
 * now fails here instead of shipping a "Page not found" tab title.
 */

/** The only routes legitimately allowed to use the not-found metadata. */
const NOT_FOUND_ROUTE_NAMES = new Set(["not-found", "locale-not-found"]);

const NOT_FOUND_TITLE_KEY = "notFound.title";

function collectNamedRoutes(records: RouteRecordRaw[]): RouteRecordRaw[] {
  return records.flatMap(record => [
    ...(record.name !== undefined ? [record] : []),
    ...collectNamedRoutes(record.children ?? [])
  ]);
}

function createTestRouter(): Router {
  return createRouter({ history: createMemoryHistory(), routes });
}

type ResolveByName = (to: {
  name: string;
  params: Record<string, string | string[]>;
}) => RouteLocationNormalized;

/** Resolves a concrete URL for a named route without relying on path literals. */
function resolveConcrete(
  router: Router,
  route: RouteRecordRaw
): RouteLocationNormalized {
  const params: Record<string, string | string[]> = { locale: "en" };
  if (String(route.path).includes("pathMatch")) {
    params.pathMatch = ["does-not-exist"];
  }
  // Dynamic page params (e.g. the documents reader `:slug`) need a concrete
  // value, otherwise resolution warns about a missing required param.
  if (String(route.path).includes(":slug")) {
    params.slug = "regulations";
  }
  // Admin record ids (T-027 edit/preview) are dynamic too.
  if (String(route.path).includes(":id")) {
    params.id = "00000000-0000-4000-8000-000000000201";
  }
  // T-028 site-page preview keys are dynamic.
  if (String(route.path).includes(":pageKey")) {
    params.pageKey = "about";
  }

  // The generated typed-router names come from filename-based routing while this
  // table is explicit (known T-009 follow-up), so resolve by runtime name via a
  // narrow cast. The assertions below verify the resolution actually matched.
  const target: Parameters<ResolveByName>[0] = {
    name: route.name as string,
    params
  };
  return router.resolve(target as never) as unknown as RouteLocationNormalized;
}

function runGuardOn(route: RouteLocationNormalized): void {
  const guard = createLocaleGuard({
    doc: document,
    store: { read: () => "en", write: () => undefined },
    getLanguages: () => ["en-US"],
    setLocale: () => undefined,
    translate: key => key
  });

  guard(route, route, () => undefined);
}

describe("route table page metadata (T-011 regression gate)", () => {
  const router = createTestRouter();
  const namedRoutes = collectNamedRoutes(routes);
  const testableRoutes = namedRoutes.filter(
    route => route.redirect === undefined
  );

  it("discovers the page routes from the table (not a copied list)", () => {
    // Guards against the gate silently testing nothing.
    expect(testableRoutes.length).toBeGreaterThanOrEqual(9);
  });

  it.each(testableRoutes)(
    "$name resolves to metadata that is not the not-found fallback",
    route => {
      const name = String(route.name);
      const resolved = resolveConcrete(router, route);
      const meta = resolved.meta.pageMeta;

      document.title = "";
      runGuardOn(resolved);

      if (NOT_FOUND_ROUTE_NAMES.has(name)) {
        expect(document.title, `${name} should be the 404 title`).toBe(
          NOT_FOUND_TITLE_KEY
        );
        return;
      }

      expect(
        document.title,
        `${name} resolved to "${NOT_FOUND_TITLE_KEY}" — add meta.pageMeta to its route record`
      ).not.toBe(NOT_FOUND_TITLE_KEY);

      expect(meta, `${name} is missing meta.pageMeta`).toBeDefined();
      expect(document.title, `${name} did not apply its titleKey`).toBe(
        meta?.titleKey
      );
      expect(meta?.descriptionKey).not.toBe("notFound.description");
    }
  );
});
