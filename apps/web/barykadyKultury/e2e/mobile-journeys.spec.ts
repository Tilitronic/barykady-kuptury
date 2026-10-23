import { expect, type Page } from "@playwright/test";

import {
  ADMIN_AUTH_USER,
  mockCalendarEvents,
  mockSupabaseAuth,
  mockSupabaseRest,
  PDF_FIXTURE_BODY
} from "./support/mocks";
import { createEventStore, mockEventApi } from "./support/event-store";
import {
  ADMIN_EVENT_PROJECTS,
  EN_PROJECT_BODY,
  EN_PROJECT_SLUG,
  EN_PROJECT_TITLE,
  EVENT_LINKS_FIXTURE,
  FEATURED_PROJECTS_FIXTURE,
  FIRST_FEATURED,
  HOME_EVENTS,
  HOME_PAGE_FIXTURE,
  HOME_TITLE,
  MOBILE_VIEWPORT,
  NOT_FEATURED,
  PROJECTS_FIXTURE,
  SECOND_FEATURED,
  CONFIGURED_CONTACT_FIXTURE,
  seedConfiguredContact,
  UNFEATURED_PROJECTS_FIXTURE,
  expectNoHorizontalOverflow,
  signInAsAdmin
} from "./support/journey-fixtures";
import { focusBody, tabUntilRole } from "./support/journey-helpers";
import { createProjectStore, mockProjectApi } from "./support/project-store";
import {
  createAdminContentStore,
  mockAdminContentApi
} from "./support/publication-admin-store";
import { test } from "./support/network-guard";

/**
 * T-032 — mobile journey matrix at exactly 360×640.
 *
 * docs/TESTING.md §2 journey 12 and the T-032 acceptance criterion require
 * every main and admin journey to COMPLETE on a 360×640 viewport. Wide-layout
 * suites do not prove that: menus move into the drawer/bottom bar, tables
 * become stacked cards and the fixed navigation bar steals vertical space.
 *
 * Every journey installs mocks before navigation; no test touches a real
 * calendar, Supabase project or network (docs/TESTING.md §2). Selectors are
 * role- or testid-based and all waiting is web-first.
 */
test.describe("T-032 critical mobile journey matrix — 360×640", () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test("J1 — anonymous navigation and a direct project deep link", async ({
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
    await expect(
      page.getByRole("heading", { level: 1, name: HOME_TITLE })
    ).toBeVisible();

    // The bottom bar is the primary navigation in the phone band.
    const bottomNav = page.getByRole("navigation", { name: "Main navigation" });
    await bottomNav.getByRole("link", { name: "Projects" }).click();
    await expect(page).toHaveURL(/\/en\/projects$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Projects" })
    ).toBeVisible();

    await page.getByRole("link", { name: EN_PROJECT_TITLE }).first().click();
    await expect(page).toHaveURL(
      new RegExp(`/en/projects/${EN_PROJECT_SLUG}$`)
    );
    await expect(
      page.getByRole("heading", { level: 1, name: EN_PROJECT_TITLE })
    ).toBeVisible();
    await expect(page.getByText(EN_PROJECT_BODY)).toBeVisible();

    // Direct deep link (shareable URL) resolves without walking the site.
    await page.goto(`/en/projects/${EN_PROJECT_SLUG}`);
    await expect(
      page.getByRole("heading", { level: 1, name: EN_PROJECT_TITLE })
    ).toBeVisible();

    await expectNoHorizontalOverflow(page, "J1 project detail");
  });

  test("J2 — locale detection, explicit URL, switching and persistence", async ({
    page
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    await page.goto("/pl/projects");
    await expect(
      page.getByRole("heading", { level: 1, name: "Projekty" })
    ).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "pl");

    // On the phone band the controls live in the full-menu drawer.
    await page.getByRole("button", { name: /menu/i }).click();
    await page.getByRole("button", { name: /Język Polski/ }).click();
    await page.getByRole("button", { name: /Українська/ }).click();

    await expect(page).toHaveURL(/\/uk\/projects$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "uk");
    await expect(
      page.getByRole("heading", { level: 1, name: "Проєкти" })
    ).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("bk.locale"))).toBe(
      "uk"
    );

    // The persisted choice drives the root redirect on the next visit.
    await page.goto("/");
    await expect(page).toHaveURL(/\/uk$/);
    await expectNoHorizontalOverflow(page, "J2 locale switch");
  });

  test("J3 — system theme first visit and a persisted override", async ({
    page
  }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/en");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await page.getByRole("button", { name: /menu/i }).click();
    const toggle = page.getByRole("switch", { name: "Dark mode" });
    await expect(toggle).toBeVisible();
    await toggle.click();

    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    expect(await page.evaluate(() => localStorage.getItem("bk.theme"))).toBe(
      "light"
    );

    // Reload with the system still dark: the explicit override wins.
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expectNoHorizontalOverflow(page, "J3 theme");
  });

  test("J4 — homepage upcoming events are chronological at 360×640", async ({
    page
  }) => {
    await mockCalendarEvents(page, { events: HOME_EVENTS });
    await mockSupabaseRest(page, {
      responses: {
        site_pages: HOME_PAGE_FIXTURE,
        projects: FEATURED_PROJECTS_FIXTURE,
        calendar_event_links: []
      }
    });

    await page.goto("/en");
    const events = page.getByRole("region", { name: "Upcoming events" });
    const cards = events.getByRole("listitem");
    await expect(cards).toHaveCount(3);
    await expect(cards.nth(0)).toContainText("Sample timed event");
    await expect(cards.nth(1)).toContainText("Sample all-day event");
    await expect(cards.nth(2)).toContainText("Sample third event");

    await expectNoHorizontalOverflow(page, "J4 events");
  });

  test("J5 — event→published project link, and an event without a project", async ({
    page
  }) => {
    await mockCalendarEvents(page, { events: HOME_EVENTS });
    await mockSupabaseRest(page, {
      responses: {
        calendar_event_links: EVENT_LINKS_FIXTURE,
        projects: PROJECTS_FIXTURE
      }
    });

    await page.goto("/en/events");
    const eventHeadings = page.getByRole("heading", { level: 3 });
    await expect(eventHeadings).toHaveCount(3);
    await expect(eventHeadings.nth(0)).toHaveText("Sample timed event");

    const projectLink = page.getByRole("link", { name: EN_PROJECT_TITLE });
    await expect(projectLink).toBeVisible();
    await projectLink.click();

    await expect(page).toHaveURL(
      new RegExp(`/en/projects/${EN_PROJECT_SLUG}$`)
    );
    await expect(
      page.getByRole("heading", { level: 1, name: EN_PROJECT_TITLE })
    ).toBeVisible();

    // The all-day event has no mapping and still renders, without a link.
    await page.goto("/en/events");
    await expect(
      page.getByRole("heading", { level: 3, name: "Sample all-day event" })
    ).toBeVisible();
    // Exactly one project link exists: the timed event's published project.
    await expect(
      page.getByRole("link", { name: EN_PROJECT_TITLE })
    ).toHaveCount(1);
    await expectNoHorizontalOverflow(page, "J5 event project link");
  });

  test("J6 — featured order and the recent-published fallback", async ({
    page
  }) => {
    await mockCalendarEvents(page, { events: [] });
    await mockSupabaseRest(page, {
      responses: {
        site_pages: HOME_PAGE_FIXTURE,
        projects: FEATURED_PROJECTS_FIXTURE,
        calendar_event_links: []
      }
    });

    await page.goto("/en");
    const featuredRegion = page.getByRole("region", {
      name: "Featured projects"
    });
    const featured = featuredRegion.getByRole("listitem");
    await expect(featured).toHaveCount(2);
    await expect(featured.nth(0)).toContainText(FIRST_FEATURED);
    await expect(featured.nth(1)).toContainText(SECOND_FEATURED);

    // Later registration wins: serve the unfeatured set and reload.
    await mockSupabaseRest(page, {
      responses: {
        site_pages: HOME_PAGE_FIXTURE,
        projects: UNFEATURED_PROJECTS_FIXTURE,
        calendar_event_links: []
      }
    });
    await page.reload();

    const recent = page
      .getByRole("region", { name: "Featured projects" })
      .getByRole("listitem");
    await expect(recent).toHaveCount(3);
    await expect(recent.nth(0)).toContainText(FIRST_FEATURED);
    await expect(recent.nth(1)).toContainText(SECOND_FEATURED);
    await expect(recent.nth(2)).toContainText(NOT_FEATURED);
    await expectNoHorizontalOverflow(page, "J6 featured fallback");
  });

  test("J7 — contact page obeys the D-09 no-form contract", async ({
    page
  }) => {
    await page.goto("/en/contact");

    await expect(
      page.getByRole("heading", { level: 1, name: "Contact" })
    ).toBeVisible();
    // D-09 is open: no delivery provider exists, so no form may ship.
    // A form without an accessible name has no ARIA role, and <address> has
    // none either; these two element selectors are structurally unavoidable.
    await expect(page.locator("main form")).toHaveCount(0);
    await expect(page.getByRole("main").getByRole("textbox")).toHaveCount(0);
    await expect(page.getByRole("main").getByRole("combobox")).toHaveCount(0);
    const contactHrefs = await page
      .getByRole("main")
      .getByRole("link")
      .evaluateAll(links => links.map(link => link.getAttribute("href") ?? ""));
    expect(
      contactHrefs.some(
        href => href.startsWith("mailto:") || href.startsWith("tel:")
      )
    ).toBe(false);
    await expect(page.locator("main address")).toHaveCount(0);

    await expectNoHorizontalOverflow(page, "J7 contact");
  });

  test("J7b — a configured public channel renders a functional mailto at 360×640", async ({
    page
  }) => {
    await seedConfiguredContact(page);
    await page.goto("/en/contact");

    const email = page.getByRole("link", {
      name: CONFIGURED_CONTACT_FIXTURE.email
    });
    await expect(email).toBeVisible();
    await expect(email).toHaveAttribute(
      "href",
      `mailto:${CONFIGURED_CONTACT_FIXTURE.email}?subject=${encodeURIComponent("Message from the website")}`
    );
    await expect(
      page.getByText(CONFIGURED_CONTACT_FIXTURE.address)
    ).toBeVisible();
    // Unnamed form: no ARIA role — element selector is structurally required.
    await expect(page.locator("main form")).toHaveCount(0);

    await expectNoHorizontalOverflow(page, "J7b configured contact");
  });

  test("J8 — anonymous admin access is rejected and sign-in completes", async ({
    page
  }) => {
    await mockSupabaseAuth(page, { user: ADMIN_AUTH_USER });

    await page.goto("/en/admin");
    await expect(page).toHaveURL(/\/en\/admin\/sign-in\?redirect=\/en\/admin$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Administrator sign in" })
    ).toBeVisible();

    await signInAsAdmin(page);
    await expect(page).toHaveURL(/\/en\/admin$/);
    await expect(
      page.getByRole("navigation", { name: "Admin navigation" })
    ).toBeVisible();
    await expectNoHorizontalOverflow(page, "J8 admin sign-in");
  });

  test("J9 — admin creates and publishes a project; the draft never leaks", async ({
    page,
    browser
  }) => {
    await mockSupabaseAuth(page, { user: ADMIN_AUTH_USER });
    const store = createProjectStore();
    await mockProjectApi(page, store);
    await signInAsAdmin(page);

    await page.goto("/en/admin/projects/new");
    await page
      .getByRole("textbox", { name: "URL slug", exact: true })
      .fill("e2e-mobile-project");
    await page
      .getByRole("textbox", { name: "Title", exact: true })
      .fill("E2E Mobile Project");
    await page
      .getByRole("textbox", { name: "Summary", exact: true })
      .fill("Mobile summary.");
    await page
      .getByRole("textbox", { name: "Body", exact: true })
      .fill("## Mobile\n\nBody.");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Draft saved." })
    ).toHaveText("Draft saved.");

    const anonContext = await browser.newContext({ viewport: MOBILE_VIEWPORT });
    const anonPage = await anonContext.newPage();
    await mockProjectApi(anonPage, store);

    // Draft: invisible in the listing and a 404 at its direct URL.
    await anonPage.goto("/en/projects");
    await expect(anonPage.getByText("E2E Mobile Project")).toHaveCount(0);
    await anonPage.goto("/en/projects/e2e-mobile-project");
    await expect(
      anonPage.getByRole("heading", { level: 1, name: "Page not found" })
    ).toBeVisible();

    await page.getByRole("button", { name: "Publish" }).click();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Published. The project is now public." })
    ).toHaveText("Published. The project is now public.");

    await anonPage.goto("/en/projects");
    await expect(
      anonPage.getByRole("link", { name: "E2E Mobile Project" })
    ).toBeVisible();
    await anonPage.goto("/en/projects/e2e-mobile-project");
    await expect(
      anonPage.getByRole("heading", { level: 1, name: "E2E Mobile Project" })
    ).toBeVisible();
    await expectNoHorizontalOverflow(anonPage, "J9 published project");

    await anonContext.close();
  });

  test("J10 — admin assigns and unassigns a calendar event", async ({
    page
  }) => {
    await mockSupabaseAuth(page, { user: ADMIN_AUTH_USER });
    await mockCalendarEvents(page);
    const store = createEventStore({ projects: ADMIN_EVENT_PROJECTS });
    await mockEventApi(page, store);
    await signInAsAdmin(page);

    await page.goto("/en/admin/events");
    const eventRow = page
      .getByRole("row")
      .filter({ hasText: "Sample timed event" });
    await expect(eventRow).toBeVisible();

    const projectSelect = page.getByRole("combobox", {
      name: "Project for Sample timed event"
    });
    await projectSelect.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("option", { name: EN_PROJECT_TITLE }).click();
    await expect(page.getByRole("status")).toHaveText("Project assigned.");

    await page.goto("/en/events");
    await expect(
      page.getByRole("link", { name: EN_PROJECT_TITLE })
    ).toBeVisible();

    await page.goto("/en/admin/events");
    await page
      .getByRole("combobox", { name: "Project for Sample timed event" })
      .focus();
    await page.keyboard.press("Enter");
    await page.getByRole("option", { name: "No project" }).click();
    await expect(page.getByRole("status")).toHaveText("Project removed.");

    await page.goto("/en/events");
    await expect(
      page.getByRole("heading", { name: "Sample timed event" })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: EN_PROJECT_TITLE })
    ).toHaveCount(0);
    await expectNoHorizontalOverflow(page, "J10 event mapping");
  });

  test("J11 — publication upload, anonymous download and access policy", async ({
    page,
    browser
  }) => {
    await mockSupabaseAuth(page, { user: ADMIN_AUTH_USER });
    const store = createAdminContentStore();

    const install = async (target: Page) => {
      await mockSupabaseRest(target);
      await mockAdminContentApi(target, store);
    };

    await install(page);
    await signInAsAdmin(page);

    await page.goto("/en/admin/publications/new");
    await page
      .getByRole("textbox", { name: "URL slug", exact: true })
      .fill("e2e-mobile-report");
    await page
      .getByRole("textbox", { name: "Title", exact: true })
      .fill("E2E Mobile Report");
    await page
      .getByRole("textbox", { name: "Abstract", exact: true })
      .fill("Deterministic mobile abstract.");
    // Three identical "Choose a file" labels (en/pl/uk); first is English.
    await page
      .getByLabel("Choose a file")
      .first()
      .setInputFiles({
        name: "mobile-report.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from(PDF_FIXTURE_BODY)
      });
    await page.getByRole("button", { name: "Save" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Draft saved." })
    ).toHaveText("Draft saved.");
    expect(store.uploads).toHaveLength(1);

    await page.getByRole("button", { name: "Publish" }).click();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Published. The publication is now public." })
    ).toHaveText("Published. The publication is now public.");

    const anonContext = await browser.newContext({ viewport: MOBILE_VIEWPORT });
    const anonPage = await anonContext.newPage();
    await install(anonPage);

    await anonPage.goto("/en/publications");
    await expect(
      anonPage.getByRole("link", { name: "E2E Mobile Report" })
    ).toBeVisible();
    await anonPage.goto("/en/publications/e2e-mobile-report");

    const download = anonPage
      .getByRole("main")
      .getByRole("link")
      .filter({ hasText: "English" })
      .first();
    const href = await download.getAttribute("href");
    expect(href).toContain("/storage/v1/object/public/public-documents/");

    const response = await anonPage.evaluate(async url => {
      const result = await fetch(url!);
      return {
        status: result.status,
        contentType: result.headers.get("content-type"),
        body: await result.text()
      };
    }, href);
    expect(response.status).toBe(200);
    expect(response.contentType).toContain("application/pdf");
    expect(response.body).toContain("%PDF");

    // Unpublishing closes the anonymous path.
    await page.getByRole("button", { name: "Unpublish" }).click();
    await expect(
      page.getByRole("status").filter({
        hasText: "Unpublished. The publication is no longer public."
      })
    ).toHaveText("Unpublished. The publication is no longer public.");
    await anonPage.goto("/en/publications");
    await expect(anonPage.getByText("E2E Mobile Report")).toHaveCount(0);
    await expectNoHorizontalOverflow(page, "J11 publication admin");

    await anonContext.close();
  });

  test("J12 — main navigation is operable keyboard-only at 360×640", async ({
    page
  }) => {
    await page.goto("/en");
    const skipLink = page.getByRole("link", { name: /skip to main content/i });
    await expect(skipLink).toBeVisible();
    await focusBody(page);

    // WCAG 2.4.1: the skip link is the first stop and moves focus to main.
    await page.keyboard.press("Tab");
    await expect(skipLink).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("main")).toBeFocused();

    // The full-menu drawer opens and closes from the keyboard, restoring the
    // trigger — no trap and no pointer-only affordance.
    const menuTrigger = page.getByRole("button", { name: /menu/i });
    await menuTrigger.focus();
    await page.keyboard.press("Enter");
    await expect(menuTrigger).toHaveAttribute("aria-expanded", "true");
    await expect(
      page.getByRole("navigation", { name: "Full menu" })
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menuTrigger).toHaveAttribute("aria-expanded", "false");
    await expect(menuTrigger).toBeFocused();

    // The bottom bar is reachable by Tab and activates with Enter.
    await focusBody(page);
    const stops = await tabUntilRole(page, "link", "Projects", {
      within: page.getByRole("navigation", { name: "Main navigation" }),
      maxStops: 24
    });
    expect(
      stops,
      "bottom-bar Projects was not reachable by Tab"
    ).toBeGreaterThan(0);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/en\/projects$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Projects" })
    ).toBeVisible();

    await expectNoHorizontalOverflow(page, "J12 keyboard navigation");
  });
});
