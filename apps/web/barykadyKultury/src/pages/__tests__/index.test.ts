import { afterEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import { Quasar } from "quasar";

import HomePage from "@/pages/[locale]/index.vue";
import type { NormalizedEvent } from "@/features/events/normalize";
import { createFakeSupabase } from "@/test-utils/fakeSupabase";
import { mountWithPlugins } from "@/test-utils/mount";

/**
 * T-025 — Homepage composition.
 *
 * Spec axis (docs/PRODUCT_REQUIREMENTS.md §5): mission from `site_pages`
 * (never literal copy), nearest upcoming events, featured projects with the
 * recent-published fallback, drafts never shown, the CTA omitted while
 * unconfigured, and per-section failure isolation — a calendar 502 must not
 * blank the mission or the projects. The h1 stays `t("home.title")` so the
 * smoke journey's identity assertion survives.
 */

// The default CTA is unconfigured; the "renders when configured" test swaps
// the mock's getter result before mounting (vi.mock factories may expose
// getters, and the page reads the binding inside a computed).
const { ctaState } = vi.hoisted(() => ({
  ctaState: { current: null as { labelKey: string; href: string } | null }
}));

vi.mock("@/config/cta", () => ({
  get homeCta() {
    return ctaState.current;
  },
  ctaIsExternal: (href: string) => /^https?:\/\//i.test(href),
  ctaInternalPath: (href: string, locale: string) => `/${locale}/${href}`
}));

const CALENDAR_ID = "fixture-calendar@example.org";

function calendarEvent(
  overrides: Partial<NormalizedEvent> = {}
): NormalizedEvent {
  return {
    id: "event-1",
    title: "Homepage event one",
    start: "2030-06-01T10:00:00+02:00",
    end: null,
    allDay: false,
    timezone: "Europe/Warsaw",
    location: null,
    description: null,
    registrationUrl: null,
    ...overrides
  };
}

const HOME_PAGE_ROW = {
  id: "00000000-0000-4000-8000-000000000100",
  page_key: "home",
  status: "published",
  updated_at: "2026-02-01T00:00:00Z",
  site_page_translations: [
    {
      locale: "en",
      slug: "home",
      title: "Barykady Kultury",
      body: "## Who we are\n\nHOME-INTRO body from site_pages.",
      meta_description: null,
      needs_review: false
    }
  ]
};

function projectRow(
  id: string,
  title: string,
  overrides: Record<string, unknown> = {}
) {
  return {
    id,
    status: "published",
    featured_rank: null,
    cover_path: null,
    start_date: null,
    end_date: null,
    updated_at: "2026-01-01T00:00:00Z",
    project_translations: [
      {
        locale: "en",
        slug: title.toLowerCase().replace(/\s+/g, "-"),
        title,
        summary: "Summary.",
        body: "Body."
      }
    ],
    ...overrides
  };
}

function stubFetch(response: Response | (() => Promise<Response>)) {
  const factory =
    typeof response === "function" ? response : () => Promise.resolve(response);
  const fetchImpl = vi.fn(factory);
  vi.stubGlobal("fetch", fetchImpl);
  return fetchImpl;
}

function okBody(events: NormalizedEvent[]) {
  return new Response(
    JSON.stringify({
      calendarId: CALENDAR_ID,
      events,
      generatedAt: "2026-01-01T00:00:00.000Z"
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}

const ROUTES = [
  { path: "/:locale(en|pl|uk)", name: "home", component: HomePage },
  ...["contact", "support", "projects", "events", "publications", "about"].map(
    segment => ({
      path: `/:locale(en|pl|uk)/${segment}`,
      name: segment,
      component: { template: "<div />" }
    })
  ),
  {
    path: "/:locale(en|pl|uk)/projects/:slug",
    name: "project-detail",
    component: { template: "<div />" }
  }
];

async function mountHome(
  tables: Record<string, readonly unknown[]>,
  options: { locale?: "en" | "pl" | "uk"; error?: { message: string } } = {}
) {
  // exactOptionalPropertyTypes: `error` may not be passed as `undefined`.
  const fake = createFakeSupabase(
    options.error ? { tables, error: options.error } : { tables }
  );
  const wrapper = await mountWithPlugins(HomePage, {
    locale: options.locale ?? "en",
    plugins: [Quasar],
    supabase: fake.client,
    initialRoute: `/${options.locale ?? "en"}`,
    routes: ROUTES
  });
  await flush();
  return { wrapper, fake };
}

// QSkeleton is used by the section skeletons; the Quasar plugin must be
// installed (same harness adaptation T-024 introduced for the Events page).

async function flush() {
  await nextTick();
  await new Promise(resolve => setTimeout(resolve, 0));
  await nextTick();
}

afterEach(() => {
  vi.unstubAllGlobals();
  ctaState.current = null;
});

describe("home page identity", () => {
  it("keeps the organization name as the single h1", async () => {
    stubFetch(okBody([]));
    const { wrapper } = await mountHome({
      site_pages: [HOME_PAGE_ROW],
      projects: []
    });

    expect(wrapper.findAll("h1")).toHaveLength(1);
    expect(wrapper.get("h1").text()).toBe("Barykady Kultury");
  });
});

// M1 (T-025 review): the homepage outline must be h1 -> four section h2s
// -> card/authored headings at h3. Card titles and mission `##` headings
// must not compete with the section headings.
it("renders a strict outline: one h1, four section h2s, card and authored headings at h3", async () => {
  stubFetch(okBody([calendarEvent()]));
  const { wrapper } = await mountHome({
    site_pages: [HOME_PAGE_ROW],
    calendar_event_links: [],
    projects: [projectRow("p1", "Alpha project")]
  });

  expect(wrapper.findAll("h1")).toHaveLength(1);
  expect(wrapper.findAll("h2").map(h => h.text())).toEqual([
    "Our mission",
    "Upcoming events",
    "Featured projects",
    "Explore"
  ]);

  // Authored "## Who we are" shifted to h3 (headingOffset 1).
  const h3s = wrapper.findAll("h3").map(h => h.text());
  expect(h3s).toContain("Who we are");
  expect(h3s).toContain("Homepage event one");
  expect(h3s).toContain("Alpha project");
  expect(wrapper.find(".event-card__title").element.tagName).toBe("H3");
  expect(wrapper.find(".project-card__title").element.tagName).toBe("H3");
});

// M3 (T-025 review): the existing localized description renders as the
// muted lede under the h1 - no invented copy.
it("renders the localized description as a lede under the h1", async () => {
  stubFetch(okBody([]));
  const { wrapper } = await mountHome({
    site_pages: [HOME_PAGE_ROW],
    projects: []
  });

  expect(wrapper.get(".home__lede").text()).toBe(
    "Official website of the Barykady Kultury association."
  );
});

describe("mission section", () => {
  it("renders the mission body from site_pages, not literal copy", async () => {
    stubFetch(okBody([]));
    const { wrapper } = await mountHome({
      site_pages: [HOME_PAGE_ROW],
      projects: []
    });

    expect(wrapper.text()).toContain("HOME-INTRO body from site_pages.");
    expect(wrapper.text()).not.toContain("Website content is being prepared.");
  });

  it("keeps the rest of the page when the mission is empty", async () => {
    stubFetch(okBody([calendarEvent()]));
    const { wrapper } = await mountHome({
      site_pages: [],
      projects: [projectRow("p1", "Alpha project")]
    });

    // M2 (T-025 review): "This page is not available." is wrong for the
    // homepage mission — the page IS available, only the story is pending.
    expect(wrapper.text()).toContain(
      "Our story is being prepared — check back soon."
    );
    expect(wrapper.findAll(".event-card")).toHaveLength(1);
    expect(wrapper.findAll(".project-card")).toHaveLength(1);
    expect(wrapper.get(".home-mission h2").text()).toBe("Our mission");
    expect(wrapper.findAll(".home-explore__link").length).toBeGreaterThan(0);
  });
});

describe("upcoming events section", () => {
  it("shows the nearest three upcoming events in order", async () => {
    stubFetch(
      okBody([
        calendarEvent({
          id: "e4",
          title: "Fourth event",
          start: "2030-09-01T10:00:00+02:00"
        }),
        calendarEvent({
          id: "e1",
          title: "First event",
          start: "2030-06-01T10:00:00+02:00"
        }),
        calendarEvent({
          id: "e3",
          title: "Third event",
          start: "2030-08-01T10:00:00+02:00"
        }),
        calendarEvent({
          id: "e2",
          title: "Second event",
          start: "2030-07-01T10:00:00+02:00"
        })
      ])
    );
    const { wrapper } = await mountHome({
      site_pages: [HOME_PAGE_ROW],
      projects: [],
      calendar_event_links: []
    });

    const cards = wrapper.findAll(".event-card");
    expect(cards).toHaveLength(3);
    expect(cards[0]!.text()).toContain("First event");
    expect(cards[1]!.text()).toContain("Second event");
    expect(cards[2]!.text()).toContain("Third event");
    expect(wrapper.text()).not.toContain("Fourth event");

    expect(
      wrapper.get(".home-events .section-shell__view-all").attributes("href")
    ).toBe("/en/events");
  });

  it("renders the translated empty state with a link to all events", async () => {
    stubFetch(okBody([]));
    const { wrapper } = await mountHome({
      site_pages: [HOME_PAGE_ROW],
      projects: [],
      calendar_event_links: []
    });

    expect(wrapper.get(".home-events__state").text()).toContain(
      "No upcoming events right now."
    );
    expect(
      wrapper.get(".home-events .section-shell__view-all").attributes("href")
    ).toBe("/en/events");
  });

  it("isolates a calendar failure: compact message + link, mission and projects intact", async () => {
    stubFetch(
      new Response('{"error":"calendar_unavailable"}', { status: 502 })
    );
    const { wrapper } = await mountHome({
      site_pages: [HOME_PAGE_ROW],
      projects: [projectRow("p1", "Alpha project")],
      calendar_event_links: []
    });

    expect(wrapper.get(".home-events__state").text()).toContain(
      "The event calendar is temporarily unavailable."
    );
    expect(
      wrapper.get(".home-events .section-shell__view-all").attributes("href")
    ).toBe("/en/events");
    expect(wrapper.text()).toContain("HOME-INTRO body from site_pages.");
    expect(wrapper.findAll(".project-card")).toHaveLength(1);
  });

  it("shows compact skeletons while the calendar loads", async () => {
    let release: ((r: Response) => void) | undefined;
    stubFetch(() => new Promise<Response>(resolve => (release = resolve)));

    const fake = createFakeSupabase({
      tables: { site_pages: [HOME_PAGE_ROW], projects: [] }
    });
    const wrapper = await mountWithPlugins(HomePage, {
      plugins: [Quasar],
      supabase: fake.client,
      initialRoute: "/en",
      routes: ROUTES
    });

    expect(wrapper.findAll(".q-skeleton").length).toBeGreaterThan(0);
    release!(okBody([calendarEvent()]));
    await flush();
    expect(wrapper.findAll(".event-card")).toHaveLength(1);
  });
});

describe("featured projects section", () => {
  it("renders featured projects in configured order and never a draft", async () => {
    stubFetch(okBody([]));
    const { wrapper } = await mountHome({
      site_pages: [HOME_PAGE_ROW],
      calendar_event_links: [],
      projects: [
        projectRow("p2", "Second featured", { featured_rank: 2 }),
        projectRow("p1", "First featured", { featured_rank: 1 }),
        projectRow("p3", "Not featured"),
        projectRow("p9", "DRAFT LEAK", {
          status: "draft",
          featured_rank: 0
        })
      ]
    });

    const cards = wrapper.findAll(".project-card");
    expect(cards).toHaveLength(2);
    expect(cards[0]!.text()).toContain("First featured");
    expect(cards[1]!.text()).toContain("Second featured");
    expect(wrapper.text()).not.toContain("DRAFT LEAK");
    expect(wrapper.text()).not.toContain("Not featured");
  });

  it("falls back to most-recently-updated published when none are featured", async () => {
    stubFetch(okBody([]));
    const { wrapper } = await mountHome({
      site_pages: [HOME_PAGE_ROW],
      calendar_event_links: [],
      projects: [
        projectRow("p1", "Oldest", { updated_at: "2026-01-01T00:00:00Z" }),
        projectRow("p2", "Newest", { updated_at: "2026-03-01T00:00:00Z" }),
        projectRow("p3", "Middle", { updated_at: "2026-02-01T00:00:00Z" })
      ]
    });

    const cards = wrapper.findAll(".project-card");
    expect(cards.map(card => card.text())).toEqual([
      expect.stringContaining("Newest"),
      expect.stringContaining("Middle"),
      expect.stringContaining("Oldest")
    ]);
  });

  it("caps the section at three projects", async () => {
    stubFetch(okBody([]));
    const { wrapper } = await mountHome({
      site_pages: [HOME_PAGE_ROW],
      calendar_event_links: [],
      projects: [
        projectRow("p1", "One", { featured_rank: 1 }),
        projectRow("p2", "Two", { featured_rank: 2 }),
        projectRow("p3", "Three", { featured_rank: 3 }),
        projectRow("p4", "Four", { featured_rank: 4 })
      ]
    });

    expect(wrapper.findAll(".project-card")).toHaveLength(3);
    expect(wrapper.text()).not.toContain("Four");
  });

  it("links cards with the strict-slug rule (fallback under English)", async () => {
    stubFetch(okBody([]));
    const enOnly = projectRow("p1", "English only", {
      project_translations: [
        {
          locale: "en",
          slug: "english-only",
          title: "English only",
          summary: "s",
          body: "b"
        }
      ]
    });
    const { wrapper } = await mountHome(
      {
        site_pages: [HOME_PAGE_ROW],
        calendar_event_links: [],
        projects: [enOnly]
      },
      { locale: "uk" }
    );

    expect(wrapper.get(".project-card__link").attributes("href")).toBe(
      "/en/projects/english-only"
    );
  });

  it("models the 16:9 cover in the projects loading skeleton", async () => {
    // The real card reserves a 16:9 cover; the skeleton must reserve the same
    // space so the swap to content causes no vertical jump (T-037 carry-over).
    let release: ((r: Response) => void) | undefined;
    stubFetch(() => new Promise<Response>(resolve => (release = resolve)));

    const fake = createFakeSupabase({
      tables: { site_pages: [HOME_PAGE_ROW], projects: [] }
    });
    const wrapper = await mountWithPlugins(HomePage, {
      plugins: [Quasar],
      supabase: fake.client,
      initialRoute: "/en",
      routes: ROUTES
    });

    const cover = wrapper.get(".home-projects .home__skeleton-cover");
    expect(cover.classes()).toContain("q-skeleton");
    // One placeholder per skeleton card (SECTION_CAP = 3).
    expect(
      wrapper.findAll(".home-projects .home__skeleton-cover")
    ).toHaveLength(3);

    release!(okBody([]));
    await flush();
  });

  it("renders the translated empty state when no project is published", async () => {
    stubFetch(okBody([]));
    const { wrapper } = await mountHome({
      site_pages: [HOME_PAGE_ROW],
      calendar_event_links: [],
      projects: []
    });

    expect(wrapper.get(".home-projects__state").text()).toContain(
      "No projects are available yet."
    );
  });
});

describe("primary CTA", () => {
  it("is omitted entirely while unconfigured (AGENTS rule 6: no invented destination)", async () => {
    stubFetch(okBody([]));
    const { wrapper } = await mountHome({
      site_pages: [HOME_PAGE_ROW],
      projects: []
    });

    expect(wrapper.find(".home__cta").exists()).toBe(false);
  });

  it("renders the configured internal destination under the active locale", async () => {
    ctaState.current = { labelKey: "nav.support", href: "support" };
    stubFetch(okBody([]));
    const { wrapper } = await mountHome(
      { site_pages: [HOME_PAGE_ROW], projects: [] },
      { locale: "pl" }
    );

    const cta = wrapper.get(".home__cta");
    expect(cta.attributes("href")).toBe("/pl/support");
    expect(cta.text()).toBe("Wesprzyj nas");
  });

  it("renders a configured external destination as a safe new-tab link", async () => {
    ctaState.current = {
      labelKey: "nav.support",
      href: "https://example.org/donate"
    };
    stubFetch(okBody([]));
    const { wrapper } = await mountHome({
      site_pages: [HOME_PAGE_ROW],
      projects: []
    });

    const cta = wrapper.get(".home__cta");
    expect(cta.attributes("href")).toBe("https://example.org/donate");
    expect(cta.attributes("target")).toBe("_blank");
    expect(cta.attributes("rel")).toBe("noopener noreferrer");
  });
});

describe("explore links", () => {
  it("routes to Publications, Contact and Support only (m3)", async () => {
    stubFetch(okBody([]));
    const { wrapper } = await mountHome({
      site_pages: [HOME_PAGE_ROW],
      projects: []
    });

    // Explore must not repeat sections already on the page: Projects and
    // Events keep their own view-all links, so they leave this list.
    for (const segment of ["publications", "contact", "support"]) {
      expect(
        wrapper.find(`.home-explore__link[href="/en/${segment}"]`).exists(),
        `link to /en/${segment}`
      ).toBe(true);
    }
    expect(
      wrapper.find(`.home-explore__link[href="/en/projects"]`).exists()
    ).toBe(false);
    expect(
      wrapper.find(`.home-explore__link[href="/en/events"]`).exists()
    ).toBe(false);

    // m2: VoiceOver list semantics.
    expect(wrapper.get(".home-explore__list").attributes("role")).toBe("list");
  });

  // m3: while the CTA is unconfigured, Support is the only route to support
  // and takes the filled-accent primary treatment once; with a configured
  // CTA it goes quiet again (one scarlet surface per view).
  it("promotes the Support explore link while the CTA is unconfigured", async () => {
    stubFetch(okBody([]));
    const { wrapper } = await mountHome({
      site_pages: [HOME_PAGE_ROW],
      projects: []
    });

    const support = wrapper.get(`.home-explore__link[href="/en/support"]`);
    expect(support.classes()).toContain("home-explore__link--primary");
    expect(
      wrapper
        .get(`.home-explore__link[href="/en/contact"]`)
        .classes()
        .includes("home-explore__link--primary")
    ).toBe(false);
  });

  it("keeps every explore link quiet once a CTA is configured", async () => {
    ctaState.current = { labelKey: "nav.support", href: "support" };
    stubFetch(okBody([]));
    const { wrapper } = await mountHome({
      site_pages: [HOME_PAGE_ROW],
      projects: []
    });

    expect(wrapper.find(".home__cta").exists()).toBe(true);
    expect(
      wrapper
        .get(`.home-explore__link[href="/en/support"]`)
        .classes()
        .includes("home-explore__link--primary")
    ).toBe(false);
  });
});
