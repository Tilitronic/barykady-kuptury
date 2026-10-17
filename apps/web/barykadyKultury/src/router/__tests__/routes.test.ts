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
