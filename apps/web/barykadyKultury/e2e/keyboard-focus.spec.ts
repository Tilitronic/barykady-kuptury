import { expect } from "@playwright/test";

import {
  ADMIN_AUTH_USER,
  mockCalendarEvents,
  mockSupabaseAuth,
  mockSupabaseRest
} from "./support/mocks";
import {
  HOME_EVENTS,
  HOME_PAGE_FIXTURE,
  MOBILE_VIEWPORT,
  PROJECTS_FIXTURE,
  signInAsAdmin
} from "./support/journey-fixtures";
import {
  expectVisibleFocus,
  focusBody,
  tabUntilRole
} from "./support/journey-helpers";
import { createProjectStore, mockProjectApi } from "./support/project-store";
import { test } from "./support/network-guard";

/**
 * T-032 — keyboard-only journeys.
 *
 * docs/TESTING.md §2 journey 12 and the acceptance criterion are stricter than
 * "the elements are links": focus must be VISIBLE (WCAG 2.4.7) and must never
 * be trapped (WCAG 2.1.2). `expectVisibleFocus` checks the browser's
 * `:focus-visible` state plus a computed outline/box-shadow (or a Quasar
 * focused field), so a hidden caret cannot pass. All interaction is keyboard
 * only — no `.click()` on the journey path.
 */
test.describe("T-032 critical keyboard-only journeys", () => {
  test("public: skip link, visible focus, keyboard navigation, no trap", async ({
    page
  }) => {
    await mockCalendarEvents(page, { events: HOME_EVENTS });
    await mockSupabaseRest(page, {
      responses: {
        site_pages: HOME_PAGE_FIXTURE,
        projects: PROJECTS_FIXTURE,
        calendar_event_links: []
      }
    });

    await page.goto("/en");
    const skipLink = page.getByRole("link", { name: /skip to main content/i });
    await expect(skipLink).toBeVisible();

    // 1. First Tab stop is the skip link, with a visible focus ring.
    await focusBody(page);
    await page.keyboard.press("Tab");
    const skip = await expectVisibleFocus(page, "skip link");
    expect(skip.text).toMatch(/skip/i);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("main")).toBeFocused();

    // 2. Header navigation is reachable and visibly focused from the top.
    await page.reload();
    await expect(skipLink).toBeVisible();
    await focusBody(page);
    await page.keyboard.press("Tab"); // skip link
    await page.keyboard.press("Tab"); // brand
    const brand = await expectVisibleFocus(page, "brand link");
    expect(brand.tag).toBe("A");

    const navStops = await tabUntilRole(page, "link", "Projects", {
      within: page.getByRole("navigation", { name: "Main navigation" }),
      maxStops: 12
    });
    expect(
      navStops,
      "header Projects link was not reachable by Tab"
    ).toBeGreaterThan(0);
    await expectVisibleFocus(page, "header Projects link");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/en\/projects$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Projects" })
    ).toBeVisible();

    // 3. No keyboard trap: a bounded forward walk crosses header + main and
    //    reaches the footer (contentinfo), using more than a couple of stops.
    await page.goto("/en");
    await expect(skipLink).toBeVisible();
    await focusBody(page);
    const footer = page.getByRole("contentinfo");
    const seen = new Set<string>();
    let reachedFooter = false;
    for (let stop = 0; stop < 80; stop += 1) {
      await page.keyboard.press("Tab");
      const state = await page.evaluate(() => {
        const element = document.activeElement as HTMLElement | null;
        if (!element) return { key: "none" };
        return {
          key:
            element.id ||
            element.getAttribute("href") ||
            `${element.tagName}:${(element.textContent ?? "").trim().slice(0, 40)}`
        };
      });
      seen.add(state.key);
      const inFooter = await footer
        .evaluate(element => element.contains(document.activeElement))
        .catch(() => false);
      if (inFooter) {
        reachedFooter = true;
        break;
      }
    }
    expect(
      reachedFooter,
      `Tab never reached the footer (trap?); ${seen.size} distinct stops`
    ).toBe(true);
    expect(seen.size).toBeGreaterThan(8);

    // Shift+Tab leaves the footer again: focus is not stuck there.
    expect(
      await footer.evaluate(element => element.contains(document.activeElement))
    ).toBe(true);
    await page.keyboard.press("Shift+Tab");
    expect(
      await footer.evaluate(element => element.contains(document.activeElement))
    ).toBe(false);
  });

  test.describe("admin at 360×640", () => {
    test.use({ viewport: MOBILE_VIEWPORT });

    test("admin: sign-in, navigation and the form are keyboard-only", async ({
      page
    }) => {
      await mockSupabaseAuth(page, { user: ADMIN_AUTH_USER });
      const store = createProjectStore();
      await mockProjectApi(page, store);

      await page.goto("/en/admin/sign-in");
      const adminSkip = page.getByRole("link", {
        name: /skip to main content/i
      });
      await expect(adminSkip).toBeVisible();

      // 1. The admin shell has the same bypass mechanism as the public shell.
      await focusBody(page);
      await page.keyboard.press("Tab");
      const skip = await expectVisibleFocus(page, "admin skip link");
      expect(skip.text).toMatch(/skip/i);
      await page.keyboard.press("Enter");
      await expect(page.getByRole("main")).toBeFocused();

      // 2. Complete the credential form with Tab + typing only.
      await page.reload();
      await expect(adminSkip).toBeVisible();
      await focusBody(page);
      const emailStop = await tabUntilRole(page, "textbox", "Email", {
        maxStops: 16
      });
      expect(emailStop, "email field was not reachable by Tab").toBeGreaterThan(
        0
      );
      await expectVisibleFocus(page, "admin email field");
      await page.keyboard.type("admin@demo.local");

      await page.keyboard.press("Tab");
      await expect(page.getByLabel("Password")).toBeFocused();
      await expectVisibleFocus(page, "admin password field");
      await page.keyboard.type("e2e-password");

      await page.keyboard.press("Tab");
      await expect(page.getByRole("button", { name: "Sign in" })).toBeFocused();
      await expectVisibleFocus(page, "admin submit button");
      await page.keyboard.press("Enter");

      await expect(page).toHaveURL(/\/en\/admin$/);
      await expect(
        page.getByRole("heading", { level: 1, name: "Dashboard" })
      ).toBeVisible();

      // 3. Admin navigation and the content form are keyboard operable.
      await focusBody(page);
      const projectsStop = await tabUntilRole(page, "link", "Projects", {
        within: page.getByRole("navigation", { name: "Admin navigation" }),
        maxStops: 20
      });
      expect(
        projectsStop,
        "admin Projects nav link was not reachable by Tab"
      ).toBeGreaterThan(0);
      await expectVisibleFocus(page, "admin Projects nav link");
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/\/en\/admin\/projects$/);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

      await focusBody(page);
      const newProjectStop = await tabUntilRole(page, "link", "New project", {
        maxStops: 20
      });
      expect(
        newProjectStop,
        "New project link was not reachable by Tab"
      ).toBeGreaterThan(0);
      await expectVisibleFocus(page, "New project link");
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/\/en\/admin\/projects\/new$/);

      // 4. The first form field receives visible focus and Shift+Tab leaves it
      //    (no trap inside the Quasar field wrapper).
      const slugField = page.getByLabel("URL slug");
      const slugStop = await tabUntilRole(page, "textbox", "URL slug", {
        maxStops: 30
      });
      expect(
        slugStop,
        "project slug field was not reachable by Tab"
      ).toBeGreaterThan(0);
      await expectVisibleFocus(page, "project slug field");
      await page.keyboard.press("Shift+Tab");
      await expect(slugField).not.toBeFocused();

      // Sanity: the mocked session really is the admin fixture.
      expect(store.projects).toEqual([]);
      await expect(
        page.getByRole("heading", { level: 1, name: "New project" })
      ).toBeVisible();
    });
  });

  test("a mocked admin session reaches the dashboard helper", async ({
    page
  }) => {
    // Guards the shared helper used by the mobile matrix; it signs in through
    // the real form rather than injecting a session.
    await mockSupabaseAuth(page, { user: ADMIN_AUTH_USER });
    await signInAsAdmin(page);
    await expect(
      page.getByRole("heading", { level: 1, name: "Dashboard" })
    ).toBeVisible();
  });
});
