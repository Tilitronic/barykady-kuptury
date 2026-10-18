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

async function descriptionOf(page: Page): Promise<string | null> {
  return page.locator('meta[name="description"]').getAttribute("content");
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
    await page.goto("/en/contact");
    expect(await descriptionOf(page)).toBe(
      "Contact information for Barykady Kultury."
    );

    await page.goto("/pl/contact");
    expect(await descriptionOf(page)).toBe("Dane kontaktowe Barykad Kultury.");

    await page.goto("/uk/contact");
    expect(await descriptionOf(page)).toBe(
      "Контактна інформація Barykady Kultury."
    );
  });
});
