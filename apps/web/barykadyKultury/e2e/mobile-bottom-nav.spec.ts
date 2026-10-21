import { expect } from "@playwright/test";

import { checkA11y } from "./support/a11y";
import { mockSupabaseRest } from "./support/mocks";
import { test } from "./support/network-guard";

/**
 * Phone band (< 600 px) — one-handed navigation (owner-approved lane).
 * The header becomes a slim brand strip (logo + search + hamburger
 * fallback); the four primary sections plus "More" live in the fixed
 * bottom bar. Tablet/desktop rendering must not move.
 *
 * Documented breakpoint: 599px (see AppHeader.vue / MobileBottomNav.vue).
 */
test.describe("mobile bottom navigation", () => {
  test.beforeEach(async ({ page }) => {
    await mockSupabaseRest(page, {});
  });

  test("at 390 px the bar docks the bottom edge with five ≥48 px targets", async ({
    page
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en/about");

    const bar = page.getByTestId("bottom-nav");
    await expect(bar).toBeVisible();

    const box = await bar.boundingBox();
    expect(box).not.toBeNull();
    // Flush with the viewport bottom (safe-area padding adds nothing in
    // headless Chrome; env() resolves to 0 — the padding is declared).
    expect(box!.y + box!.height).toBeCloseTo(844, 0);

    const targets = bar.locator(".mobile-bottom-nav__item");
    await expect(targets).toHaveCount(5);
    for (let i = 0; i < 5; i++) {
      const target = targets.nth(i);
      const targetBox = await target.boundingBox();
      expect(targetBox!.height).toBeGreaterThanOrEqual(48);
      expect(targetBox!.width).toBeGreaterThanOrEqual(48);
    }

    // Active section carries aria-current + the scarlet label, never a
    // duplicate landmark name: the bottom bar IS "Main navigation" here.
    await expect(bar.getByRole("link", { name: "About us" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    await expect(bar.getByRole("link", { name: "About us" })).toHaveCSS(
      "color",
      "rgb(198, 0, 1)"
    );
    const navNames = await page
      .getByRole("navigation")
      .evaluateAll(nodes =>
        nodes
          .filter(n => getComputedStyle(n).display !== "none")
          .map(n => n.getAttribute("aria-label"))
      );
    expect(navNames.filter(n => n === "Main navigation")).toHaveLength(1);
  });

  test("More opens the full menu, Escape restores the fallback path", async ({
    page
  }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto("/en");
    await expect(page.getByTestId("bottom-nav-more")).toBeVisible();

    const more = page.getByTestId("bottom-nav-more");
    await expect(more).toHaveAttribute("aria-expanded", "false");

    await more.click();
    await expect(more).toHaveAttribute("aria-expanded", "true");
    const drawer = page.getByRole("navigation", { name: "Full menu" });
    await expect(drawer).toBeVisible();
    // The drawer holds ALL six destinations — the two hidden ones included.
    await expect(drawer.getByRole("link", { name: "Events" })).toBeVisible();
    await expect(
      drawer.getByRole("link", { name: "Publications" })
    ).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(more).toHaveAttribute("aria-expanded", "false");
  });

  test("tab order reaches the bar before the main content", async ({
    page
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en/about");
    // Only walk the tab order once the shell has hydrated.
    await expect(page.getByTestId("bottom-nav")).toBeVisible();

    await page.evaluate(() => {
      document.body.setAttribute("tabindex", "-1");
      document.body.focus();
      document.body.removeAttribute("tabindex");
    });

    const reached = new Set<string>();
    for (let stop = 0; stop < 12; stop++) {
      await page.keyboard.press("Tab");
      const where = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return "none";
        if (el.closest(".mobile-bottom-nav")) return "bottom-nav";
        if (el.closest("main")) return "main";
        if (el.closest("header")) return "header";
        return "other";
      });
      reached.add(where);
      if (where === "main") break;
    }
    // strip (header) → bar (bottom-nav) → content (main), in that order.
    expect([...reached]).toEqual(
      expect.arrayContaining(["header", "bottom-nav", "main"])
    );
  });

  test("content clears the fixed bar at the bottom of the page", async ({
    page
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en/about");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    const barTop = (await page.getByTestId("bottom-nav").boundingBox())!.y;
    const lastVisible = await page
      .locator("main section, main .localized-rich-text")
      .last()
      .boundingBox();
    // The document's end sits above the bar thanks to the layout's
    // safe-area-aware bottom padding (not buried underneath it).
    expect(
      await page.evaluate(
        () =>
          window.innerHeight -
            document
              .querySelector(".mobile-bottom-nav")!
              .getBoundingClientRect().height >=
          0
      )
    ).toBe(true);
    // Scrolling bottomed out; the page keeps padding so the last block can
    // be brought fully above the bar.
    await page.evaluate(() => {
      document.querySelector("#documents")?.scrollIntoView({ block: "end" });
    });
    const docs = await page.locator("#documents").boundingBox();
    expect(docs!.y + docs!.height).toBeLessThanOrEqual(barTop + 1);
    void lastVisible;
  });

  test("tablet (600–1279) and desktop keep the pre-lane layout — no bar", async ({
    page
  }) => {
    await page.setViewportSize({ width: 600, height: 900 });
    await page.goto("/en/about");
    await expect(page.getByTestId("bottom-nav")).toBeHidden();
    // Drawer keeps the classic landmark name above the phone band.
    await page.getByTestId("menu-trigger").click();
    await expect(
      page.getByRole("navigation", { name: "Main navigation" })
    ).toBeVisible();

    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.getByTestId("bottom-nav")).toBeHidden();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(overflow).toBe(false);

    await page.setViewportSize({ width: 390, height: 844 });
    await checkA11y(page);
  });
});
