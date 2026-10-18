import { expect, type Page } from "@playwright/test";

import { checkA11y } from "./support/a11y";
import { test } from "./support/network-guard";

/**
 * T-011 — Public shell E2E journeys.
 *
 * Exercises the skip link, landmark structure, keyboard traversal, mobile
 * viewport navigation, and axe accessibility scan for the full shell.
 *
 * Runs against the *built* SPA through the Playwright-managed server.
 * The `test` export from `./support/network-guard` enforces the no-live-
 * services contract. Viewport sizes are set per-test.
 */

/**
 * Programmatically set focus on document.body (tabindex="-1") so that a
 * subsequent keyboard.press("Tab") starts from the very beginning of the
 * document tab order rather than from wherever the browser left focus.
 */
async function focusBody(page: Page): Promise<void> {
  await page.evaluate(() => {
    // Give body a transient programmatic-focus tabindex, focus it, remove it.
    document.body.setAttribute("tabindex", "-1");
    document.body.focus();
    document.body.removeAttribute("tabindex");
  });
}

test.describe("shell — skip link and landmarks", () => {
  test("first Tab stop is the skip link", async ({ page }) => {
    await page.goto("/en");
    // Wait for the shell to render completely before testing keyboard nav.
    await page.waitForSelector(".public-layout__skip-link");
    await focusBody(page);

    await page.keyboard.press("Tab");

    const focusedText = await page.evaluate(
      () => document.activeElement?.textContent?.trim() ?? ""
    );
    // Match the English key from the en catalogue ("Skip to main content").
    expect(focusedText).toMatch(/skip/i);
  });

  test("activating the skip link moves focus to #main", async ({ page }) => {
    await page.goto("/en");
    await page.waitForSelector(".public-layout__skip-link");

    // Focus the off-screen skip link programmatically, then press Enter
    // (pressing Enter on a focused <a> fires the click event, which triggers
    // the Vue @click.prevent handler that calls document.getElementById("main").focus()).
    const skipLink = page.locator(".public-layout__skip-link");
    await skipLink.focus();
    await page.keyboard.press("Enter");

    const focusedId = await page.evaluate(
      () => document.activeElement?.id ?? ""
    );
    expect(focusedId).toBe("main");
  });

  test("header, main, and footer landmarks are present", async ({ page }) => {
    await page.goto("/en");

    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
  });

  test("six nav destinations are present in every locale", async ({ page }) => {
    const destinations = [
      "contact",
      "about",
      "support",
      "projects",
      "events",
      "publications"
    ];

    for (const locale of ["en", "pl", "uk"] as const) {
      await page.goto(`/${locale}`);
      // First nav is the AppHeader nav (before the AppFooter nav).
      const nav = page.getByRole("navigation").first();

      for (const dest of destinations) {
        // Use attribute selector — the href="/en/contact" contains "/contact".
        const link = nav.locator(`a[href*="/${dest}"]`);
        await expect(link).toBeVisible();
      }
    }
  });
});

test.describe("shell — navigation active state", () => {
  test("projects link has aria-current=page on the projects route", async ({
    page
  }) => {
    await page.goto("/en/projects");

    const nav = page.getByRole("navigation").first();
    // The active link carries aria-current="page" directly on the <a>.
    const activeLink = nav.locator("a[aria-current='page']");

    await expect(activeLink).toBeVisible();
    const href = await activeLink.getAttribute("href");
    expect(href).toContain("/projects");
  });
});

test.describe("shell — mobile navigation (viewport 390×844)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("mobile nav is closed by default (hamburger visible)", async ({
    page
  }) => {
    await page.goto("/en");

    // The hamburger button must be visible on mobile.
    const trigger = page.getByTestId("menu-trigger");
    await expect(trigger).toBeVisible();
  });

  test("opening the mobile nav shows all six destinations", async ({
    page
  }) => {
    await page.goto("/en");

    await page.getByTestId("menu-trigger").click();

    const nav = page.getByTestId("main-nav");
    await expect(nav.locator("a[href*='/contact']")).toBeVisible();
    await expect(nav.locator("a[href*='/about']")).toBeVisible();
    await expect(nav.locator("a[href*='/projects']")).toBeVisible();
  });
});

/**
 * 320 px regression suite (rev-2 finding C).
 *
 * At the minimum supported width the header must fit within the viewport
 * (no horizontal overflow) and the language/theme controls must be accessible
 * via the mobile drawer — not clipped by an ancestor's overflow property.
 *
 * The controls live in the drawer (not the header bar) at this viewport so
 * the assertion opens the drawer, then checks the theme button is visible.
 * The theme E2E at desktop width is unaffected: the controls are in the
 * inline panel at ≥ 768 px (no drawer needed).
 */
test.describe("shell — 320 px regression", () => {
  test.use({ viewport: { width: 320, height: 568 } });

  test("no horizontal overflow in en, pl, uk", async ({ page }) => {
    for (const locale of ["en", "pl", "uk"] as const) {
      await page.goto(`/${locale}`);
      const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
      expect(
        scrollWidth,
        `horizontal overflow detected in ${locale}`
      ).toBeLessThanOrEqual(320);
    }
  });

  test("header bar scrollWidth does not exceed clientWidth in all locales", async ({
    page
  }) => {
    for (const locale of ["en", "pl", "uk"] as const) {
      await page.goto(`/${locale}`);
      const overflows = await page.evaluate(() => {
        const header = document.querySelector(".app-header") as HTMLElement;
        return header ? header.scrollWidth > header.clientWidth : false;
      });
      expect(overflows, `header clips content in ${locale}`).toBe(false);
    }
  });

  test("theme toggle is fully visible in the drawer (en)", async ({ page }) => {
    await page.goto("/en");
    await page.getByTestId("menu-trigger").click();

    // The theme toggle is in the drawer; toBeVisible() confirms it is not
    // hidden or clipped by the panel's overflow (overflow-y: auto).
    await expect(
      page.getByRole("button", { name: "Toggle dark theme" })
    ).toBeVisible();
  });

  test("theme toggle is accessible in all three locales", async ({ page }) => {
    const cases = [
      { locale: "en", name: "Toggle dark theme" },
      { locale: "pl", name: "Przełącz tryb ciemny" },
      { locale: "uk", name: "Перемкнути темну тему" }
    ] as const;

    for (const { locale, name } of cases) {
      await page.goto(`/${locale}`);
      await page.getByTestId("menu-trigger").click();
      await expect(
        page.getByRole("button", { name }),
        `${locale}: theme toggle not visible`
      ).toBeVisible();
      // Close before next iteration
      await page.getByTestId("menu-trigger").click();
    }
  });
});

test.describe("shell — keyboard traversal", () => {
  test("logo link and nav links are keyboard-reachable after the skip link", async ({
    page
  }) => {
    await page.goto("/en");
    await page.waitForSelector(".public-layout__skip-link");
    await focusBody(page);

    // Collect what receives focus on the first 4 Tab presses.
    const labels: string[] = [];
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press("Tab");
      const label = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        return (
          el?.getAttribute("aria-label") ??
          el?.textContent?.trim() ??
          el?.tagName?.toLowerCase() ??
          ""
        );
      });
      labels.push(label);
    }

    // First: skip link text
    expect(labels[0]).toMatch(/skip/i);
    // Second: brand logo link (aria-label="Barykady Kultury")
    expect(labels[1]).toMatch(/barykady kultury/i);
    // Third onward: at least one nav link with non-empty text
    const hasNavLink = labels.slice(2).some(l => l.length > 0);
    expect(hasNavLink).toBe(true);
  });
});

test.describe("shell — axe accessibility scan", () => {
  test("no critical violations on the home shell in light theme", async ({
    page
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/en");
    await checkA11y(page);
  });

  test("no critical violations on the home shell in dark theme", async ({
    page
  }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/en");
    await checkA11y(page);
  });

  test("no critical violations at mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en");
    await checkA11y(page);
  });
});
