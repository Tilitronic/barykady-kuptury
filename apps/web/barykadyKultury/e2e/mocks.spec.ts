import { expect } from "@playwright/test";

import {
  CALENDAR_EVENTS_FIXTURE,
  type CalendarEventsResponse
} from "./fixtures/calendar-events";
import {
  CALENDAR_EVENTS_PATH,
  mockCalendarEvents,
  mockSupabaseRest
} from "./support/mocks";
import { test } from "./support/network-guard";

/**
 * Harness self-tests: verify the documented interception seam actually returns
 * typed fixtures. These are not product journeys (T-032 owns those); they guard
 * the T-003 acceptance criterion that the mock helper intercepts the calendar
 * function with a typed fixture.
 */
test.describe("external service mocks", () => {
  test("intercepts the calendar function with the typed fixture", async ({
    page
  }) => {
    await mockCalendarEvents(page);
    await page.goto("/");

    const payload = await page.evaluate(async path => {
      const response = await fetch(path);
      return response.json();
    }, CALENDAR_EVENTS_PATH);

    expect(payload as CalendarEventsResponse).toEqual({
      events: CALENDAR_EVENTS_FIXTURE
    });
  });

  test("intercepts Supabase REST reads and defaults to empty data", async ({
    page
  }) => {
    await mockSupabaseRest(page, {
      responses: { projects: [{ slug: "fixture-project" }] }
    });
    await page.goto("/");

    const projects = await page.evaluate(async () => {
      const response = await fetch("/rest/v1/projects");
      return response.json();
    });
    const publications = await page.evaluate(async () => {
      const response = await fetch("/rest/v1/publications");
      return response.json();
    });

    expect(projects).toEqual([{ slug: "fixture-project" }]);
    expect(publications).toEqual([]);
  });
});
