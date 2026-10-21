import { expect, type Page } from "@playwright/test";

import { test } from "./support/network-guard";
import { checkA11y } from "./support/a11y";
import {
  mockCalendarEvents,
  mockSearchRpc,
  mockSupabaseRest,
  type SearchRpcRowFixture
} from "./support/mocks";
import { CALENDAR_EVENTS_FIXTURE } from "./fixtures/calendar-events";

/**
 * T-039 search-UI lane — header search journeys (D-26).
 *
 * Two sources at once: instant Navigation rows (static registry, no network)
 * above debounced Content rows (RPC + calendar). Everything runs against the
 * existing mocked seams; no live Supabase or Google Calendar
 * (docs/TESTING.md §2).
 */

const SEARCH_ROWS: SearchRpcRowFixture[] = [
  {
    kind: "document",
    entity_id: "d1",
    title: "Regulations of the Ordinary Association",
    excerpt: "Membership rules of the association.",
    slug: "regulations",
    page_key: null,
    rank: 3
  },
  {
    kind: "project",
    entity_id: "p1",
    title: "Sample Community Workshop",
    excerpt: "A recurring open workshop series.",
    slug: "sample-community-workshop",
    page_key: null,
    rank: 2
  },
  {
    kind: "publication",
    entity_id: "pub1",
    title: "Annual Cultural Report",
    excerpt: "The association's year in review.",
    slug: "annual-report",
    page_key: null,
    rank: 2
  },
  {
    kind: "team",
    entity_id: "t1",
    title: "Anna Kowalska",
    excerpt: "Chair of the board.",
    slug: null,
    page_key: null,
    rank: 1
  }
];

async function openSearch(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Search the site" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

async function typeQuery(page: Page, text: string): Promise<void> {
  await page.getByRole("combobox").fill(text);
}

test.describe("site search", () => {
  test.beforeEach(async ({ page }) => {
    // The publications table answers the header's years query (T-039 review:
    // real years, never invented) as well as any list reads.
    await mockSupabaseRest(page, {
      responses: { publications: [{ publication_date: "2026-02-01" }] }
    });
    await mockSearchRpc(page, { rows: SEARCH_ROWS });
    await mockCalendarEvents(page, { events: CALENDAR_EVENTS_FIXTURE });
  });

  test("navigation results render first and are instant", async ({ page }) => {
    await page.goto("/en");
    await openSearch(page);
    await typeQuery(page, "about");

    const nav = page.getByTestId("search-section-navigation");
    await expect(nav.getByRole("option").first()).toBeVisible();
    await expect(nav.getByText("About us")).toBeVisible();

    // DOM order is the contract: Navigation before Content.
    const order = await page.evaluate(() => {
      const groups = [
        ...document.querySelectorAll("[data-testid^='search-section-']")
      ];
      return groups.map(g => g.getAttribute("data-testid"));
    });
    expect(order).toEqual([
      "search-section-navigation",
      "search-section-content"
    ]);

    // Type badge is text, never color alone.
    await expect(
      nav.getByRole("option").first().getByText("Page")
    ).toBeVisible();

    await checkA11y(page);
  });

  test("content results link to document, project, publication and team", async ({
    page
  }) => {
    await page.goto("/en");
    await openSearch(page);
    await typeQuery(page, "report");

    const content = page.getByTestId("search-section-content");
    await expect(content.getByText("Annual Cultural Report")).toBeVisible();
    await expect(content.getByText("Document")).toBeVisible();
    await expect(content.getByText("Team member")).toBeVisible();

    // Document row opens the reader; team rows open the anchored section.
    await content
      .getByRole("option", { name: /Regulations of the Ordinary Association/ })
      .click();
    await expect(page).toHaveURL(/\/en\/about\/documents\/regulations$/);

    await page.goto("/en");
    await openSearch(page);
    await typeQuery(page, "anna");
    await page.getByRole("option", { name: /Anna Kowalska/ }).click();
    await expect(page).toHaveURL(/\/en\/about#team$/);
  });

  test("events come from the calendar feed", async ({ page }) => {
    await page.goto("/en");
    await openSearch(page);
    await typeQuery(page, "timed");

    const content = page.getByTestId("search-section-content");
    await expect(content.getByText("Sample timed event")).toBeVisible();
    await expect(
      content.getByTestId("search-kind").filter({ hasText: "Event" })
    ).toBeVisible();
  });

  test("the chip auto-sets from the route and filters the sources", async ({
    page
  }) => {
    // Projects page → Projects chip pressed; RPC receives the kind filter.
    await page.goto("/en/projects");
    await openSearch(page);
    await expect(page.getByTestId("search-chip-projects")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await typeQuery(page, "sample");
    const content = page.getByTestId("search-section-content");
    await expect(content.getByText("Sample Community Workshop")).toBeVisible();
    await expect(content.getByText("Annual Cultural Report")).toHaveCount(0);

    // Publications page → Publications chip.
    await page.goto("/en/publications");
    await openSearch(page);
    await expect(page.getByTestId("search-chip-publications")).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    // Events page → Events chip: calendar rows only, no RPC kinds needed.
    await page.goto("/en/events");
    await openSearch(page);
    await expect(page.getByTestId("search-chip-events")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await typeQuery(page, "timed");
    await expect(
      page.getByTestId("search-section-content").getByText("Sample timed event")
    ).toBeVisible();
  });

  test("a user chip override replaces the route default", async ({ page }) => {
    await page.goto("/en/projects");
    await openSearch(page);

    await page.getByTestId("search-chip-all").click();
    await expect(page.getByTestId("search-chip-all")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(page.getByTestId("search-chip-projects")).toHaveAttribute(
      "aria-pressed",
      "false"
    );

    await typeQuery(page, "report");
    await expect(
      page
        .getByTestId("search-section-content")
        .getByText("Annual Cultural Report")
    ).toBeVisible();
  });

  test("content failure keeps navigation usable and offers retry", async ({
    page
  }) => {
    await mockSearchRpc(page, { fail: true });
    await page.goto("/en");
    await openSearch(page);
    await typeQuery(page, "about");

    await expect(
      page.getByTestId("search-section-navigation").getByText("About us")
    ).toBeVisible();
    await expect(
      page
        .getByTestId("search-section-content")
        .getByText("Content results are unavailable.")
    ).toBeVisible();
    await expect(
      page.getByTestId("search-section-content").getByRole("button", {
        name: "Try again"
      })
    ).toBeVisible();
  });

  test("keyboard-only: / opens, arrows traverse, Enter navigates, Esc restores focus", async ({
    page
  }) => {
    await page.goto("/en");

    // The shortcuts register when the header component mounts; wait for the
    // trigger to exist before pressing "/" (the SPA boots after `load`).
    await expect(
      page.getByRole("button", { name: "Search the site" })
    ).toBeAttached();

    await page.keyboard.press("/");
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("combobox")).toBeFocused();

    await page.keyboard.type("abo");
    await page.keyboard.press("ArrowDown");
    const activeId = await page
      .getByRole("combobox")
      .getAttribute("aria-activedescendant");
    expect(activeId).toBeTruthy();
    await expect(page.locator(`#${activeId}`)).toHaveAttribute(
      "aria-selected",
      "true"
    );

    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL(/\/en\/about/);

    // Esc path: reopen and close, focus returns to the trigger.
    await page.keyboard.press("Control+k");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Search the site" })
    ).toBeFocused();
  });

  test("stays usable at 320 px and a result closes the drawer (M1)", async ({
    page
  }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto("/en");

    // Open the drawer, trigger the search from inside it.
    await page.getByTestId("menu-trigger").click();
    await page.getByRole("button", { name: "Search the site" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.getByRole("combobox").fill("about");
    await expect(
      page.getByTestId("search-section-navigation").getByText("About us")
    ).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(overflow).toBe(false);

    await checkA11y(page);

    // Activate a result: navigation happens AND the drawer is gone over the
    // new page (it used to linger behind the dialog).
    await page
      .getByTestId("search-section-navigation")
      .getByRole("option", { name: /About us/ })
      .click();
    await expect(page).toHaveURL(/\/en\/about/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByTestId("menu-trigger")).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });

  test("homepage section results land and focus the section heading (C1)", async ({
    page
  }) => {
    await page.goto("/en");
    await openSearch(page);
    await typeQuery(page, "explore");

    const homeRow = page
      .getByTestId("search-section-navigation")
      .getByRole("option", { name: /Explore/ });
    await expect(homeRow).toBeVisible();
    await homeRow.click();

    await expect(page).toHaveURL(/\/en#explore$/);
    await expect(page.locator("section#explore h2")).toBeFocused();
  });

  test("publication years from the data appear as navigation results", async ({
    page
  }) => {
    // The years query hits the mocked publications table (2026 fixture rows).
    await page.goto("/en");
    await openSearch(page);
    await typeQuery(page, "2026");

    const yearRow = page
      .getByTestId("search-section-navigation")
      .getByRole("option", { name: /2026/ });
    await expect(yearRow).toBeVisible();
    await yearRow.click();
    await expect(page).toHaveURL(/\/en\/publications#2026$/);
  });

  // User-reported fix: the old absolute close button overlapped the input's
  // text at narrow widths. The field row is flex now — assert the bounding
  // boxes never intersect at 320 px and the button still closes the dialog.
  test("close button never overlaps the input at 320 px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto("/en");

    await page.getByTestId("menu-trigger").click();
    await page.getByRole("button", { name: "Search the site" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    const input = page.getByRole("combobox");
    const close = page.getByRole("button", { name: "Close search" });
    await expect(input).toBeVisible();
    await expect(close).toBeVisible();

    const inputBox = await input.boundingBox();
    const closeBox = await close.boundingBox();
    expect(inputBox, "input has no box").not.toBeNull();
    expect(closeBox, "close has no box").not.toBeNull();

    const overlaps =
      inputBox!.x < closeBox!.x + closeBox!.width &&
      closeBox!.x < inputBox!.x + inputBox!.width &&
      inputBox!.y < closeBox!.y + closeBox!.height &&
      closeBox!.y < inputBox!.y + inputBox!.height;
    expect(overlaps, "close button overlaps the input").toBe(false);
    // Side by side: a real gap, not just non-intersection.
    expect(closeBox!.x - (inputBox!.x + inputBox!.width)).toBeGreaterThan(0);

    // Focus order from the input: Tab reaches close, then the chips.
    await expect(input).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(close).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("search-chip-all")).toBeFocused();

    // And it closes on click.
    await close.click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await checkA11y(page);
  });
});

/**
 * Header lane fix: the icon trigger used to sit flush against the social
 * links with no visible name or tooltip. The full sentence stays the
 * accessible name; the short localized label rides on title + a Quasar
 * tooltip shown on hover and keyboard focus; a dedicated margin keeps the
 * icons separated.
 */
test.describe("search trigger naming, tooltip and spacing", () => {
  test("keyboard focus reveals the tooltip", async ({ page }) => {
    await mockSupabaseRest(page, {
      responses: { publications: [{ publication_date: "2026-02-01" }] }
    });
    await mockSearchRpc(page, { rows: [] });
    await mockCalendarEvents(page, { events: [] });

    await page.goto("/en");

    // Walk the tab order to the trigger: :focus-visible must come from a
    // real keyboard press for Quasar to arm the tooltip.
    const trigger = page.getByTestId("site-search-trigger");
    // The SPA header hydrates after DOMContentLoaded — measure only once the
    // trigger is actually in the document.
    await expect(trigger).toBeVisible();
    await page.evaluate(() => {
      document.body.setAttribute("tabindex", "-1");
      document.body.focus();
      document.body.removeAttribute("tabindex");
    });
    for (let stop = 0; stop < 15; stop++) {
      await page.keyboard.press("Tab");
      if (
        await page.evaluate(
          () =>
            document.activeElement?.getAttribute("data-testid") ===
            "site-search-trigger"
        )
      ) {
        break;
      }
    }
    await expect(trigger).toBeFocused();

    const tooltip = page.locator(".q-tooltip");
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toHaveText("Search");

    // Tabbing away closes it; the dialog still opens from the trigger.
    await page.keyboard.press("Tab");
    await expect(tooltip).toBeHidden();
  });

  test("the trigger keeps clear space from the social icons (desktop + 320 px drawer)", async ({
    page
  }) => {
    await mockSupabaseRest(page, {
      responses: { publications: [{ publication_date: "2026-02-01" }] }
    });
    await mockSearchRpc(page, { rows: [] });
    await mockCalendarEvents(page, { events: [] });

    const gap = async () =>
      page.evaluate(() => {
        const t = document
          .querySelector("[data-testid='site-search-trigger']")!
          .getBoundingClientRect();
        const s = document
          .querySelector(".social-links")!
          .getBoundingClientRect();
        return s.left - t.right;
      });

    await page.goto("/en");
    await expect(page.getByTestId("site-search-trigger")).toBeVisible();
    const desktopGap = await gap();
    expect(
      desktopGap,
      "trigger must not touch the social icons"
    ).toBeGreaterThanOrEqual(6);
    const box = await page.getByTestId("site-search-trigger").boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(24);
    expect(box!.height).toBeGreaterThanOrEqual(24);

    // 320 px (phone band): the trigger rides the slim header strip — no
    // drawer tap needed; it stays a ≥24 px target beside the hamburger.
    await page.setViewportSize({ width: 320, height: 640 });
    const trigger = page.getByTestId("site-search-trigger");
    await expect(trigger).toBeVisible();
    const stripBox = await trigger.boundingBox();
    expect(stripBox!.width).toBeGreaterThanOrEqual(24);
    expect(stripBox!.height).toBeGreaterThanOrEqual(24);
    const burgerBox = await page.getByTestId("menu-trigger").boundingBox();
    // Same strip: separated from the hamburger too.
    expect(burgerBox!.x).toBeGreaterThanOrEqual(
      stripBox!.x + stripBox!.width + 6
    );
  });
});
