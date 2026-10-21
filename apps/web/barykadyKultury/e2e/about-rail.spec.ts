import { expect, type Page } from "@playwright/test";

import { checkA11y } from "./support/a11y";
import { mockSupabaseRest } from "./support/mocks";
import { test } from "./support/network-guard";

/**
 * About side rail — the Vue-docs layout pattern (header lane fix).
 *
 * Contract under test:
 *  - at wide viewports the TOC docks to the viewport's LEFT EDGE inside a
 *    full-bleed grid, and the centered content column keeps its max width
 *    (the rail never shifts or narrows it — the h1 and the body share one
 *    left edge);
 *  - the rail is sticky under the site header and the IntersectionObserver
 *    scroll spy moves `aria-current="location"` as sections pass the band,
 *    without resizing the rail (no layout shift on active change);
 *  - at 320 px the rail collapses to the disclosure above the content with
 *    no horizontal overflow;
 *  - reduced-motion users still get working, focused anchor activation.
 *
 * Fixtures mirror e2e/about.spec.ts (mocked Supabase only, docs/TESTING.md §2).
 */
const RAIL_BODY = `## Mission

To expand Ukrainian culture beyond borders and give it the space it deserves.

Barykady Kultury organizes concerts, workshops and publications across Poznań
and beyond, building a cultural bridge between Ukrainian and Polish worlds.

## History

The association was founded by Daria Yakovleva in Poznań.

Early gatherings grew into a standing program of events, and the program kept
expanding year after year with volunteers from three countries.

## Values

- Identity
- Education
- Support
- Community

These values guide every project, every publication and every partnership the
association signs up for.

## Aims

The aims of the Association are:

- Cultural diplomacy: acting as a "cultural bridge" between Ukrainians, Poles,
  and the international community.
- Promotion and popularization of Ukrainian culture in Poland and worldwide.
- Education about Ukrainian heritage through events, translations and meetings.
- Support for Ukrainian artists working in exile.`;

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
        body: RAIL_BODY,
        meta_description: "About the Barykady Kultury association.",
        needs_review: false
      }
    ]
  }
];

async function gotoAbout(page: Page): Promise<void> {
  await mockSupabaseRest(page, {
    responses: { site_pages: SITE_PAGES_FIXTURE }
  });
  await page.goto("/en/about");
  await expect(
    page.getByRole("heading", { level: 1, name: "About us" })
  ).toBeVisible();
}

function rail(page: Page) {
  return page.getByRole("navigation", { name: "On this page" });
}

test.describe("About side rail — edge dock and centering", () => {
  /**
   * Owner screenshot fix: the docked rail is for ALL desktop widths (≥ 1024).
   * The in-flow column that used to live at 1024–1439 put the panel flush
   * against the text and away from the page edge — exactly the complaint.
   */
  const widths = [1024, 1240, 1280, 1440, 1600] as const;

  for (const width of widths) {
    test(`docks at the viewport edge and centers the column at ${width} px`, async ({
      page
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await gotoAbout(page);

      const railBox = await rail(page).boundingBox();
      const column = page.locator(".about-page__column");
      const columnBox = await column.boundingBox();
      const titleBox = await page
        .getByRole("heading", { level: 1 })
        .boundingBox();
      const missionBox = await page.locator("section#mission").boundingBox();

      expect(railBox, "rail renders at the edge, not in-flow").not.toBeNull();
      // Edge-docked: 1rem bleed padding + 1px border off the viewport edge.
      expect(railBox!.x).toBeLessThanOrEqual(20);
      // Never overlaps the reading column.
      expect(railBox!.x + railBox!.width).toBeLessThan(columnBox!.x);
      // The heading is the column's: identical left edge with the body.
      expect(Math.abs(titleBox!.x - missionBox!.x)).toBeLessThanOrEqual(2);
      // The column is viewport-centered; the rail never shifts it.
      expect(
        Math.abs(columnBox!.x + columnBox!.width / 2 - width / 2)
      ).toBeLessThanOrEqual(4);
      // Column max width unchanged: it cannot exceed the shell's 72rem.
      expect(columnBox!.width).toBeLessThanOrEqual(1152 + 1);
    });
  }

  test("the rail skin is theme-adaptive and states are token-driven", async ({
    page
  }) => {
    await page.setViewportSize({ width: 1240, height: 900 });
    await gotoAbout(page);

    const panel = page.getByRole("navigation", { name: "On this page" });
    const aims = panel.getByRole("link", { name: "Aims" });

    // Light theme: light surface panel + dark-muted text. The idle color is
    // read on Aims — at the page top the scroll spy legitimately activates
    // Mission (red text), and racing that was the old flake.
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(panel).toHaveCSS("background-color", "rgb(250, 250, 250)");
    await expect(aims).toHaveCSS("color", "rgb(108, 106, 106)");

    // Hover: light scarlet wash (token-derived), red text — no underline,
    // no side bar; the WHOLE row highlights, including beside the label.
    await aims.hover({ position: { x: 3, y: 5 } });
    await expect(aims).toHaveCSS("color", "rgb(198, 0, 1)");
    const tint = await aims.evaluate(
      el => getComputedStyle(el).backgroundColor
    );
    expect(tint).not.toBe("rgba(0, 0, 0, 0)");

    // Active: RED TEXT ONLY — no side bar, no underline, and (per the rail
    // contract) no fill either: the tint belongs to hover, the location
    // state to the color. The accent also lives in the DOM via
    // aria-current="location".
    await page.evaluate(() => {
      document.getElementById("history")?.scrollIntoView({ block: "start" });
    });
    const history = panel.getByRole("link", { name: "History" });
    await expect(history).toHaveAttribute("aria-current", "location");
    await expect(history).toHaveCSS("color", "rgb(198, 0, 1)");
    await expect(history).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");

    // Dark theme: the same tokens flip — dark surface, light text. At this
    // width the header controls live in the drawer — open it first.
    await page.getByTestId("menu-trigger").click();
    await page.getByRole("switch", { name: "Dark mode" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(panel).toHaveCSS("background-color", "rgb(53, 51, 51)");
    await expect(aims).toHaveCSS("color", "rgb(158, 158, 158)");
    await expect(history).toHaveCSS("color", "rgb(255, 109, 90)"); // --color-link dark

    await checkA11y(page);
  });

  test("rows are full-width hit zones: clicking beside the label activates", async ({
    page
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoAbout(page);

    const aims = page
      .getByRole("navigation", { name: "On this page" })
      .getByRole("link", { name: "Aims" });
    const box = await aims.boundingBox();
    expect(box).not.toBeNull();
    const listWidth = await aims.evaluate(
      el => el.closest("ul")!.getBoundingClientRect().width
    );
    // QItem rows span the FULL list width — the hit zone reaches both ends.
    expect(Math.abs(box!.width - listWidth)).toBeLessThanOrEqual(1);

    // Click in the empty strip at the row's left edge — still navigates and
    // focuses the section heading.
    await aims.click({ position: { x: 3, y: Math.floor(box!.height / 2) } });
    await expect(
      page.getByRole("heading", { level: 2, name: "Aims" })
    ).toBeFocused();
    await expect(aims).toHaveAttribute("aria-current", "location");
  });
});

test.describe("About side rail — sticky and scroll spy", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("sticks under the header, tracks the active section, shifts no layout", async ({
    page
  }) => {
    await gotoAbout(page);

    const valuesLink = rail(page).getByRole("link", { name: "Values" });
    const before = await rail(page).boundingBox();
    expect(before).not.toBeNull();

    // Landing #values puts its heading in the spy band under the header
    // (scroll-margin-top 5rem = 80px; the spy band starts at 88px).
    await page.evaluate(() => {
      document.getElementById("values")?.scrollIntoView({ block: "start" });
    });
    await expect(valuesLink).toHaveAttribute("aria-current", "location");

    const during = await rail(page).boundingBox();
    // Sticky below the 3.75rem header, inside the 5rem offset.
    expect(during!.y).toBeGreaterThanOrEqual(60);
    expect(during!.y).toBeLessThanOrEqual(88);
    // No layout shift when the active link changes: same box, only position moves.
    expect(during!.width).toBeCloseTo(before!.width, 0);
    expect(during!.height).toBeCloseTo(before!.height, 0);

    await page.evaluate(() => {
      document.getElementById("aims")?.scrollIntoView({ block: "start" });
    });
    await expect(
      rail(page).getByRole("link", { name: "Aims" })
    ).toHaveAttribute("aria-current", "location");

    // Clicking a rail link still lands and focuses the heading.
    await rail(page).getByRole("link", { name: "Mission" }).click();
    await expect(
      page.getByRole("heading", { level: 2, name: "Mission" })
    ).toBeFocused();
  });

  test("the LAST rail item activates on click and at the page bottom", async ({
    page
  }) => {
    await gotoAbout(page);

    // Optimistic: the accent moves with the click, not after the scroll.
    const documents = rail(page).getByRole("link", { name: "Documents" });
    await documents.click();
    await expect(documents).toHaveAttribute("aria-current", "location");

    // And a plain scroll to the absolute bottom lands on the last item —
    // the short Documents section never fills the observer band otherwise.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(documents).toHaveAttribute("aria-current", "location");

    // Scrolling back to the very top leaves the bottom shortcut: the
    // last item loses the accent (the band takes over with real sections).
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(documents).not.toHaveAttribute("aria-current", "location");
  });

  test("reduced motion: activation lands with focus, never a crash", async ({
    page
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await gotoAbout(page);

    await rail(page).getByRole("link", { name: "Aims" }).click();
    await expect(
      page.getByRole("heading", { level: 2, name: "Aims" })
    ).toBeFocused();
  });
});

test.describe("About side rail — 320 px fallback", () => {
  test.use({ viewport: { width: 320, height: 640 } });

  test("collapses to the disclosure above the content without horizontal overflow", async ({
    page
  }) => {
    await gotoAbout(page);

    const summary = page.locator(".page-toc__summary");
    await expect(summary).toBeVisible();
    await expect(page.locator(".page-toc__desktop")).toBeHidden();

    await summary.click();
    await expect(
      page.locator(".page-toc__mobile").getByRole("link", { name: "Values" })
    ).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(overflow, "no horizontal overflow at 320 px").toBe(false);

    await checkA11y(page);
  });
});
