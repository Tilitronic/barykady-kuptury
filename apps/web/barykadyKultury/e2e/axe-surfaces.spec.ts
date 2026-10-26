import { expect, type Page } from "@playwright/test";

import {
  expectLandmarksAndHeadings,
  expectNoBlockingViolations
} from "./support/a11y";
import {
  ADMIN_AUTH_USER,
  mockCalendarEvents,
  mockSupabaseAuth,
  mockSupabaseRest,
  mockSupabaseStorage
} from "./support/mocks";
import {
  ABOUT_PAGE_FIXTURE,
  EVENT_LINKS_FIXTURE,
  HOME_EVENTS,
  HOME_PAGE_FIXTURE,
  MOBILE_VIEWPORT,
  PROJECTS_FIXTURE,
  PUBLICATIONS_FIXTURE,
  signInAsAdmin
} from "./support/journey-fixtures";
import { createProjectStore, mockProjectApi } from "./support/project-store";
import { test } from "./support/network-guard";

/**
 * T-033 — the complete axe surface matrix named by the ticket: home, About,
 * project detail, publication detail, events, contact, support, sign-in,
 * project form and mobile navigation — each scanned LIGHT and DARK through
 * `expectNoBlockingViolations` (critical AND serious), plus the structural
 * contract axe cannot check (one main, one h1, no heading skips) on every
 * public surface. docs/TESTING.md §4, docs/DESIGN_SYSTEM.md §6.
 *
 * T-032 (axe-journeys.spec.ts) opened the gate on five surfaces; this spec
 * closes the ten-surface matrix. Every dark finding raised here was fixed in
 * the same commit series — see docs/a11y-audit.md for the baseline table.
 */

type Theme = "light" | "dark";

async function applyTheme(page: Page, theme: Theme): Promise<void> {
  // No stored override → the T-010 boot follows the emulated system
  // preference, which is the deterministic way to reach both themes.
  await page.emulateMedia({ colorScheme: theme });
}

const SURFACES = {
  home: async (page: Page) => {
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
  },
  about: async (page: Page) => {
    await mockSupabaseRest(page, { responses: { site_pages: ABOUT_PAGE_FIXTURE } });
    await page.goto("/en/about");
    await expect(
      page.getByRole("heading", { level: 1, name: "About us" })
    ).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Mission" })).toBeVisible();
  },
  projectDetail: async (page: Page) => {
    await mockSupabaseRest(page, { responses: { projects: PROJECTS_FIXTURE } });
    await page.goto("/en/projects/sample-community-workshop");
    await expect(
      page.getByRole("heading", { level: 1, name: "Sample Community Workshop (Fictional)" })
    ).toBeVisible();
  },
  publicationDetail: async (page: Page) => {
    await mockSupabaseRest(page, { responses: { publications: PUBLICATIONS_FIXTURE } });
    await mockSupabaseStorage(page);
    await page.goto("/en/publications/sample-publication");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  },
  events: async (page: Page) => {
    await mockCalendarEvents(page, { events: HOME_EVENTS });
    await mockSupabaseRest(page, {
      responses: {
        site_pages: HOME_PAGE_FIXTURE,
        projects: PROJECTS_FIXTURE,
        calendar_event_links: EVENT_LINKS_FIXTURE
      }
    });
    await page.goto("/en/events");
    await expect(
      page.getByRole("heading", { level: 1, name: "Events" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 3, name: "Sample timed event" })
    ).toBeVisible();
  },
  support: async (page: Page) => {
    await mockSupabaseRest(page);
    await page.goto("/en/support");
    await expect(
      page.getByRole("heading", { level: 1, name: "Support us" })
    ).toBeVisible();
  },
  signIn: async (page: Page) => {
    await mockSupabaseAuth(page, { user: ADMIN_AUTH_USER });
    await page.goto("/en/admin/sign-in");
    await expect(
      page.getByRole("heading", { level: 1, name: "Administrator sign in" })
    ).toBeVisible();
  },
  contact: async (page: Page) => {
    await page.goto("/en/contact");
    await expect(
      page.getByRole("heading", { level: 1, name: "Contact" })
    ).toBeVisible();
  },
  projectForm: async (page: Page) => {
    await mockSupabaseAuth(page, { user: ADMIN_AUTH_USER });
    const store = createProjectStore();
    await mockProjectApi(page, store);
    await signInAsAdmin(page);
    await page.goto("/en/admin/projects/new");
    await expect(
      page.getByRole("heading", { level: 1, name: "New project" })
    ).toBeVisible();
  },
  mobileNav: async (page: Page) => {
    await mockSupabaseRest(page);
    await page.goto("/en");
    const trigger = page.getByTestId("menu-trigger");
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByTestId("main-nav")).toBeVisible();
  }
} as const;

const PUBLIC_SURFACES = [
  "home",
  "about",
  "projectDetail",
  "publicationDetail",
  "events",
  "support",
  "contact"
] as const;

for (const [name, load] of Object.entries(SURFACES)) {
  for (const theme of ["light", "dark"] as Theme[]) {
    test.describe(`T-033 a11y axe matrix — ${name} (${theme})`, () => {
      if (name === "mobileNav") {
        test.use({ viewport: MOBILE_VIEWPORT });
      }

      test(`${name} has 0 critical/serious violations in ${theme}`, async ({
        page
      }) => {
        await applyTheme(page, theme);
        await load(page);
        await expectNoBlockingViolations(page);

        if ((PUBLIC_SURFACES as readonly string[]).includes(name)) {
          await expectLandmarksAndHeadings(page);
        }
      });
    });
  }
}
