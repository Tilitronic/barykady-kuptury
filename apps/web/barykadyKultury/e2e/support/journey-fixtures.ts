import { expect, type Page } from "@playwright/test";

import {
  CALENDAR_EVENTS_CALENDAR_ID,
  CALENDAR_EVENTS_FIXTURE,
  type CalendarEvent
} from "../fixtures/calendar-events";
import { signInWithoutMocks } from "./journey-helpers";

/**
 * T-032 — deterministic fixtures shared by the journey-matrix specs.
 *
 * The existing suites keep their fixtures local because each one documents a
 * single ticket's edge cases. The T-032 matrix needs the SAME published,
 * draft, featured and publication rows in several variants (360×640,
 * keyboard-only, axe), so the fixtures live here once. Every value is
 * clearly fictional and no row points at a live service
 * (docs/TESTING.md §2, §6).
 */

/** The ticket's mobile acceptance width (docs/TESTING.md §2 journey 12). */
export const MOBILE_VIEWPORT = { width: 360, height: 640 } as const;

export const HOME_TITLE = "Barykady Kultury";
export const EN_PROJECT_TITLE = "Sample Community Workshop (Fictional)";
export const EN_PROJECT_SLUG = "sample-community-workshop";
export const EN_PROJECT_BODY = "EN-PROJECT body.";
export const DRAFT_TITLE = "Draft Title Must Not Leak";
export const FIRST_FEATURED = "First Featured Project (Fictional)";
export const SECOND_FEATURED = "Second Featured Project (Fictional)";
export const NOT_FEATURED = "Not Featured Project";
export const PUBLICATION_TITLE = "Sample Publication (Fictional)";
export const PUBLICATION_SLUG = "sample-publication";

export const THIRD_EVENT: CalendarEvent = {
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

/** Three events, deliberately not pre-sorted: the page must sort them. */
export const HOME_EVENTS: CalendarEvent[] = [
  THIRD_EVENT,
  CALENDAR_EVENTS_FIXTURE[1]!,
  CALENDAR_EVENTS_FIXTURE[0]!
];

export const HOME_PAGE_FIXTURE = [
  {
    id: "00000000-0000-4000-8000-000000000100",
    page_key: "home",
    status: "published",
    updated_at: "2026-02-01T00:00:00Z",
    site_page_translations: [
      {
        locale: "en",
        title: HOME_TITLE,
        body: "## Who we are\n\nHOME-INTRO body rendered from site_pages.",
        meta_description: null,
        needs_review: false
      }
    ]
  }
];

/**
 * T-033 — About landing fixture for the axe/structure surface matrix.
 * Mirrors the excerpts already used by `about.spec.ts` (which deliberately
 * follows the canonical seed shape in `supabase/seed.sql`): four `## `
 * sections so PageToc and the section contract render, plus pl/uk rows with
 * null bodies to exercise the fallback note in the long-locale reflow runs.
 */
export const ABOUT_PAGE_FIXTURE = [
  {
    id: "00000000-0000-4000-8000-000000000101",
    page_key: "about",
    status: "published",
    updated_at: "2026-01-05T12:00:00Z",
    site_page_translations: [
      {
        locale: "en",
        title: "About us",
        body:
          "## Mission\n\nTo expand Ukrainian culture beyond borders and give " +
          "it the space it deserves.\n\n## History\n\nThe association was " +
          "founded by Daria Yakovleva in Poznań.\n\n## Values\n\n- Identity\n" +
          "- Education\n- Support\n- Community\n\n## Aims\n\nThe aims of the " +
          "Association are: cultural diplomacy and the promotion of " +
          "Ukrainian culture in Poland and worldwide.",
        meta_description: "About the Barykady Kultury association.",
        needs_review: false
      },
      {
        locale: "pl",
        title: "O nas",
        body: null,
        meta_description: null,
        needs_review: true
      },
      {
        locale: "uk",
        title: "Про нас",
        body: null,
        meta_description: null,
        needs_review: true
      }
    ]
  }
];

const PUBLISHED_PROJECT_BASE = {
  cover_path: null,
  start_date: null,
  end_date: null,
  created_at: "2026-01-01T00:00:00Z"
};

/** Featured rows, stored out of rank order to prove rank sorting. */
export const FEATURED_PROJECTS_FIXTURE = [
  {
    ...PUBLISHED_PROJECT_BASE,
    id: "00000000-0000-4000-8000-000000000202",
    slug: "second-featured-project",
    status: "published",
    featured_rank: 2,
    updated_at: "2026-02-02T00:00:00Z",
    project_translations: [
      {
        locale: "en",
        title: SECOND_FEATURED,
        summary: "Second in the configured order.",
        body: "B."
      }
    ]
  },
  {
    ...PUBLISHED_PROJECT_BASE,
    id: "00000000-0000-4000-8000-000000000201",
    slug: "first-featured-project",
    status: "published",
    featured_rank: 1,
    updated_at: "2026-02-01T00:00:00Z",
    project_translations: [
      {
        locale: "en",
        title: FIRST_FEATURED,
        summary: "First in the configured order.",
        body: "A."
      }
    ]
  },
  {
    ...PUBLISHED_PROJECT_BASE,
    id: "00000000-0000-4000-8000-000000000203",
    slug: "not-featured-project",
    status: "published",
    featured_rank: null,
    updated_at: "2026-02-03T00:00:00Z",
    project_translations: [
      {
        locale: "en",
        title: NOT_FEATURED,
        summary: "Newest but not featured.",
        body: "C."
      }
    ]
  },
  {
    ...PUBLISHED_PROJECT_BASE,
    id: "00000000-0000-4000-8000-000000000299",
    slug: "draft-project-leak",
    status: "draft",
    featured_rank: 0,
    updated_at: "2026-02-04T00:00:00Z",
    project_translations: [
      {
        locale: "en",
        title: DRAFT_TITLE,
        summary: "Draft summary must not leak.",
        body: "DRAFT BODY"
      }
    ]
  }
];

/** No featured rows: the homepage must fall back to most-recently updated. */
export const UNFEATURED_PROJECTS_FIXTURE = [
  {
    ...PUBLISHED_PROJECT_BASE,
    id: "00000000-0000-4000-8000-000000000203",
    slug: "not-featured-project",
    status: "published",
    featured_rank: null,
    updated_at: "2026-01-01T00:00:00Z",
    project_translations: [
      {
        locale: "en",
        title: NOT_FEATURED,
        summary: "Newest but not featured.",
        body: "C."
      }
    ]
  },
  {
    ...PUBLISHED_PROJECT_BASE,
    id: "00000000-0000-4000-8000-000000000201",
    slug: "first-featured-project",
    status: "published",
    featured_rank: null,
    updated_at: "2026-03-01T00:00:00Z",
    project_translations: [
      {
        locale: "en",
        title: FIRST_FEATURED,
        summary: "First in the configured order.",
        body: "A."
      }
    ]
  },
  {
    ...PUBLISHED_PROJECT_BASE,
    id: "00000000-0000-4000-8000-000000000202",
    slug: "second-featured-project",
    status: "published",
    featured_rank: null,
    updated_at: "2026-02-15T00:00:00Z",
    project_translations: [
      {
        locale: "en",
        title: SECOND_FEATURED,
        summary: "Second in the configured order.",
        body: "B."
      }
    ]
  },
  {
    ...PUBLISHED_PROJECT_BASE,
    id: "00000000-0000-4000-8000-000000000299",
    slug: "draft-project-leak",
    status: "draft",
    featured_rank: null,
    updated_at: "2026-02-04T00:00:00Z",
    project_translations: [
      {
        locale: "en",
        title: DRAFT_TITLE,
        summary: "Draft summary must not leak.",
        body: "DRAFT BODY"
      }
    ]
  }
];

/** Detail-page fixtures: one complete published project plus a draft leak. */
export const PROJECTS_FIXTURE = [
  {
    ...PUBLISHED_PROJECT_BASE,
    id: "00000000-0000-4000-8000-000000000201",
    slug: EN_PROJECT_SLUG,
    status: "published",
    featured_rank: 1,
    published_at: "2026-02-01T00:00:00Z",
    updated_at: "2026-02-01T00:00:00Z",
    project_translations: [
      {
        locale: "en",
        title: EN_PROJECT_TITLE,
        summary: "A fictional summary used only by local fixtures (EN).",
        body: `## About\n\n${EN_PROJECT_BODY}`
      }
    ]
  },
  {
    ...PUBLISHED_PROJECT_BASE,
    id: "00000000-0000-4000-8000-000000000202",
    slug: "sample-draft-project",
    status: "draft",
    featured_rank: null,
    published_at: null,
    updated_at: "2026-02-02T00:00:00Z",
    project_translations: [
      {
        locale: "en",
        title: DRAFT_TITLE,
        summary: "Draft summary must not leak.",
        body: "DRAFT BODY"
      }
    ]
  }
];

/** Event→project join: the timed event links, the all-day event does not. */
export const EVENT_LINKS_FIXTURE = [
  {
    calendar_id: CALENDAR_EVENTS_CALENDAR_ID,
    google_event_id: "fixture-event-timed",
    project_id: "00000000-0000-4000-8000-000000000201",
    updated_at: "2026-06-01T12:00:00.000Z",
    projects: {
      slug: EN_PROJECT_SLUG,
      status: "published",
      project_translations: [{ locale: "en", title: EN_PROJECT_TITLE }]
    }
  }
];

/** Admin event-mapping seed (published + draft assignment targets). */
export const ADMIN_EVENT_PROJECTS = [
  {
    id: "00000000-0000-4000-8000-000000000201",
    slug: EN_PROJECT_SLUG,
    status: "published" as const,
    updated_at: "2026-06-01T12:00:00.000Z",
    project_translations: [
      {
        locale: "en" as const,
        title: EN_PROJECT_TITLE,
        summary: "Summary",
        body: "Body"
      }
    ]
  },
  {
    id: "00000000-0000-4000-8000-000000000202",
    slug: "sample-draft-project",
    status: "draft" as const,
    updated_at: "2026-06-01T12:01:00.000Z",
    project_translations: [
      {
        locale: "en" as const,
        title: "Draft Project Must Not Leak",
        summary: "Summary",
        body: "Body"
      }
    ]
  }
];

/** One published publication with a public PDF (download + detail axe). */
export const PUBLICATIONS_FIXTURE = [
  {
    id: "00000000-0000-4000-8000-000000000401",
    slug: PUBLICATION_SLUG,
    status: "published",
    language: "en",
    publication_date: "2026-02-01",
    external_url: null,
    sort_order: 1,
    published_at: "2026-02-01T09:00:00Z",
    updated_at: "2026-02-01T09:00:00Z",
    publication_translations: [
      {
        locale: "en",
        title: PUBLICATION_TITLE,
        abstract: "A fictional abstract for local fixtures (EN).",
        authors: "Sample Author (Fictional)"
      }
    ],
    publication_files: [
      {
        locale: "en",
        label: "Sample PDF (English, fictional)",
        storage_path: "fixtures/publications/sample-publication-en.pdf",
        mime_type: "application/pdf",
        file_size_bytes: 12345
      }
    ]
  }
];

/** Signs in with the mocked admin fixture (call `mockSupabaseAuth` first). */
export async function signInAsAdmin(page: Page): Promise<void> {
  await signInWithoutMocks(page, "en");
}

/** Asserts the document never scrolls horizontally at the current viewport. */
export async function expectNoHorizontalOverflow(
  page: Page,
  label: string
): Promise<void> {
  const report = await page.evaluate(() => {
    const viewport = window.innerWidth;
    const offenders: string[] = [];

    for (const element of document.body.querySelectorAll<HTMLElement>("*")) {
      const box = element.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      if (box.right > viewport + 1 || box.left < -1) {
        offenders.push(
          `${element.tagName.toLowerCase()}.${String(element.className)} ` +
            `left=${Math.round(box.left)} right=${Math.round(box.right)}`
        );
        if (offenders.length === 8) break;
      }
    }

    return {
      scrollWidth: document.documentElement.scrollWidth,
      viewport,
      offenders
    };
  });

  expect(
    report.scrollWidth,
    `horizontal overflow at ${label}: scrollWidth=${report.scrollWidth} ` +
      `viewport=${report.viewport}\n${report.offenders.join("\n")}`
  ).toBeLessThanOrEqual(report.viewport);
}

/**
 * T-032 J7 — E2E-only configured-contact fixture.
 *
 * D-04 is still open, so the shipped config is empty and the public page shows
 * the "not published yet" state. The configured rendering branch must still be
 * proven end to end. The Playwright build enables
 * `VITE_E2E_CONTACT_FIXTURE=1`; the app then reads this clearly fictional
 * value from localStorage, letting one spec cover configured vs unconfigured
 * without inventing real NGO data or rebuilding between tests.
 */
export const CONTACT_FIXTURE_KEY = "bk.e2e.contact";

export const CONFIGURED_CONTACT_FIXTURE = {
  email: "e2e-contact@example.org",
  phone: "+48 000 000 000",
  address: "E2E Street 1, 00-000 Warszawa (fictional)",
  officeHours: "Mon–Fri 10:00–14:00 (fictional)"
} as const;

/** Seeds the configured contact fixture before the app boots. */
export async function seedConfiguredContact(page: Page): Promise<void> {
  await page.addInitScript(
    ({ key, value }) => localStorage.setItem(key, JSON.stringify(value)),
    { key: CONTACT_FIXTURE_KEY, value: CONFIGURED_CONTACT_FIXTURE }
  );
}
