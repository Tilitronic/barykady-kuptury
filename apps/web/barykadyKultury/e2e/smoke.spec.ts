import { expect } from "@playwright/test";

import { checkA11y } from "./support/a11y";
import { test } from "./support/network-guard";

/**
 * T-003 smoke journey: proves the built app boots on the Playwright-managed
 * server and that the accessibility harness is wired. Role-based selectors only
 * (docs/TESTING.md §2 review gate); no CSS-position coupling.
 *
 * The `test` export from `./support/network-guard` installs the default
 * "no live services" guard, so any unmocked outbound request fails the run.
 */

// The i18n boot is English-only today; T-009 adds locale-prefixed routes and a
// language-aware document. The heading is pinned by role and level first so the
// structural contract survives copy, locale and layout changes.
const HOME_HEADING = "Barykady Kultury";

test.describe("public home page", () => {
  test("responds 200 with a non-empty title and the page heading", async ({
    page
  }) => {
    const response = await page.goto("/");

    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/\S/);

    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();
    await expect(heading).toHaveText(HOME_HEADING);
  });

  test("passes axe with no critical violations", async ({ page }) => {
    await page.goto("/");

    await checkA11y(page);
  });
});
