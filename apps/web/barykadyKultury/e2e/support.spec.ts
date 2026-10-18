import { expect, type Page } from "@playwright/test";

import { checkA11y } from "./support/a11y";
import { test } from "./support/network-guard";

/**
 * T-022 — Support page.
 *
 * D-06 is OPEN: no support destinations are configured, so the application
 * ships the translated empty state with the truthful no-payment statement and
 * nothing invented. The configured matrix (ordering, primary hierarchy,
 * link safety) is proven at component level in
 * `src/pages/[locale]/__tests__/support.test.ts` — per the T-021 review there
 * is deliberately no runtime test seam to fake config in E2E; these journeys
 * will self-close the loop once real data lands in `src/config/support.ts`.
 */

/** The page must pass axe with zero critical *and* zero serious findings. */
async function expectNoBlockingViolations(page: Page): Promise<void> {
  const results = await checkA11y(page);
  const blocking = results.violations.filter(
    violation =>
      violation.impact === "critical" || violation.impact === "serious"
  );

  expect(
    blocking,
    `axe found ${blocking.length} critical/serious violation(s): ${blocking
      .map(violation => violation.id)
      .join(", ")}`
  ).toHaveLength(0);
}

test.describe("support page", () => {
  test("shows the translated empty state with no invented actions or payment UI", async ({
    page
  }) => {
    await page.goto("/en/support");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Support us"
    );
    await expect(
      page.getByText(
        "Ways to support the association are being prepared. Please check back later."
      )
    ).toBeVisible();
    await expect(
      page.getByText(/We do not process card payments on this website/)
    ).toBeVisible();

    // Nothing fabricated: no actions, no bank block, no external links.
    await expect(page.locator(".action-link")).toHaveCount(0);
    await expect(page.locator(".support-bank")).toHaveCount(0);
    await expect(page.locator(".support-page a[href^='http']")).toHaveCount(0);

    // No payment collection anywhere (acceptance criterion).
    await expect(page.locator("form")).toHaveCount(0);
    await expect(page.locator("iframe")).toHaveCount(0);

    await expectNoBlockingViolations(page);
  });

  test("shows the empty state translated into Polish", async ({ page }) => {
    await page.goto("/pl/support");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Wesprzyj nas"
    );
    await expect(page.getByText(/Formy wsparcia stowarzyszenia/)).toBeVisible();
    await expect(
      page.getByText(/Nie przetwarzamy płatności kartowych/)
    ).toBeVisible();
    await expect(page.getByText("Ways to support the association")).toHaveCount(
      0
    );
  });

  test("the empty state and no-payment statement fit the first 360×640 viewport", async ({
    page
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto("/en/support");

    const message = page.locator(".support-page__empty");
    await expect(message).toBeVisible();

    const statement = page.locator(".support-page__no-payment");
    await expect(statement).toBeVisible();
    const box = await statement.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThan(640);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(overflow).toBe(false);

    await expectNoBlockingViolations(page);
  });
});
