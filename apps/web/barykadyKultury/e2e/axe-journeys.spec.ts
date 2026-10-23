import { expect } from "@playwright/test";

import { expectNoBlockingViolations } from "./support/a11y";
import {
  ADMIN_AUTH_USER,
  mockCalendarEvents,
  mockSupabaseAuth,
  mockSupabaseRest,
  mockSupabaseStorage
} from "./support/mocks";
import {
  EN_PROJECT_SLUG,
  HOME_EVENTS,
  HOME_PAGE_FIXTURE,
  MOBILE_VIEWPORT,
  PROJECTS_FIXTURE,
  PUBLICATIONS_FIXTURE,
  PUBLICATION_SLUG,
  signInAsAdmin
} from "./support/journey-fixtures";
import { createProjectStore, mockProjectApi } from "./support/project-store";
import { test } from "./support/network-guard";

/**
 * T-032 — axe assertions on the five surfaces named by the acceptance
 * criterion: home, a content detail page, mobile navigation, contact and an
 * admin content form (docs/TESTING.md §4; docs/DESIGN_SYSTEM.md §6).
 *
 * The shared helper fails on critical AND serious findings. Automated scans
 * never replace the manual keyboard/visible-focus proof in
 * `keyboard-focus.spec.ts`; this spec is the automated half of the gate.
 */
test.describe("T-032 critical axe journeys", () => {
  test("home page has no blocking violations", async ({ page }) => {
    await mockCalendarEvents(page, { events: HOME_EVENTS });
    await mockSupabaseRest(page, {
      responses: {
        site_pages: HOME_PAGE_FIXTURE,
        projects: PROJECTS_FIXTURE,
        calendar_event_links: []
      }
    });

    await page.goto("/en");
    await expect(
      page.getByRole("heading", { level: 1, name: "Barykady Kultury" })
    ).toBeVisible();
    await expectNoBlockingViolations(page);
  });

  test("project detail has no blocking violations", async ({ page }) => {
    await mockSupabaseRest(page, {
      responses: { projects: PROJECTS_FIXTURE }
    });

    await page.goto(`/en/projects/${EN_PROJECT_SLUG}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoBlockingViolations(page);
  });

  test("publication detail has no blocking violations", async ({ page }) => {
    await mockSupabaseRest(page, {
      responses: { publications: PUBLICATIONS_FIXTURE }
    });
    await mockSupabaseStorage(page);

    await page.goto(`/en/publications/${PUBLICATION_SLUG}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoBlockingViolations(page);
  });

  test.describe("mobile navigation at 360×640", () => {
    test.use({ viewport: MOBILE_VIEWPORT });

    test("the open drawer and bottom bar have no blocking violations", async ({
      page
    }) => {
      await mockSupabaseRest(page);
      await page.goto("/en");

      const trigger = page.getByTestId("menu-trigger");
      await trigger.click();
      await expect(trigger).toHaveAttribute("aria-expanded", "true");
      await expect(page.getByTestId("main-nav")).toBeVisible();
      await expect(page.getByTestId("bottom-nav")).toBeVisible();

      await expectNoBlockingViolations(page);
    });
  });

  test("contact page has no blocking violations", async ({ page }) => {
    await page.goto("/en/contact");
    await expect(
      page.getByRole("heading", { level: 1, name: "Contact" })
    ).toBeVisible();
    await expectNoBlockingViolations(page);
  });

  test.describe("admin content form at 360×640", () => {
    test.use({ viewport: MOBILE_VIEWPORT });

    test("the new-project form has no blocking violations", async ({
      page
    }) => {
      await mockSupabaseAuth(page, { user: ADMIN_AUTH_USER });
      const store = createProjectStore();
      await mockProjectApi(page, store);
      await signInAsAdmin(page);

      await page.goto("/en/admin/projects/new");
      await expect(
        page.getByRole("heading", { level: 1, name: "New project" })
      ).toBeVisible();

      await expectNoBlockingViolations(page);
    });
  });
});
