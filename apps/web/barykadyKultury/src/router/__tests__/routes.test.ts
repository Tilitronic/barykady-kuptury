import { describe, expect, it } from "vitest";
import type { RouteRecordRaw } from "vue-router";
import { createMemoryHistory, createRouter } from "vue-router";

import { routes } from "@/router/routes";

/**
 * The URL contract is authoritative (docs/architecture.md §8): only `en|pl|uk`
 * are valid locale segments, an unknown segment resolves to the 404 page rather
 * than a silent fallback, and the root redirects to the resolved locale.
 */
function createTestRouter() {
  return createRouter({ history: createMemoryHistory(), routes });
}

describe("locale route table", () => {
  it("matches a locale-prefixed route with the locale param", () => {
    const resolved = createTestRouter().resolve("/pl/projects");

    expect((resolved.params as { locale?: string }).locale).toBe("pl");
    expect(resolved.name).toBe("projects");
  });

  it("resolves an unknown locale segment to the not-found route", () => {
    const resolved = createTestRouter().resolve("/xx");

    expect(resolved.name).toBe("not-found");
    expect(resolved.matched).toHaveLength(1);
  });

  it("resolves an unknown sub-route under a valid locale to not-found", () => {
    expect(createTestRouter().resolve("/en/does-not-exist").name).toBe(
      "locale-not-found"
    );
  });

  it("redirects the root to the persisted locale choice", async () => {
    localStorage.setItem("bk.locale", "pl");
    const router = createTestRouter();

    await router.push("/");

    expect(router.currentRoute.value.path).toBe("/pl");
  });
});

/**
 * T-026 — the admin URL contract. The static `admin` segment must out-score
 * the locale layout's catch-all child, so admin URLs can never be swallowed
 * by the public 404, and the three shell routes resolve to their own records.
 */
describe("admin route table (T-026)", () => {
  it.each([
    ["/en/admin", "admin-dashboard"],
    ["/pl/admin/sign-in", "admin-sign-in"],
    ["/uk/admin/access-denied", "admin-denied"]
  ])("resolves %s to %s", (path, name) => {
    const resolved = createTestRouter().resolve(path);

    expect(resolved.name).toBe(name);
  });

  it("gates built admin features by their capability (T-046)", () => {
    const router = createTestRouter();

    expect(router.resolve("/en/admin/projects").meta.requiresCapability).toBe(
      "projects:write"
    );
    expect(
      router.resolve("/en/admin/projects/new").meta.requiresCapability
    ).toBe("projects:write");
    expect(router.resolve("/en/admin/import").meta.requiresCapability).toBe(
      "importer"
    );
    // T-028: site pages and team use their fixed D-42 scopes.
    expect(router.resolve("/en/admin/pages").meta.requiresCapability).toBe(
      "pages:write"
    );
    expect(
      router.resolve("/en/admin/pages/about/preview").meta.requiresCapability
    ).toBe("pages:write");
    expect(router.resolve("/en/admin/team").meta.requiresCapability).toBe(
      "team:write"
    );
    // The dashboard is the shared landing surface: admin area only, no scope.
    expect(router.resolve("/en/admin").meta.requiresCapability).toBeUndefined();
  });

  it("marks the dashboard as requiring the admin claim", () => {
    const router = createTestRouter();

    expect(router.resolve("/en/admin").meta.requiresAdmin).toBe(true);
    // Sign-in and denial are reachable without the claim: they carry no
    // `requiresAdmin` flag (undefined — the guard only tests `=== true`).
    expect(
      router.resolve("/en/admin/sign-in").meta.requiresAdmin
    ).toBeUndefined();
    expect(
      router.resolve("/en/admin/access-denied").meta.requiresAdmin
    ).toBeUndefined();
  });

  it("keeps unknown admin sub-paths on the public 404 surface", () => {
    // Deliberate V1 boundary: the admin area ships no admin-scoped catch-all,
    // so a typo under /admin renders the locale not-found page inside the
    // public shell rather than admin chrome around an empty view.
    expect(createTestRouter().resolve("/en/admin/nope").name).toBe(
      "locale-not-found"
    );
  });
});

/**
 * T-039 (D-25): the About list routes are removed and redirect to the
 * consolidated page's anchored sections, preserving the locale. The reader
 * route is canonical and untouched.
 */
describe("about consolidation redirects (T-039)", () => {
  it("sends /en/about/team to /en/about#team", async () => {
    const router = createTestRouter();
    await router.push("/en/about/team");

    expect(router.currentRoute.value.path).toBe("/en/about");
    expect(router.currentRoute.value.hash).toBe("#team");
  });

  it("sends /uk/about/documents to /uk/about#documents (locale preserved)", async () => {
    const router = createTestRouter();
    await router.push("/uk/about/documents");

    expect(router.currentRoute.value.path).toBe("/uk/about");
    expect(router.currentRoute.value.hash).toBe("#documents");
  });

  it("keeps the document reader route canonical", () => {
    const resolved = createTestRouter().resolve(
      "/pl/about/documents/regulations"
    );

    expect(resolved.name).toBe("about-document");
  });

  it("no longer registers the removed list route names", () => {
    const router = createTestRouter();

    expect(router.hasRoute("about-team")).toBe(false);
    expect(router.hasRoute("about-documents")).toBe(false);
  });
});

/**
 * T-044 F1 — route-level code splitting.
 *
 * The route table is the only place that may import a page. A static import
 * drags every page (including the admin subtree) into the public entry chunk,
 * so this gate asserts each `component` is a lazy loader (a function) rather
 * than a resolved component object. Route names, paths, meta and redirects are
 * unchanged by the split; the suites above keep guarding that contract.
 */
function collectRouteRecords(records: RouteRecordRaw[]): RouteRecordRaw[] {
  return records.flatMap(record => [
    record,
    ...collectRouteRecords(record.children ?? [])
  ]);
}

describe("route-level code splitting (T-044 F1)", () => {
  // Redirect-only records carry no component; they are not split.
  const componentRecords = collectRouteRecords(routes).filter(
    record => "component" in record && record.component !== undefined
  );

  it("covers the whole table, including both layouts", () => {
    // 12 public pages + 3 admin pages + 2 shell layouts + the global 404.
    expect(componentRecords.length).toBeGreaterThanOrEqual(17);
  });

  it.each(componentRecords)(
    "$name ($path) loads its component lazily",
    record => {
      expect(
        typeof (record as { component?: unknown }).component,
        `${String(record.name ?? record.path)} still imports its page eagerly`
      ).toBe("function");
    }
  );
});
