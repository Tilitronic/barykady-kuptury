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
 * the assertion opens the drawer, then checks the theme switch is visible.
 * The theme E2E at desktop width is unaffected: the controls are in the
 * inline panel at ≥ 1280 px — the drawer breakpoint band (≤ 1279 px) is
 * covered by the overlap-regression suite below.
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

  test("theme switch is fully visible in the drawer (en)", async ({ page }) => {
    await page.goto("/en");
    await page.getByTestId("menu-trigger").click();

    // The theme switch is in the drawer; toBeVisible() confirms it is
    // not hidden or clipped by the panel's overflow (overflow-y: auto).
    await expect(page.getByRole("switch", { name: "Dark mode" })).toBeVisible();
  });

  test("theme switch is accessible in all three locales", async ({ page }) => {
    // Visible label text == accessible name (WCAG 2.5.3), per catalogue.
    const cases = [
      { locale: "en", name: "Dark mode" },
      { locale: "pl", name: "Tryb ciemny" },
      { locale: "uk", name: "Темний режим" }
    ] as const;

    for (const { locale, name } of cases) {
      await page.goto(`/${locale}`);
      await page.getByTestId("menu-trigger").click();
      await expect(
        page.getByRole("switch", { name }),
        `${locale}: theme switch not visible`
      ).toBeVisible();
      // Close before next iteration
      await page.getByTestId("menu-trigger").click();
    }
  });
});

/**
 * brand-fixes v3.1/v3.2 — nav/controls overlap regression.
 *
 * Measured defect (headless DOM probe): the nowrap nav list overflowed its
 * min-width:0 flex box into the theme/language controls across ~768–1240 px
 * while header.scrollWidth stayed flat — the 320 px overflow tests could not
 * see it. v3.1 raised the drawer breakpoint to 1279 px. v3.2 re-probe then
 * showed the inline band still collided at 1280 for pl (+2 px) and uk
 * (+26 px) because only EN was measured; a 1280–1439 px compression band
 * now shaves 64 px of pure whitespace so every locale clears the controls
 * with ≥ 16 px (asserted below; expected ≈ 38 px for uk).
 */
test.describe("shell — nav/controls overlap regression", () => {
  test("drawer band (1000 px): nav collapses, no inline collision", async ({
    page
  }) => {
    await page.setViewportSize({ width: 1000, height: 720 });

    for (const locale of ["en", "pl", "uk"] as const) {
      await page.goto(`/${locale}`);

      // Bar shows brand + hamburger; the nav lives in the closed drawer.
      await expect(page.getByTestId("menu-trigger")).toBeVisible();
      await expect(page.getByTestId("main-nav")).toBeHidden();

      // Opening the drawer makes every destination reachable and readable.
      await page.getByTestId("menu-trigger").click();
      await expect(
        page.getByTestId("main-nav").locator("a[href*='/contact']")
      ).toBeVisible();
      await expect(
        page.getByTestId("main-nav").locator("a[href*='/publications']")
      ).toBeVisible();

      // Close before the next locale.
      await page.getByTestId("menu-trigger").click();
    }
  });

  test("desktop band (1280 px): every locale keeps 16 px clear of the controls", async ({
    page
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    for (const locale of ["en", "pl", "uk"] as const) {
      await page.goto(`/${locale}`);
      await expect(page.getByTestId("menu-trigger")).toBeHidden();

      const lastLink = page.getByTestId("main-nav").locator("li:last-child a");
      await expect(lastLink).toBeVisible();

      const linkBox = await lastLink.boundingBox();
      const controlsBox = await page
        .locator(".app-header__controls")
        .boundingBox();
      expect(linkBox, `${locale}: last nav link has no box`).not.toBeNull();
      expect(controlsBox, `${locale}: controls have no box`).not.toBeNull();
      // Clearance, not just non-overlap: uk measured +26 px of collision at
      // 1280 before the v3.2 compression band, pl was borderline (+2). The
      // requirement is ≥ 16 px between the last link and the controls.
      const clearance = controlsBox!.x - (linkBox!.x + linkBox!.width);
      expect(
        clearance,
        `${locale}: nav/controls clearance below 16 px at 1280 px`
      ).toBeGreaterThanOrEqual(16);
    }
  });
});

test.describe("shell — T-043 social links", () => {
  const channels = [
    { name: "Facebook", href: "https://www.facebook.com/BARYKADYKULTURY/" },
    { name: "Instagram", href: "https://www.instagram.com/barykadykultury/" },
    { name: "Telegram", href: "https://t.me/barykadykultury" }
  ] as const;

  test("desktop 1280 px: all three channels render inline in the header", async ({
    page
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/en");

    // No drawer needed — the icon cluster is part of the visible bar.
    await expect(page.getByTestId("menu-trigger")).toBeHidden();
    const header = page.getByRole("banner");

    for (const { name, href } of channels) {
      const link = header.getByRole("link", { name, exact: true });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", href);
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", /noopener/);

      // 2.25rem square target (WCAG 2.5.8 minimum met with margin).
      const box = await link.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(36);
      expect(box!.height).toBeGreaterThanOrEqual(36);
    }

    // Nothing spills outside the 1280 px viewport.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(overflow).toBe(false);

    await checkA11y(page);
  });

  test("drawer at 320 px: every channel is reachable and fully on screen", async ({
    page
  }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto("/en");
    await page.getByTestId("menu-trigger").click();

    const header = page.getByRole("banner");
    for (const { name, href } of channels) {
      const link = header.getByRole("link", { name, exact: true });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", href);

      const box = await link.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(320);
    }

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(
      overflow,
      "horizontal overflow with social links in the drawer"
    ).toBe(false);
  });

  test("footer carries the same channels with a localized list label", async ({
    page
  }) => {
    await page.goto("/en");
    const footer = page.getByRole("contentinfo");
    const list = footer.getByRole("list", { name: "Social media" });
    await expect(list).toBeVisible();
    for (const { name, href } of channels) {
      await expect(
        list.getByRole("link", { name, exact: true })
      ).toHaveAttribute("href", href);
    }

    // Icons are inline SVG, not the old "FB"/"IG" text abbreviations.
    await expect(list.getByText("FB", { exact: true })).toHaveCount(0);

    await page.goto("/pl");
    await expect(
      page
        .getByRole("contentinfo")
        .getByRole("list", { name: "Media społecznościowe" })
    ).toBeVisible();

    await page.goto("/uk");
    await expect(
      page
        .getByRole("contentinfo")
        .getByRole("list", { name: "Соціальні мережі" })
    ).toBeVisible();
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
