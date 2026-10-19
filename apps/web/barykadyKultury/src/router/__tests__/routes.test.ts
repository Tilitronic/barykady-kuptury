import { describe, expect, it } from "vitest";
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

  it("marks only the dashboard as requiring the admin claim", () => {
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
