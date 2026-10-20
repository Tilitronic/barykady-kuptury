import { expect, type Page } from "@playwright/test";

import { checkA11y } from "./support/a11y";
import { mockSupabaseRest } from "./support/mocks";
import { test } from "./support/network-guard";

/**
 * T-016 — About page E2E journeys.
 *
 * The About landing page is reachable from the public header and footer, shows
 * verified organization content in the expected heading order, and names the
 * source language when the requested translation is incomplete and English is
 * used as the fallback.
 *
 * Supabase REST is intercepted with deterministic fixtures; no E2E journey
 * depends on real database contents (docs/TESTING.md §2). The fixture body
 * intentionally mirrors only the key excerpts asserted here, avoiding drift
 * with the canonical seed text in `supabase/seed.sql`.
 */
const EN_BODY = `## Mission

To expand Ukrainian culture beyond borders and give it the space it deserves.

## History

The association was founded by Daria Yakovleva in Poznań.

## Values

- Identity
- Education
- Support
- Community

## Aims

The aims of the Association are:

- Cultural diplomacy: acting as a "cultural bridge" between Ukrainians, Poles, and the international community.
- Promotion and popularization of Ukrainian culture in Poland and worldwide.`;

const SITE_PAGES_FIXTURE = [
  {
    id: "00000000-0000-4000-8000-000000000101",
    page_key: "about",
    status: "published",
    updated_at: "2026-01-05T12:00:00Z",
    site_page_translations: [
      {
        locale: "en",
        title: "About us",
        body: EN_BODY,
        meta_description: "About the Barykady Kultury association.",
        needs_review: false
      },
      {
        locale: "pl",
        title: "O nas",
        body: null,
        meta_description: null,
        needs_review: true
      },
      {
        locale: "uk",
        title: "Про нас",
        body: null,
        meta_description: null,
        needs_review: true
      }
    ]
  }
];

async function gotoAbout(page: Page): Promise<void> {
  await mockSupabaseRest(page, {
    responses: { site_pages: SITE_PAGES_FIXTURE }
  });
}

test.describe("About page", () => {
  test("is reachable from the header navigation", async ({ page }) => {
    await gotoAbout(page);
    await page.goto("/en");

    const header = page.getByRole("banner");
    await header.getByRole("link", { name: "About us" }).click();

    await expect(page).toHaveURL(/\/en\/about$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "About us"
    );
  });

  test("is reachable from the footer navigation", async ({ page }) => {
    await gotoAbout(page);
    await page.goto("/en");

    const footer = page.getByRole("contentinfo");
    await footer.getByRole("link", { name: "About us" }).click();

    await expect(page).toHaveURL(/\/en\/about$/);
  });

  test("shows verified content in English with ordered sections", async ({
    page
  }) => {
    await gotoAbout(page);
    await page.goto("/en/about");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "About us"
    );

    // T-039 (D-25): one page — body sections + Team + Documents.
    const h2Texts = await page
      .getByRole("heading", { level: 2 })
      .allInnerTexts();
    expect(h2Texts).toEqual([
      "Mission",
      "History",
      "Values",
      "Aims",
      "Team",
      "Documents"
    ]);

    await expect(
      page.getByText("To expand Ukrainian culture beyond borders")
    ).toBeVisible();
    await expect(page.getByText("Daria Yakovleva")).toBeVisible();
    await expect(page.getByText("Identity")).toBeVisible();
    await expect(page.getByText("cultural bridge")).toBeVisible();

    // The sub-navigation is gone; the TOC carries the section anchors.
    expect(await page.locator(".about-page__subnav").count()).toBe(0);
    const toc = page.getByRole("navigation", { name: "On this page" });
    await expect(toc.getByRole("link", { name: "Mission" })).toHaveAttribute(
      "href",
      "#mission"
    );
    await expect(toc.getByRole("link", { name: "Documents" })).toHaveAttribute(
      "href",
      "#documents"
    );

    await checkA11y(page);
  });

  test("shows the fallback note in Polish and Ukrainian", async ({ page }) => {
    await gotoAbout(page);

    await page.goto("/pl/about");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "About us"
    );
    await expect(page.getByText("po angielsku")).toBeVisible();
    await expect(
      page.getByText("To expand Ukrainian culture beyond borders")
    ).toBeVisible();
    await checkA11y(page);

    await page.goto("/uk/about");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "About us"
    );
    await expect(page.getByText("англійською")).toBeVisible();
    await expect(
      page.getByText("To expand Ukrainian culture beyond borders")
    ).toBeVisible();
    await checkA11y(page);
  });

  test("the removed list routes redirect to the anchored sections (D-25)", async ({
    page
  }) => {
    await gotoAbout(page);

    await page.goto("/en/about/team");
    await expect(page).toHaveURL(/\/en\/about#team$/);
    await expect(
      page.getByRole("heading", { level: 2, name: "Team" })
    ).toBeVisible();

    await page.goto("/pl/about/documents");
    await expect(page).toHaveURL(/\/pl\/about#documents$/);
    await expect(
      page.getByRole("heading", { level: 2, name: "Dokumenty" })
    ).toBeVisible();
  });

  test("a deep link focuses the section heading after data loads", async ({
    page
  }) => {
    await gotoAbout(page);

    await page.goto("/en/about#aims");

    // The heading of the target section owns focus (not just the scroll).
    const aimsHeading = page.getByRole("heading", { level: 2, name: "Aims" });
    await expect(aimsHeading).toBeVisible();
    await expect(aimsHeading).toBeFocused();
  });
});
