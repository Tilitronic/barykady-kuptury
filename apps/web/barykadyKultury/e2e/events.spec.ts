import { expect, type Page } from "@playwright/test";

import { checkA11y } from "./support/a11y";
import {
  CALENDAR_EVENTS_CALENDAR_ID,
  CALENDAR_EVENTS_FIXTURE,
  type CalendarEvent
} from "./fixtures/calendar-events";
import { mockCalendarEvents, mockSupabaseRest } from "./support/mocks";
import { test } from "./support/network-guard";

/**
 * T-024 — Events page journeys over the mocked calendar function and the
 * mocked Supabase REST surface (docs/TESTING.md §2: no live calendar, no live
 * project). The fixture deliberately contains the worst cases: a link to a
 * draft project and a link for an event that is not on the calendar — the
 * published-only join must silently drop both.
 */

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

const TIMED_TITLE = "Sample timed event";
const ALL_DAY_TITLE = "Sample all-day event";
const PROJECT_TITLE = "Sample Community Workshop (Fictional)";
const DRAFT_PROJECT_TITLE = "Draft Project Must Not Leak";

/** Deliberately NOT chronological: the page must sort soonest-first. */
const EVENTS_SHUFFLED: CalendarEvent[] = [
  THIRD_EVENT,
  CALENDAR_EVENTS_FIXTURE[1]!, // all-day, 2030-06-01
  CALENDAR_EVENTS_FIXTURE[0]! // timed, 2030-05-14
];

const LINKS_FIXTURE = [
  {
    calendar_id: CALENDAR_EVENTS_CALENDAR_ID,
    google_event_id: "fixture-event-timed",
    project_id: "00000000-0000-4000-8000-000000000201",
    projects: {
      slug: "sample-community-workshop",
      status: "published",
      project_translations: [
        {
          locale: "en",
          title: PROJECT_TITLE
        },
        {
          locale: "pl",
          title: "Przykladowy warsztat spoleczny (fikcyjny)"
        }
      ]
    }
  },
  {
    calendar_id: CALENDAR_EVENTS_CALENDAR_ID,
    google_event_id: "fixture-event-all-day",
    project_id: "00000000-0000-4000-8000-000000000202",
    projects: {
      slug: "sample-draft-project",
      status: "draft",
      project_translations: [
        {
          locale: "en",
          title: DRAFT_PROJECT_TITLE
        }
      ]
    }
  },
  {
    calendar_id: "other-calendar@example.org",
    google_event_id: "fixture-event-third",
    project_id: "00000000-0000-4000-8000-000000000203",
    projects: {
      slug: "wrong-calendar-project",
      status: "published",
      project_translations: [
        {
          locale: "en",
          title: "Wrong Calendar Project"
        }
      ]
    }
  }
];

const PROJECTS_FIXTURE = [
  {
    id: "00000000-0000-4000-8000-000000000201",
    slug: "sample-community-workshop",
    status: "published",
    featured_rank: null,
    cover_path: null,
    start_date: "2026-01-10",
    end_date: null,
    updated_at: "2026-02-01T00:00:00Z",
    project_translations: [
      {
        locale: "en",
        title: PROJECT_TITLE,
        summary: "A fictional summary used only by local fixtures (EN).",
        body: "EN-PROJECT body."
      }
    ]
  }
];

async function gotoWithEvents(page: Page): Promise<void> {
  await mockCalendarEvents(page, { events: EVENTS_SHUFFLED });
  await mockSupabaseRest(page, {
    responses: {
      calendar_event_links: LINKS_FIXTURE,
      projects: PROJECTS_FIXTURE
    }
  });
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

test.describe("events", () => {
  test("lists upcoming events soonest-first with a published-only project join", async ({
    page
  }) => {
    await gotoWithEvents(page);
    await page.goto("/en/events");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Events");

    const cards = page.locator(".event-card");
    await expect(cards).toHaveCount(3);
    await expect(cards.nth(0)).toContainText(TIMED_TITLE);
    await expect(cards.nth(1)).toContainText(ALL_DAY_TITLE);
    await expect(cards.nth(2)).toContainText("Sample third event");

    // The all-day card shows the text badge, not a time.
    await expect(cards.nth(1).locator(".event-card__all-day")).toHaveText(
      "All-day"
    );

    // Published link renders on the timed card only; the draft link and the
    // wrong-calendar link are dropped by the join.
    await expect(cards.nth(0).locator(".event-card__project")).toBeVisible();
    await expect(cards.nth(1).locator(".event-card__project")).toHaveCount(0);
    await expect(cards.nth(2).locator(".event-card__project")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(DRAFT_PROJECT_TITLE);
    await expect(page.locator("body")).not.toContainText(
      "Wrong Calendar Project"
    );

    // The event without optional fields simply has no registration link.
    await expect(cards.nth(0).locator(".event-card__register")).toBeVisible();
    await expect(cards.nth(1).locator(".event-card__register")).toHaveCount(0);

    // D-14 note appears once for the list, not per event.
    await expect(page.locator(".events-page__note")).toHaveCount(1);

    await expectNoSeriousViolations(page);
  });

  test("the registration link is named after its event and safe", async ({
    page
  }) => {
    await gotoWithEvents(page);
    await page.goto("/en/events");

    const register = page.getByRole("link", {
      name: /Register for Sample timed event/
    });
    await expect(register).toBeVisible();
    await expect(register).toHaveAttribute(
      "href",
      "https://example.org/events/sample-timed"
    );
    await expect(register).toHaveAttribute("rel", "noopener noreferrer");
  });

  test("the project link resolves to the published project detail", async ({
    page
  }) => {
    await gotoWithEvents(page);
    await page.goto("/en/events");

    await page.getByRole("link", { name: /Sample Community Workshop/ }).click();

    await expect(page).toHaveURL(/\/en\/projects\/sample-community-workshop$/);
    await expect(
      page.getByRole("heading", { level: 1, name: PROJECT_TITLE })
    ).toBeVisible();
  });

  test("a calendar failure degrades only the events section and retry recovers", async ({
    page
  }) => {
    await mockSupabaseRest(page, {
      responses: { calendar_event_links: [], projects: PROJECTS_FIXTURE }
    });
    await mockCalendarEvents(page, { status: 502 });
    await page.goto("/en/events");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Events");
    // The persistent sr-only live region (M1) carries the same sentence, so
    // the visible failure block is addressed by its class, not by text.
    await expect(page.locator(".events-page__unavailable-text")).toBeVisible();
    await expect(page.locator(".events-page__unavailable-text")).toContainText(
      "The event calendar is temporarily unavailable."
    );

    const retry = page.getByRole("button", { name: "Try again" });
    await expect(retry).toBeVisible();

    // Page stays usable: nav landmark and the contact fallback link work.
    await expect(
      page.getByRole("link", { name: "Contact us about upcoming events" })
    ).toHaveAttribute("href", /\/en\/contact$/);

    await expectNoSeriousViolations(page);

    // Retry re-runs the request; the second attempt succeeds.
    await mockCalendarEvents(page, { events: EVENTS_SHUFFLED });
    await retry.click();
    await expect(page.locator(".event-card")).toHaveCount(3);
  });

  test("renders at 320 px without horizontal overflow", async ({ page }) => {
    await gotoWithEvents(page);
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto("/en/events");

    await expect(page.locator(".event-card")).toHaveCount(3);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(overflow).toBe(false);
  });

  // M2 (T-024 review): "works at 320 px" must be PROVEN with the strings the
  // locales actually produce — single unbroken agglutinative words, long URLs
  // and the long translated action labels, not just the English fixture copy.
  const LONG_WORDS: Record<"en" | "pl" | "uk", string> = {
    en: "SupercalifragilisticexpialidociousCommunityTheatreWorkshopSeriesRevisited",
    pl: "MiędzynarodowyWielojęzycznyWarsztatMiędzykulturowyDlaMłodzieży",
    uk: "МіжнароднийБагатомовнийЦілоденнийФестивальКультуриСусідства"
  };

  test("long unbroken translated strings fit 320 px in every locale", async ({
    page
  }) => {
    await mockSupabaseRest(page, {
      responses: { calendar_event_links: [], projects: PROJECTS_FIXTURE }
    });
    await page.setViewportSize({ width: 320, height: 640 });

    for (const locale of ["en", "pl", "uk"] as const) {
      await mockCalendarEvents(page, {
        events: [
          {
            id: `long-word-${locale}`,
            title: LONG_WORDS[locale],
            start: "2030-08-01T12:00:00+02:00",
            end: null,
            allDay: false,
            timezone: "Europe/Warsaw",
            location: LONG_WORDS[locale],
            description: `https://example.org/${"zapisy-na-wydarzenie".repeat(6)}`,
            registrationUrl: `https://example.org/${"zapisy?ref=".repeat(8)}`
          }
        ]
      });

      await page.goto(`/${locale}/events`);
      await expect(page.locator(".event-card")).toHaveCount(1);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth
      );
      expect(overflow, `320 px overflow in ${locale}`).toBe(false);
    }
  });

  test("the unavailable state's long retry/contact labels fit 320 px", async ({
    page
  }) => {
    await mockSupabaseRest(page, { responses: { calendar_event_links: [] } });
    await mockCalendarEvents(page, { status: 502 });
    await page.setViewportSize({ width: 320, height: 640 });

    await page.goto("/pl/events");
    await expect(
      page.getByRole("button", { name: "Spróbuj ponownie" })
    ).toBeVisible();
    await expect(
      page.getByRole("link", {
        name: "Skontaktuj się z nami w sprawie wydarzeń"
      })
    ).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(overflow).toBe(false);
  });

  // T-039 (D-25): section anchors + stable event card ids for search links.
  test("sections, TOC, and the stable event anchor work", async ({ page }) => {
    await mockSupabaseRest(page);
    await mockCalendarEvents(page, { events: EVENTS_SHUFFLED });
    await page.goto("/en/events");

    const toc = page.getByRole("navigation", { name: "On this page" });
    await expect(toc.getByRole("link", { name: "Upcoming" })).toBeVisible();
    await expect(toc.getByRole("link", { name: "Calendar" })).toBeVisible();
    // m10: #past is a rendered anchor target but no TOC entry while the
    // adapter cannot return past events.
    await expect(toc.getByRole("link", { name: "Past" })).toHaveCount(0);
    await expect(page.locator("section#past")).toBeVisible();

    // Stable card anchors: `event-<googleEventId>` from the fixture feed.
    await expect(page.locator("#event-fixture-event-timed")).toBeVisible();

    // Deep link lands with focus on the event card's heading.
    await page.goto("/en/events#event-fixture-event-timed");
    await expect(page.locator("#event-fixture-event-timed h3")).toBeFocused();
  });
});
