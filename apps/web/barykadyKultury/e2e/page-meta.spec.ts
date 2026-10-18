import { expect, type Page } from "@playwright/test";

import { test } from "./support/network-guard";

/**
 * T-011 follow-up defect regression (2026-10-18): every real destination must
 * set its own localized document title/description, never the 404 metadata.
 *
 * The unit gate iterates the route table; this E2E proves the *built* app sets
 * the title in a real browser for English and non-English locales.
 */
interface TitleCase {
  path: string;
  title: string;
}

const TITLE_CASES: TitleCase[] = [
  { path: "/en", title: "Barykady Kultury" },
  { path: "/en/contact", title: "Contact" },
  { path: "/en/about", title: "About us" },
  { path: "/en/about/team", title: "Team" },
  { path: "/en/about/documents", title: "Documents" },
  { path: "/en/support", title: "Support us" },
  { path: "/en/projects", title: "Projects" },
  { path: "/en/events", title: "Events" },
  { path: "/en/publications", title: "Publications" },
  // Non-English locale — proves the title is localized, not an English literal.
  { path: "/pl/contact", title: "Kontakt" },
  { path: "/pl/about", title: "O nas" },
  { path: "/pl/about/team", title: "Zespół" },
  { path: "/pl/about/documents", title: "Dokumenty" },
  { path: "/pl/support", title: "Wesprzyj nas" },
  { path: "/pl/events", title: "Wydarzenia" },
  { path: "/pl/publications", title: "Publikacje" },
  { path: "/uk/contact", title: "Контакти" }
];

function description(page: Page) {
  return page.locator('meta[name="description"]');
}

test.describe("page metadata", () => {
  test("every destination sets its localized document title", async ({
    page
  }) => {
    for (const { path, title } of TITLE_CASES) {
      await page.goto(path);

      await expect(page, `${path} title`).toHaveTitle(title);
      await expect(page, `${path} must not use the 404 title`).not.toHaveTitle(
        "Page not found"
      );
    }
  });

  test("the description follows the route and locale", async ({ page }) => {
    // The router guard applies metadata asynchronously, so these assertions
    // auto-wait (Playwright retries `toHaveAttribute`) rather than reading the
    // tag once after `goto` — the previous one-shot read raced the guard.
    await page.goto("/en/contact");
    await expect(description(page)).toHaveAttribute(
      "content",
      "Contact information for Barykady Kultury."
    );

    await page.goto("/pl/contact");
    await expect(description(page)).toHaveAttribute(
      "content",
      "Dane kontaktowe Barykad Kultury."
    );

    await page.goto("/uk/contact");
    await expect(description(page)).toHaveAttribute(
      "content",
      "Контактна інформація Barykady Kultury."
    );
  });
});
