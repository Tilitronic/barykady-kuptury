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

  // T-043 — labeled social block beside the contact channels: verified URLs
  // only, visible platform names, new-tab hardening, localized heading.
  test("shows the Follow us block with the three verified channels", async ({
    page
  }) => {
    await page.goto("/en/contact");

    const followUs = page.getByRole("heading", {
      level: 2,
      name: "Follow us"
    });
    await expect(followUs).toBeVisible();

    const links = page.locator(".contact-page .social-links--labeled a");
    await expect(links).toHaveCount(3);
    await expect(links.nth(0)).toHaveAttribute(
      "href",
      "https://www.facebook.com/BARYKADYKULTURY/"
    );
    await expect(links.nth(1)).toHaveAttribute(
      "href",
      "https://www.instagram.com/barykadykultury/"
    );
    await expect(links.nth(2)).toHaveAttribute(
      "href",
      "https://t.me/barykadykultury"
    );

    for (const i of [0, 1, 2]) {
      await expect(links.nth(i)).toHaveAttribute("target", "_blank");
      await expect(links.nth(i)).toHaveAttribute("rel", /noopener/);
    }

    // Visible names (labeled variant), not just aria-labels.
    await expect(
      page.locator(".contact-page .social-links--labeled").getByText("Telegram")
    ).toBeVisible();

    await expectNoBlockingViolations(page);
  });

  test("localizes the Follow us heading", async ({ page }) => {
    await page.goto("/pl/contact");
    await expect(
      page.getByRole("heading", { level: 2, name: "Obserwuj nas" })
    ).toBeVisible();

    await page.goto("/uk/contact");
    await expect(
      page.getByRole("heading", { level: 2, name: "Підписуйтесь на нас" })
    ).toBeVisible();
  });
});
