import { expect } from "@playwright/test";

import { test } from "./support/network-guard";

/**
 * T-034 gate fix — deploy-runtime reachability.
 *
 * The built app is served by `scripts/serve-spa.mjs`, which now runs the real
 * Netlify function binding for `/.netlify/functions/*` BEFORE the SPA fallback
 * (mirroring Netlify's functions-before-redirects precedence). These assertions
 * prove:
 *   - the documented calendar path is reachable (not 404, not `index.html`);
 *   - the response is the function's JSON contract;
 *   - an unknown function name is a real 404, never the SPA entry point.
 *
 * `playwright.config.ts` pins the Google credential variables to empty strings
 * so the no-config branch is deterministic and no live service is contacted
 * (docs/TESTING.md §2).
 */

const CALENDAR_PATH = "/.netlify/functions/calendar-events";

test.describe("deploy runtime", () => {
  test("calendar function answers at the documented path", async ({
    request
  }) => {
    const response = await request.get(CALENDAR_PATH);

    expect(response.status(), `${CALENDAR_PATH} must not be a 404`).not.toBe(
      404
    );

    const contentType = response.headers()["content-type"] ?? "";
    expect(contentType, "function contract is JSON").toContain(
      "application/json"
    );
    expect(contentType, "SPA fallback serves HTML").not.toContain("text/html");

    // No Google config in the E2E environment: the function must fail closed
    // with its stable code rather than reach a live service.
    expect(await response.json()).toEqual({ error: "calendar_unavailable" });
  });

  test("an unknown function path never falls back to the SPA", async ({
    request
  }) => {
    const response = await request.get("/.netlify/functions/unknown-function");

    expect(response.status()).toBe(404);
    expect(response.headers()["content-type"]).toContain("application/json");
    expect(await response.text()).not.toContain("<!doctype html>");
  });
});
