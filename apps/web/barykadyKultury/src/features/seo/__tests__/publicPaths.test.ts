import { describe, expect, it } from "vitest";
import type { RouteRecordRaw } from "vue-router";

import { PUBLIC_SITE_PATHS } from "@/features/seo/publicPaths";
import { routes } from "@/router/routes";

/**
 * T-034 — the sitemap path list must track the real route table.
 *
 * The sitemap generator (`scripts/generate-seo-files.mjs`) cannot import the
 * router (Vue components, aliases), so it reads `public-paths.json`. Without
 * this gate a new public page would silently never appear in `sitemap.xml`,
 * and a removed page would 404 from the sitemap — both are SEO defects that no
 * runtime test would catch.
 */

/** The locale layout record: the only parent whose children are public pages. */
function localeParent(): RouteRecordRaw {
  const parent = routes.find(record =>
    record.children?.some(child => child.name === "home")
  );
  if (parent === undefined) {
    throw new Error("locale layout route not found");
  }
  return parent;
}

/**
 * Static, indexable public routes in locale-less form.
 *
 * Excluded on purpose:
 * - redirects (vue-router records without a name and with `redirect`);
 * - the locale catch-all 404;
 * - parameterised detail routes (content-dependent, deferred until prerender);
 * - noindex records.
 */
function staticPublicPaths(): string[] {
  return (localeParent().children ?? [])
    .filter(child => child.redirect === undefined)
    .filter(child => typeof child.name === "string")
    .filter(child => child.name !== "locale-not-found")
    .filter(child => child.meta?.noindex !== true)
    .filter(child => !child.path.includes(":"))
    .map(child => (child.path === "" ? "" : `/${child.path}`));
}

describe("public sitemap paths", () => {
  it("matches every static public route exactly", () => {
    expect([...PUBLIC_SITE_PATHS].sort()).toEqual(staticPublicPaths().sort());
  });

  it("never lists a private or redirecting surface", () => {
    for (const path of PUBLIC_SITE_PATHS) {
      expect(path).not.toContain("admin");
      expect(path).not.toContain(":");
    }
  });
});
