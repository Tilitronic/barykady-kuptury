import { expect } from "@playwright/test";

import { test } from "./support/network-guard";

/**
 * T-009 locale routing journey (docs/PRODUCT_REQUIREMENTS.md §2,
 * docs/architecture.md §8). These tests exercise the *built* SPA through the
 * Playwright-managed server, so they prove the redirect, the URL authority, the
 * document metadata and persistence as shipped — not just as unit-tested.
 *
 * Playwright gives every test a fresh browser context, so storage starts empty
 * and each test observes only the state it sets up itself.
 *
 * The `test` export from `./support/network-guard` installs the "no live
 * services" guard; nothing here talks to a real backend.
 */
const LANGUAGE_KEY = "bk.locale";

test.describe("locale routing", () => {
  test("redirects the root URL to the browser-preferred locale", async ({
    page
  }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/en$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Barykady Kultury"
    );
  });

  test("a saved choice wins over the browser preference at the root", async ({
    page
  }) => {
    await page.addInitScript(
      key => localStorage.setItem(key, "pl"),
      LANGUAGE_KEY
    );

    await page.goto("/");

    await expect(page).toHaveURL(/\/pl$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "pl");
  });

  test("an explicit locale URL is authoritative for the page content", async ({
    page
  }) => {
    await page.goto("/pl/projects");

    await expect(page).toHaveURL(/\/pl\/projects$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Projekty"
    );
    await expect(page.locator("html")).toHaveAttribute("lang", "pl");
  });

  test("updates the document language on every navigation", async ({
    page
  }) => {
    await page.goto("/en");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    await page.goto("/uk/projects");
    await expect(page.locator("html")).toHaveAttribute("lang", "uk");

    await page.goto("/pl");
    await expect(page.locator("html")).toHaveAttribute("lang", "pl");
  });

  test("an unknown locale segment renders the 404 page without redirecting", async ({
    page
  }) => {
    await page.goto("/xx");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Page not found"
    );
    // No silent fallback and no redirect loop: the requested URL is preserved.
    await expect(page).toHaveURL(/\/xx$/);
  });

  test("switching language keeps the route and query and persists", async ({
    page
  }) => {
    await page.goto("/pl/projects?src=e2e");

    // The language picker is a radio group of flag+code chips; the
    // accessible name is the autonym + display code (value stays `uk`).
    await page.getByRole("radio", { name: "Українська UA" }).click();

    await expect(page).toHaveURL(/\/uk\/projects\?src=e2e$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "uk");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Проєкти");

    const saved = await page.evaluate(
      key => localStorage.getItem(key),
      LANGUAGE_KEY
    );
    expect(saved).toBe("uk");

    // The saved choice drives the root redirect on the next visit.
    await page.goto("/");
    await expect(page).toHaveURL(/\/uk$/);
  });
});

test.describe("locale routing with a Ukrainian browser preference", () => {
  test.use({ locale: "uk-UA" });

  test("redirects the root URL to uk", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/uk$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "uk");
  });

  test("a deep link to /pl/projects stays Polish", async ({ page }) => {
    await page.goto("/pl/projects");

    await expect(page).toHaveURL(/\/pl\/projects$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "pl");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Projekty"
    );
  });
});
