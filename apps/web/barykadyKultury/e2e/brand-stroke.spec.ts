import { expect, type Page } from "@playwright/test";

import { mockSupabaseRest } from "./support/mocks";
import { test } from "./support/network-guard";

/**
 * Brand-stroke consistency: the scarlet underline marking the active page in
 * the header nav must equal the thickness of the left stem of the "B" in the
 * logotype. Both derive from ONE token chain in tokens.css:
 *   --nav-active-stroke = --brand-logo-height-md (48px) x stem ratio 0.108
 * (ratio measured in Chromium from logotype_*_web.svg: 108px stem at 1000px
 * render height). Measured here in both themes and the drawer band so the
 * wiring cannot rot at a breakpoint nobody looks at.
 */
// The token computes to 48 x 0.108 = 5.184px; Chromium rounds border
// layout to integer device pixels (5px at DPR 1, 10px at DPR 2), so the
// assertions allow one layout pixel of rounding, not a re-derived value.
const EXPECTED_STROKE = 48 * 0.108;
const STROKE_TOLERANCE = 0.6;

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
        body: "## Mission\n\nExpand culture.",
        meta_description: null,
        needs_review: false
      }
    ]
  }
];

function activeLink(page: Page) {
  return page.locator(".app-header__nav-link[aria-current='page']");
}

async function strokeWidth(
  page: Page,
  property: "borderBottom" | "borderLeft"
) {
  return activeLink(page).evaluate(
    (element, prop) =>
      Number.parseFloat(
        getComputedStyle(element)[
          prop === "borderBottom" ? "borderBottomWidth" : "borderLeftWidth"
        ]
      ),
    property
  );
}

test.describe("active nav underline equals the logo B stem", () => {
  test.beforeEach(async ({ page }) => {
    await mockSupabaseRest(page, {
      responses: { site_pages: SITE_PAGES_FIXTURE }
    });
  });

  test("desktop inline band, light AND dark theme (1440 px)", async ({
    page
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/en/about");

    await expect(activeLink(page)).toBeVisible();
    const light = await strokeWidth(page, "borderBottom");
    expect(light).toBeGreaterThanOrEqual(EXPECTED_STROKE - STROKE_TOLERANCE);
    expect(light).toBeLessThanOrEqual(EXPECTED_STROKE + STROKE_TOLERANCE);

    await page.getByRole("switch", { name: "Dark mode" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const dark = await strokeWidth(page, "borderBottom");
    expect(dark).toBeGreaterThanOrEqual(EXPECTED_STROKE - STROKE_TOLERANCE);
    expect(dark).toBeLessThanOrEqual(EXPECTED_STROKE + STROKE_TOLERANCE);
  });

  test("compression band (1280 px) keeps the same stroke", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/en/about");

    const width = await strokeWidth(page, "borderBottom");
    expect(width).toBeGreaterThanOrEqual(EXPECTED_STROKE - STROKE_TOLERANCE);
    expect(width).toBeLessThanOrEqual(EXPECTED_STROKE + STROKE_TOLERANCE);
  });

  test("drawer band uses the token for the active vertical rule too", async ({
    page
  }) => {
    await page.setViewportSize({ width: 900, height: 800 });
    await page.goto("/en/about");

    await page.getByTestId("menu-trigger").click();
    await expect(activeLink(page).first()).toBeVisible();

    const width = await strokeWidth(page, "borderLeft");
    expect(width).toBeGreaterThanOrEqual(EXPECTED_STROKE - STROKE_TOLERANCE);
    expect(width).toBeLessThanOrEqual(EXPECTED_STROKE + STROKE_TOLERANCE);
  });
});
