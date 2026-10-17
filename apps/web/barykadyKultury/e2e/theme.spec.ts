import { expect, type Page } from "@playwright/test";

import { test } from "./support/network-guard";

/**
 * T-010 theme journey (docs/PRODUCT_REQUIREMENTS.md §3,
 * docs/DESIGN_SYSTEM.md §5/§6, D-20).
 *
 * Runs against the *built* SPA through the Playwright-managed server, so it
 * proves the shipped artifact: the CSP-safe pre-paint script
 * (`public/theme-init.js`), the boot wiring of both D-20 mechanisms, live
 * system-preference following and persistence. Playwright gives every test a
 * fresh context, so storage starts empty.
 *
 * `test` comes from `./support/network-guard` (no live services). All requests
 * stay same-origin.
 */
const THEME_KEY = "bk.theme";

/** NERO — the `--color-background` value of the dark theme (tokens.css). */
const DARK_BACKGROUND = "#262424";
/** GRAY93 — the light-theme background. */
const LIGHT_BACKGROUND = "#ededed";

async function backgroundToken(page: Page): Promise<string> {
  return page.evaluate(() =>
    getComputedStyle(document.documentElement)
      .getPropertyValue("--color-background")
      .trim()
  );
}

test.describe("theme preference", () => {
  test("a dark system preference paints dark and themes Quasar on first load", async ({
    page
  }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/en");

    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(
      await page
        .locator("html")
        .evaluate(element => element.classList.contains("dark"))
    ).toBe(false);
    expect(await backgroundToken(page)).toBe(DARK_BACKGROUND);
    // D-20 second mechanism: Quasar's `body--dark`.
    await expect(page.locator("body")).toHaveClass(/body--dark/);
  });

  test("a stored override is applied before the app bundle runs (no flash)", async ({
    page
  }) => {
    await page.addInitScript(
      key => localStorage.setItem(key, "dark"),
      THEME_KEY
    );
    await page.emulateMedia({ colorScheme: "light" });

    // Neutralise the app bundle so only index.html and /theme-init.js execute.
    // If the attribute is already dark here, the pre-paint script — not the
    // runtime boot — set it, which is the no-flash guarantee.
    await page.route("**/assets/*.js", route =>
      route.fulfill({
        status: 200,
        contentType: "text/javascript",
        body: ""
      })
    );

    await page.goto("/en");

    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(await backgroundToken(page)).toBe(DARK_BACKGROUND);
  });

  test("toggling persists across reload and ignores later system changes", async ({
    page
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/en");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    expect(await backgroundToken(page)).toBe(LIGHT_BACKGROUND);

    await page.getByRole("button", { name: "Toggle dark theme" }).click();

    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator("body")).toHaveClass(/body--dark/);
    expect(
      await page.evaluate(key => localStorage.getItem(key), THEME_KEY)
    ).toBe("dark");

    // Reload: the explicit choice survives even though the system is light.
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator("body")).toHaveClass(/body--dark/);

    // A system change must not move an overridden page.
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.emulateMedia({ colorScheme: "light" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(await backgroundToken(page)).toBe(DARK_BACKGROUND);
  });

  test("system changes update the page live while no override is stored", async ({
    page
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/en");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    await page.emulateMedia({ colorScheme: "dark" });

    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator("body")).toHaveClass(/body--dark/);
    expect(await backgroundToken(page)).toBe(DARK_BACKGROUND);
  });
});
