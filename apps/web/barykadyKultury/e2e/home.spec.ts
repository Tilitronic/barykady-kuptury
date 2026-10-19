import { expect, type Page } from "@playwright/test";

import { checkA11y } from "./support/a11y";
import {
  CALENDAR_EVENTS_FIXTURE,
  type CalendarEvent
} from "./fixtures/calendar-events";
import { mockCalendarEvents, mockSupabaseRest } from "./support/mocks";
import { test } from "./support/network-guard";

/**
 * T-025 — Homepage composition journeys.
 *
 * The homepage consumes the same mocked seams as the listing pages:
 * `mockCalendarEvents` for the adapter and `mockSupabaseRest` for
 * `site_pages` / `projects` / `calendar_event_links` (docs/TESTING.md §2:
 * deterministic fixtures, no live services). The fixtures deliberately
 * include the worst cases — a draft project and a fourth upcoming event —
 * so the ordering, the cap and the published-only rule are proven in the
 * browser, not only in component tests.
 */

const MISSION_BODY = "HOME-INTRO body rendered from site_pages.";
const FIRST_FEATURED = "First Featured Project (Fictional)";
const SECOND_FEATURED = "Second Featured Project (Fictional)";
const DRAFT_TITLE = "Draft Project Must Not Leak";

const HOME_PAGE_FIXTURE = [
  {
    id: "00000000-0000-4000-8000-000000000100",
    page_key: "home",
    status: "published",
    updated_at: "2026-02-01T00:00:00Z",
    site_page_translations: [
      {
        locale: "en",
        slug: "home",
        title: "Barykady Kultury",
        body: `## Who we are\n\n${MISSION_BODY}`,
        meta_description: null,
        needs_review: false
      }
    ]
  }
];

const FEATURED_PROJECTS_FIXTURE = [
  {
    id: "00000000-0000-4000-8000-000000000202",
    status: "published",
    featured_rank: 2,
    cover_path: null,
    start_date: null,
    end_date: null,
    updated_at: "2026-02-02T00:00:00Z",
    project_translations: [
      {
        locale: "en",
        slug: "second-featured-project",
        title: SECOND_FEATURED,
        summary: "Second in the configured order.",
        body: "B."
      }
    ]
  },
  {
    id: "00000000-0000-4000-8000-000000000201",
    status: "published",
    featured_rank: 1,
    cover_path: null,
    start_date: null,
    end_date: null,
    updated_at: "2026-02-01T00:00:00Z",
    project_translations: [
      {
        locale: "en",
        slug: "first-featured-project",
        title: FIRST_FEATURED,
        summary: "First in the configured order.",
        body: "A."
      }
    ]
  },
  {
    id: "00000000-0000-4000-8000-000000000203",
    status: "published",
    featured_rank: null,
    cover_path: null,
    start_date: null,
    end_date: null,
    updated_at: "2026-02-03T00:00:00Z",
    project_translations: [
      {
        locale: "en",
        slug: "not-featured-project",
        title: "Not Featured Project",
        summary: "Newest but not featured.",
        body: "C."
      }
    ]
  },
  {
    id: "00000000-0000-4000-8000-000000000299",
    status: "draft",
    featured_rank: 0,
    cover_path: null,
    start_date: null,
    end_date: null,
    updated_at: "2026-02-04T00:00:00Z",
    project_translations: [
      {
        locale: "en",
        slug: "draft-project-leak",
        title: DRAFT_TITLE,
        summary: "Draft summary must not leak.",
        body: "DRAFT BODY"
      }
    ]
  }
];

const UNFEATURED_PROJECTS_FIXTURE = [
  {
    ...FEATURED_PROJECTS_FIXTURE[2]!,
    updated_at: "2026-01-01T00:00:00Z"
  },
  {
    ...FEATURED_PROJECTS_FIXTURE[1]!,
    featured_rank: null,
    updated_at: "2026-03-01T00:00:00Z"
  },
  {
    ...FEATURED_PROJECTS_FIXTURE[0]!,
    featured_rank: null,
    updated_at: "2026-02-15T00:00:00Z"
  },
  FEATURED_PROJECTS_FIXTURE[3]!
];

// A third event beyond the shared fixture pair, so the "nearest three" cap
// and the soonest-first order are both observable.
const THIRD_EVENT: CalendarEvent = {
  id: "fixture-event-third",
  title: "Sample third event",
  start: "2030-07-01T09:00:00+02:00",
  end: null,
  allDay: false,
  timezone: "Europe/Warsaw",
  location: null,
  description: null,
  registrationUrl: null
};

async function gotoHome(
  page: Page,
  options: {
    projects?: unknown[];
    calendarStatus?: number;
    events?: CalendarEvent[];
  } = {}
): Promise<void> {
  await mockSupabaseRest(page, {
    responses: {
      site_pages: HOME_PAGE_FIXTURE,
      projects: options.projects ?? FEATURED_PROJECTS_FIXTURE,
      calendar_event_links: []
    }
  });
  await mockCalendarEvents(page, {
    events: options.events ?? [THIRD_EVENT, ...CALENDAR_EVENTS_FIXTURE],
    status: options.calendarStatus ?? 200
  });
  await page.goto("/en");
}

/** Fails on serious findings too, beyond the helper's critical-only default. */
async function expectNoSeriousViolations(page: Page): Promise<void> {
  const results = await checkA11y(page);
  const serious = results.violations.filter(
    violation => violation.impact === "serious"
  );

  expect(
    serious,
    `axe found ${serious.length} serious violation(s): ${serious
      .map(violation => violation.id)
      .join(", ")}`
  ).toHaveLength(0);
}

test.describe("homepage", () => {
  test("composes mission, nearest events and featured projects in order", async ({
    page
  }) => {
    await gotoHome(page);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Barykady Kultury"
    );

    // M1 (T-025 review): assert the outline explicitly so axe's MODERATE
    // heading-order finding can never hide a regression. One h1, exactly the
    // four section h2s, card/authored headings at h3.
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 2 })).toHaveText([
      "Our mission",
      "Upcoming events",
      "Featured projects",
      "Explore"
    ]);
    await expect(
      page.getByRole("heading", { level: 3, name: "Who we are" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 3, name: "Sample timed event" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 3, name: FIRST_FEATURED })
    ).toBeVisible();

    await expect(page.getByText(MISSION_BODY)).toBeVisible();

    // Nearest three, soonest-first: the 2030-05 timed event, the 2030-06
    // all-day event, the 2030-07 event; nothing else.
    const eventCards = page.locator(".event-card");
    await expect(eventCards).toHaveCount(3);
    await expect(eventCards.nth(0)).toContainText("Sample timed event");
    await expect(eventCards.nth(1)).toContainText("Sample all-day event");
    await expect(eventCards.nth(2)).toContainText("Sample third event");

    // Featured order honoured (rank 1 before rank 2); the unfeatured newest
    // and the draft never appear.
    const projectCards = page.locator(".project-card");
    await expect(projectCards).toHaveCount(2);
    await expect(projectCards.nth(0)).toContainText(FIRST_FEATURED);
    await expect(projectCards.nth(1)).toContainText(SECOND_FEATURED);
    await expect(page.locator("body")).not.toContainText(DRAFT_TITLE);
    await expect(page.locator("body")).not.toContainText(
      "Not Featured Project"
    );

    // Explore routes and the section view-all links exist.
    await expect(
      page.getByRole("link", { name: "All events" })
    ).toHaveAttribute("href", /\/en\/events$/);
    await expect(
      page.getByRole("link", { name: "All projects" })
    ).toHaveAttribute("href", /\/en\/projects$/);

    // The CTA is unconfigured in this build: nothing is invented.
    await expect(page.locator(".home__cta")).toHaveCount(0);

    await expectNoSeriousViolations(page);
  });

  test("falls back to recent published projects when none are featured", async ({
    page
  }) => {
    await gotoHome(page, {
      projects: UNFEATURED_PROJECTS_FIXTURE,
      events: []
    });

    const projectCards = page.locator(".project-card");
    await expect(projectCards).toHaveCount(3);
    await expect(projectCards.nth(0)).toContainText(FIRST_FEATURED); // 2026-03
    await expect(projectCards.nth(1)).toContainText(SECOND_FEATURED); // 2026-02-15
    await expect(projectCards.nth(2)).toContainText("Not Featured Project"); // 2026-01
    await expect(page.locator("body")).not.toContainText(DRAFT_TITLE);

    // Empty events render the intentional state with a route onward.
    await expect(page.locator(".home-events__state")).toContainText(
      "No upcoming events right now."
    );
  });

  test("a calendar 502 leaves mission and projects intact with a compact error", async ({
    page
  }) => {
    await gotoHome(page, { calendarStatus: 502 });

    await expect(page.getByText(MISSION_BODY)).toBeVisible();
    await expect(page.locator(".project-card")).toHaveCount(2);
    await expect(page.locator(".home-events__state")).toContainText(
      "The event calendar is temporarily unavailable."
    );
    await expect(
      page.locator(".home-events .section-shell__view-all")
    ).toBeVisible();

    await expectNoSeriousViolations(page);
  });

  test("renders at 320 px without horizontal overflow", async ({ page }) => {
    await gotoHome(page);
    await page.setViewportSize({ width: 320, height: 640 });

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(overflow).toBe(false);
  });
});
