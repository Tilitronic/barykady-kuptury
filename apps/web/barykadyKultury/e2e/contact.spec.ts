import { expect, type Page } from "@playwright/test";

import { checkA11y } from "./support/a11y";
import { test } from "./support/network-guard";

/**
 * T-021 — Contact page (docs/tickets/T-021-contact-page.md).
 *
 * No verified contact data exists yet (D-04 open), so the shipped state is the
 * translated "not published yet" message with in-page routes — nothing
 * fabricated, no form (D-09). The configured-rendering branch (mailto:/tel:
 * links) is proven at component level in
 * `src/components/contact/__tests__/ContactChannels.test.ts`; these journeys
 * cover the state the application actually ships today. No real service is
 * contacted (docs/TESTING.md §2).
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

test.describe("contact page", () => {
  test("shows the translated empty state with no fabricated channels or form", async ({
    page
  }) => {
    await page.goto("/en/contact");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Contact");
    await expect(
      page.getByText("Contact details have not been published yet.")
    ).toBeVisible();

    // In-page routes stand in for the missing channels. Scope to the page body:
    // header and footer navigation also contain "About us"/"Support us".
    const pageBody = page.locator(".contact-page");
    await expect(
      pageBody.getByRole("link", { name: "About us" })
    ).toHaveAttribute("href", "/en/about");
    await expect(
      pageBody.getByRole("link", { name: "Support us" })
    ).toHaveAttribute("href", "/en/support");

    // Nothing invented: no channels, no form (D-04, D-09).
    await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);
    await expect(page.locator('a[href^="tel:"]')).toHaveCount(0);
    await expect(page.locator("address")).toHaveCount(0);
    await expect(page.locator("form")).toHaveCount(0);

    await expectNoBlockingViolations(page);
  });

  test("localizes the empty state", async ({ page }) => {
    await page.goto("/uk/contact");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Контакти"
    );
    await expect(
      page.getByText("Контактні дані ще не опубліковано.")
    ).toBeVisible();
  });
});
