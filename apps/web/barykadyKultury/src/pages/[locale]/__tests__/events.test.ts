import { afterEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import { Quasar } from "quasar";

import EventsPage from "@/pages/[locale]/events.vue";
import type { NormalizedEvent } from "@/features/events/normalize";
import { createFakeSupabase } from "@/test-utils/fakeSupabase";
import { mountWithPlugins } from "@/test-utils/mount";

/**
 * Spec axis (T-024): the page owns the four independent states — loading
 * (skeletons, no layout shift), empty, calendar-unavailable (retry keeps the
 * page usable), and success with the D-14 language note rendered ONCE for the
 * list. Project links follow the T-019 strict-slug precedent: a fallback
 * translation links under the English prefix.
 */

const CALENDAR_ID = "fixture-calendar@example.org";

function calendarEvent(
  overrides: Partial<NormalizedEvent> = {}
): NormalizedEvent {
  return {
    id: "fixture-event-timed",
    title: "Sample timed event",
    start: "2030-05-14T16:00:00+02:00",
    end: "2030-05-14T18:00:00+02:00",
    allDay: false,
    timezone: "Europe/Warsaw",
    location: null,
    description: null,
    registrationUrl: null,
    ...overrides
  };
}

function linkRow(
  googleEventId: string,
  canonicalSlug: string,
  title: string,
  locale = "en"
) {
  return {
    calendar_id: CALENDAR_ID,
    google_event_id: googleEventId,
    project_id: "00000000-0000-4000-8000-000000000201",
    projects: {
      slug: canonicalSlug,
      status: "published",
      project_translations: [{ locale, title }]
    }
  };
}

function stubFetch(responses: () => Response | Promise<Response>) {
  const fetchImpl = vi.fn(responses);
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

async function mountPage(
  supabase: ReturnType<typeof createFakeSupabase>["client"] | null,
  locale: "en" | "pl" | "uk" = "en"
) {
  const wrapper = await mountWithPlugins(EventsPage, {
    locale,
    plugins: [Quasar],
    supabase,
    initialRoute: `/${locale}/events`,
    routes: [
      {
        path: "/:locale(en|pl|uk)/events",
        name: "events",
        component: EventsPage
      },
      {
        path: "/:locale(en|pl|uk)/projects/:slug",
        name: "project-detail",
        component: { template: "<div />" }
      },
      {
        path: "/:locale(en|pl|uk)/contact",
        name: "contact",
        component: { template: "<div />" }
      }
    ]
  });

  await flush();
  return wrapper;
}

async function flush() {
  await nextTick();
  await new Promise(resolve => setTimeout(resolve, 0));
  await nextTick();
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("events page", () => {
  it("shows skeleton placeholders while the calendar loads", async () => {
    let release: ((r: Response) => void) | undefined;
    stubFetch(() => new Promise<Response>(resolve => (release = resolve)));

    const fake = createFakeSupabase({ tables: { calendar_event_links: [] } });
    const wrapper = await mountWithPlugins(EventsPage, {
      plugins: [Quasar],
      supabase: fake.client,
      initialRoute: "/en/events",
      routes: [
        {
          path: "/:locale(en|pl|uk)/events",
          name: "events",
          component: EventsPage
        }
      ]
    });

    expect(wrapper.find('[role="status"]').exists()).toBe(true);
    expect(wrapper.get(".events-page__live").text()).toContain("Loading…");
    expect(wrapper.findAll(".q-skeleton").length).toBeGreaterThan(0);
    expect(wrapper.find(".event-card").exists()).toBe(false);

    release!(okBody([calendarEvent()]));
    await flush();
    expect(wrapper.find(".event-card").exists()).toBe(true);
  });

  it("renders upcoming events soonest-first with the D-14 note exactly once", async () => {
    stubFetch(() =>
      okBody([
        calendarEvent({
          id: "later",
          title: "Later event",
          start: "2100-07-01T10:00:00+02:00"
        }),
        calendarEvent({
          id: "soonest",
          title: "Soonest event",
          start: "2100-06-01T10:00:00+02:00"
        })
      ])
    );
    const fake = createFakeSupabase({ tables: { calendar_event_links: [] } });
    const wrapper = await mountPage(fake.client);

    const cards = wrapper.findAll(".event-card");
    expect(cards).toHaveLength(2);
    expect(cards[0]!.text()).toContain("Soonest event");
    expect(cards[1]!.text()).toContain("Later event");
    expect(wrapper.findAll(".events-page__note")).toHaveLength(1);
    expect(wrapper.get(".events-page__note").text()).toContain(
      "original language"
    );

    expect(wrapper.findAll("h1")).toHaveLength(1);
  });

  it("links a project under the rendering text's owning locale with its canonical slug", async () => {
    stubFetch(() => okBody([calendarEvent({ id: "ev-1" })]));
    const fake = createFakeSupabase({
      tables: {
        calendar_event_links: [
          linkRow("ev-1", "sample-project", "Przykladowy projekt", "pl")
        ]
      }
    });
    const wrapper = await mountPage(fake.client, "pl");

    expect(wrapper.get(".event-card__project").attributes("href")).toBe(
      "/pl/projects/sample-project"
    );

    // Now the same project only carries an English translation: the title
    // falls back to English, and because strict detail resolution 404s a
    // locale without a translation the link moves under /en. The slug stays
    // canonical; only the prefix follows the rendered text.
    const enOnly = createFakeSupabase({
      tables: {
        calendar_event_links: [
          {
            calendar_id: CALENDAR_ID,
            google_event_id: "ev-1",
            project_id: "00000000-0000-4000-8000-000000000201",
            projects: {
              slug: "sample-project",
              status: "published",
              project_translations: [
                {
                  locale: "en",
                  title: "Sample Project"
                }
              ]
            }
          }
        ]
      }
    });
    const fallbackWrapper = await mountPage(enOnly.client, "uk");

    expect(fallbackWrapper.get(".event-card__project").attributes("href")).toBe(
      "/en/projects/sample-project"
    );
  });

  it("shows the translated empty state when nothing is upcoming", async () => {
    stubFetch(() => okBody([]));
    const fake = createFakeSupabase({ tables: { calendar_event_links: [] } });
    const wrapper = await mountPage(fake.client, "pl");

    expect(wrapper.text()).toContain("Brak nadchodzących wydarzeń");
    expect(wrapper.find(".event-card").exists()).toBe(false);
  });

  it("keeps the failure block mounted with a busy retry while a retry is in flight, then moves focus to the list (M1)", async () => {
    let release: ((r: Response) => void) | undefined;
    const fetchImpl = vi
      .fn()
      .mockImplementationOnce(
        () => new Response('{"error":"calendar_unavailable"}', { status: 502 })
      )
      .mockImplementation(() => new Promise<Response>(r => (release = r)));
    vi.stubGlobal("fetch", fetchImpl);

    const fake = createFakeSupabase({ tables: { calendar_event_links: [] } });
    const wrapper = await mountPage(fake.client);

    // The wrapper is not attached to the document (VTU default), so the
    // observable contract is "focus() was called on the list element" —
    // asserted via a prototype spy instead of document.activeElement.
    const focusSpy = vi.spyOn(HTMLElement.prototype, "focus");

    await wrapper.get(".events-page__retry").trigger("click");
    await nextTick();

    // The failure block stays mounted: no skeleton swap (that would destroy
    // focus), the button is disabled and announces busy, label unchanged.
    expect(wrapper.find(".events-page__unavailable").exists()).toBe(true);
    expect(wrapper.find(".q-skeleton").exists()).toBe(false);
    const busy = wrapper.get(".events-page__retry");
    expect(busy.attributes("disabled")).toBeDefined();
    expect(busy.attributes("aria-busy")).toBe("true");
    expect(busy.text()).toBe("Try again");

    // Success: keyboard users land on the result and the live region
    // announces the outcome with the count.
    release!(okBody([calendarEvent()]));
    await flush();

    expect(wrapper.find(".event-card").exists()).toBe(true);
    expect(wrapper.get(".events-page__live").text()).toContain(
      "Upcoming events shown: 1."
    );
    expect(focusSpy.mock.contexts).toContain(
      wrapper.get(".events-list").element
    );

    // The button is interactive again in the recovered state — it is gone
    // with the failure block, and retrying no longer holds.
    expect(wrapper.find(".events-page__unavailable").exists()).toBe(false);
  });

  it("isolates a calendar failure: retry control + fallback link, page still usable", async () => {
    const fetchImpl = stubFetch(
      () => new Response('{"error":"calendar_unavailable"}', { status: 502 })
    );
    const fake = createFakeSupabase({ tables: { calendar_event_links: [] } });
    const wrapper = await mountPage(fake.client);

    expect(wrapper.get(".events-page__title").text()).toBe("Events");
    expect(wrapper.text()).toContain("temporarily unavailable");
    expect(wrapper.find(".event-card").exists()).toBe(false);

    const retry = wrapper.get(".events-page__retry");
    expect(retry.element.tagName).toBe("BUTTON");

    // Recover on retry.
    fetchImpl.mockImplementation(() => okBody([calendarEvent()]));
    await retry.trigger("click");
    await flush();

    expect(wrapper.find(".event-card").exists()).toBe(true);
    expect(fetchImpl.mock.calls.length).toBe(2);
  });

  it("still renders events when the project-link query failed (partial data)", async () => {
    stubFetch(() => okBody([calendarEvent()]));
    const fake = createFakeSupabase({ error: { message: "query failed" } });
    const wrapper = await mountPage(fake.client);

    expect(wrapper.findAll(".event-card")).toHaveLength(1);
    expect(wrapper.find(".event-card__project").exists()).toBe(false);
  });

  it("keeps the heading visible and the note absent in the unavailable state", async () => {
    stubFetch(async () => {
      throw new TypeError("offline");
    });
    const fake = createFakeSupabase({ tables: { calendar_event_links: [] } });
    const wrapper = await mountPage(fake.client);

    expect(wrapper.findAll("h1")).toHaveLength(1);
    expect(wrapper.find(".events-page__note").exists()).toBe(false);
    expect(wrapper.find(".events-page__contact").exists()).toBe(true);
  });
});
