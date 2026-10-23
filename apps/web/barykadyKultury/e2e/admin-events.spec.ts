import { expect, type Page } from "@playwright/test";

import {
  CALENDAR_EVENTS_CALENDAR_ID,
  CALENDAR_EVENTS_FIXTURE
} from "./fixtures/calendar-events";
import { checkA11y } from "./support/a11y";
import {
  createEventStore,
  mockEventApi,
  type EventStore
} from "./support/event-store";
import {
  ADMIN_AUTH_USER,
  mockCalendarEvents,
  mockSupabaseAuth
} from "./support/mocks";
import { test } from "./support/network-guard";

/**
 * T-031 — admin event mapping journeys.
 *
 * Covers the public-link rule end to end: a published project produces a link
 * on the public Events page, a draft does not (even though the admin may
 * assign it), unassigning removes the link, and a Calendar outage still leaves
 * the Supabase mapping list usable. All fixtures are deterministic and
 * fictional (docs/TESTING.md §2).
 */

const PUBLISHED_TITLE = "Sample Community Workshop (Fictional)";
const DRAFT_TITLE = "Draft Project Must Not Leak";
const EVENT_ID = "fixture-event-timed";
const EVENT_TITLE = "Sample timed event";

async function signInAsAdmin(page: Page): Promise<void> {
  await page.goto("/en/admin/sign-in");
  await page.getByLabel("Email").fill("admin@demo.local");
  await page.getByLabel("Password").fill("e2e-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Dashboard" })
  ).toBeVisible();
}

function projects(): EventStore["projects"] {
  return [
    {
      id: "00000000-0000-4000-8000-000000000201",
      slug: "sample-community-workshop",
      status: "published",
      updated_at: "2026-06-01T12:00:00.000Z",
      project_translations: [
        {
          locale: "en",
          title: PUBLISHED_TITLE,
          summary: "Summary",
          body: "Body"
        }
      ]
    },
    {
      id: "00000000-0000-4000-8000-000000000202",
      slug: "sample-draft-project",
      status: "draft",
      updated_at: "2026-06-01T12:01:00.000Z",
      project_translations: [
        { locale: "en", title: DRAFT_TITLE, summary: "Summary", body: "Body" }
      ]
    }
  ];
}

async function selectProject(
  page: Page,
  projectTitle: string | null
): Promise<void> {
  await page.getByTestId(`event-project-${EVENT_ID}`).click();
  await page
    .getByRole("option", {
      name: projectTitle === null ? "No project" : projectTitle,
      exact: false
    })
    .click();
}

test.describe("admin events", () => {
  test("assign published → public link; draft → no link; unassign → gone", async ({
    page
  }) => {
    await mockSupabaseAuth(page, { user: ADMIN_AUTH_USER });
    await mockCalendarEvents(page);
    const store = createEventStore({ projects: projects() });
    await mockEventApi(page, store);

    await signInAsAdmin(page);
    await page.goto("/en/admin/events");

    await expect(
      page.getByRole("heading", { level: 1, name: "Event mapping" })
    ).toBeVisible();
    await expect(page.getByTestId(`event-row-${EVENT_ID}`)).toContainText(
      EVENT_TITLE
    );
    await checkA11y(page);

    // ── Published project: a public link exists ───────────────────────────
    await selectProject(page, PUBLISHED_TITLE);
    await expect(page.getByTestId("events-status")).toHaveText(
      "Project assigned."
    );
    await expect(page.getByTestId(`event-public-link-${EVENT_ID}`)).toHaveText(
      PUBLISHED_TITLE
    );

    await page.goto("/en/events");
    await expect(
      page.getByRole("link", { name: PUBLISHED_TITLE })
    ).toBeVisible();

    // ── Draft project: assignable in admin, never public ──────────────────
    await page.goto("/en/admin/events");
    await selectProject(page, DRAFT_TITLE);
    await expect(page.getByTestId("events-status")).toHaveText(
      "Project assigned."
    );
    await expect(
      page.getByTestId(`event-no-public-link-${EVENT_ID}`)
    ).toHaveText("No public link — draft project");

    await page.goto("/en/events");
    await expect(
      page.getByRole("heading", { name: EVENT_TITLE })
    ).toBeVisible();
    await expect(page.getByRole("link", { name: DRAFT_TITLE })).toHaveCount(0);
    await expect(page.getByRole("link", { name: PUBLISHED_TITLE })).toHaveCount(
      0
    );

    // ── Unassign: the row survives but the public link disappears ─────────
    await page.goto("/en/admin/events");
    await selectProject(page, null);
    await expect(page.getByTestId("events-status")).toHaveText(
      "Project removed."
    );
    // Unassignment keeps the mapping row (project_id NULL), so the admin list
    // still has the event identity.
    await expect(page.getByTestId(`event-row-${EVENT_ID}`)).toBeVisible();

    await page.goto("/en/events");
    await expect(
      page.getByRole("heading", { name: EVENT_TITLE })
    ).toBeVisible();
    await expect(page.getByRole("link", { name: PUBLISHED_TITLE })).toHaveCount(
      0
    );
  });

  test("calendar outage shows a notice while Supabase mappings still load", async ({
    page
  }) => {
    await mockSupabaseAuth(page, { user: ADMIN_AUTH_USER });
    // The adapter's controlled failure state (T-023).
    await mockCalendarEvents(page, { status: 500 });

    const store = createEventStore({
      projects: projects(),
      links: [
        {
          calendar_id: CALENDAR_EVENTS_CALENDAR_ID,
          google_event_id: EVENT_ID,
          project_id: "00000000-0000-4000-8000-000000000201",
          updated_at: "2026-06-01T12:00:00.000Z"
        }
      ]
    });
    await mockEventApi(page, store);

    await signInAsAdmin(page);
    await page.goto("/en/admin/events");

    await expect(page.getByTestId("events-calendar-notice")).toContainText(
      "The event calendar is temporarily unavailable"
    );
    // The mapping is still listed by its stable Google event id and keeps the
    // assigned project, so an administrator can inspect/unassign it.
    const row = page.getByTestId(`event-row-${EVENT_ID}`);
    await expect(row).toBeVisible();
    await expect(row).toContainText(PUBLISHED_TITLE);
    await expect(page.getByTestId(`event-project-${EVENT_ID}`)).toHaveValue(
      /Sample Community Workshop/
    );
    await checkA11y(page);
  });

  test("the project selector is keyboard operable", async ({ page }) => {
    await mockSupabaseAuth(page, { user: ADMIN_AUTH_USER });
    await mockCalendarEvents(page);
    const store = createEventStore({ projects: projects() });
    await mockEventApi(page, store);

    await signInAsAdmin(page);
    await page.goto("/en/admin/events");

    const select = page.getByTestId(`event-project-${EVENT_ID}`);
    await select.focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");

    await expect(page.getByTestId("events-status")).toHaveText(
      "Project assigned."
    );
    await expect(page.getByTestId(`event-public-link-${EVENT_ID}`)).toHaveText(
      PUBLISHED_TITLE
    );
  });

  test("a calendar event without a mapping still renders (zero-or-one link)", async ({
    page
  }) => {
    await mockSupabaseAuth(page, { user: ADMIN_AUTH_USER });
    await mockCalendarEvents(page);
    const store = createEventStore({ projects: projects() });
    await mockEventApi(page, store);

    await signInAsAdmin(page);
    await page.goto("/en/admin/events");

    for (const event of CALENDAR_EVENTS_FIXTURE) {
      await expect(page.getByTestId(`event-row-${event.id}`)).toBeVisible();
      await expect(
        page.getByTestId(`event-no-public-link-${event.id}`)
      ).toHaveText("Not assigned");
    }
  });
});
