import { describe, expect, it } from "vitest";

import EventCard from "@/components/events/EventCard.vue";
import type { EventView } from "@/features/events/useEvents";
import { mountWithPlugins } from "@/test-utils/mount";

/**
 * Card axis (T-024): presentational only — the hook has already joined the
 * published project, so the card turns `project === null` into "no link" and
 * never re-implements the published-only rule. Optional fields degrade
 * silently (no empty labels), every rendered date range carries
 * `<time datetime>`, and the all-day badge is text, not color
 * (docs/DESIGN_SYSTEM.md §6).
 */

function eventView(overrides: Partial<EventView> = {}): EventView {
  return {
    id: "fixture-event-timed",
    title: "Sample timed event",
    start: "2030-05-14T16:00:00+02:00",
    end: "2030-05-14T18:00:00+02:00",
    allDay: false,
    timezone: "Europe/Warsaw",
    location: "Sample venue, Warszawa",
    description: "A plain-text description from the calendar adapter.",
    registrationUrl: "https://example.org/register",
    project: {
      calendarId: "fixture-calendar@example.org",
      googleEventId: "fixture-event-timed",
      projectId: "00000000-0000-4000-8000-000000000201",
      slug: "sample-project",
      title: "Sample Project (EN)",
      isFallback: false
    },
    ...overrides
  };
}

async function mountCard(
  event: EventView,
  options: { locale?: "en" | "pl" | "uk"; projectHref?: string | null } = {}
) {
  const {
    locale = "en",
    projectHref = `/${locale}/projects/${event.project?.slug ?? "x"}`
  } = options;

  return mountWithPlugins(EventCard, {
    locale,
    props: { event, locale, projectHref },
    initialRoute: `/${locale}/events`
  });
}

describe("EventCard", () => {
  it("renders a list item with the title as its only heading", async () => {
    const wrapper = await mountCard(eventView());

    expect(wrapper.element.tagName).toBe("LI");
    expect(wrapper.findAll("h2")).toHaveLength(1);
    expect(wrapper.get(".event-card__title").text()).toBe("Sample timed event");
  });

  it("renders a timed event with date and local time inside <time datetime>", async () => {
    const wrapper = await mountCard(eventView());

    const times = wrapper.findAll(".event-card__when time");
    expect(times).toHaveLength(2);
    expect(times[0]!.attributes("datetime")).toBe("2030-05-14T16:00:00+02:00");
    expect(times[0]!.text()).toContain("16:00");
    expect(times[1]!.attributes("datetime")).toBe("2030-05-14T18:00:00+02:00");
    expect(times[1]!.text()).toBe("18:00");
    expect(wrapper.find(".event-card__all-day").exists()).toBe(false);
  });

  it("renders an all-day event as a date range without a time", async () => {
    const wrapper = await mountCard(
      eventView({
        id: "fixture-event-all-day",
        title: "Sample all-day event",
        start: "2030-06-01",
        end: "2030-06-04",
        allDay: true
      })
    );

    expect(wrapper.get(".event-card__all-day").text()).toBe("All-day");

    const times = wrapper.findAll(".event-card__when time");
    expect(times[0]!.attributes("datetime")).toBe("2030-06-01");
    expect(times[0]!.text()).toBe("1 Jun 2030");
    expect(times[1]!.attributes("datetime")).toBe("2030-06-03");
    expect(times[1]!.text()).toBe("3 Jun 2030");
    expect(wrapper.get(".event-card__when").text()).not.toMatch(
      /\d{1,2}:\d{2}/
    );
  });

  it("announces the range relation to screen readers with the translated word (D3)", async () => {
    const wrapper = await mountCard(
      eventView({ start: "2030-06-01", end: "2030-06-04", allDay: true }),
      { locale: "pl" }
    );

    // The visible dash is decorative (aria-hidden); the SR-only separator
    // carries the relation in the reader's language: "1 czer 2030 do 3 czer
    // 2030".
    const separator = wrapper.get(".event-card__range-to");
    expect(separator.text()).toBe("do");
    const dash = wrapper.get(".event-card__when-sep");
    expect(dash.attributes("aria-hidden")).toBe("true");
  });

  it("renders no project link when the mapping was unpublished or filtered out (R2)", async () => {
    // Documented data flow: the T-015 mapper returns null for a draft,
    // archived or translation-less project, and the hook join turns that into
    // `project: null`. The card must still render the FULL event — title,
    // date, location, description, registration — with simply no project
    // action. This is the card's contract, not a degraded state.
    const wrapper = await mountCard(eventView({ project: null }), {
      projectHref: null
    });

    expect(wrapper.find(".event-card__project").exists()).toBe(false);
    expect(wrapper.get(".event-card__title").text()).toBe("Sample timed event");
    expect(wrapper.findAll(".event-card__when time")).toHaveLength(2);
    expect(wrapper.find(".event-card__location").exists()).toBe(true);
    expect(wrapper.find(".event-card__description").exists()).toBe(true);
    expect(wrapper.find(".event-card__register").exists()).toBe(true);
  });

  it("marks an English stand-in project title with the fallback note (D7)", async () => {
    const wrapper = await mountCard(
      eventView({
        project: {
          calendarId: "fixture-calendar@example.org",
          googleEventId: "fixture-event-timed",
          projectId: "00000000-0000-4000-8000-000000000201",
          slug: "sample-project",
          title: "Sample Project (EN)",
          isFallback: true
        }
      }),
      { locale: "uk" }
    );

    expect(wrapper.get(".event-card__fallback").text()).toContain(
      "англійською"
    );
  });

  it("renders the published project link with an accessible name", async () => {
    const wrapper = await mountCard(eventView());

    const link = wrapper.get(".event-card__project");
    expect(link.element.tagName).toBe("A");
    expect(link.attributes("href")).toBe("/en/projects/sample-project");
    expect(link.text()).toContain("Sample Project (EN)");
    expect(link.text()).toContain("Related project");
  });

  it("omits location, description and registration when absent — no empty labels", async () => {
    const wrapper = await mountCard(
      eventView({
        location: null,
        description: null,
        registrationUrl: null,
        project: null
      }),
      { projectHref: null }
    );

    expect(wrapper.find(".event-card__location").exists()).toBe(false);
    expect(wrapper.find(".event-card__description").exists()).toBe(false);
    expect(wrapper.find(".event-card__register").exists()).toBe(false);
    expect(wrapper.find(".event-card__project").exists()).toBe(false);
  });

  it("links registration as a safe external link named after the event", async () => {
    const wrapper = await mountCard(eventView());

    const link = wrapper.get(".event-card__register");
    expect(link.attributes("href")).toBe("https://example.org/register");
    expect(link.attributes("target")).toBe("_blank");
    expect(link.attributes("rel")).toBe("noopener noreferrer");
    expect(link.text()).toContain("Register");
    expect(link.text()).toContain("Sample timed event");
  });

  it("never labels a registration link as online (the wire has no online flag)", async () => {
    const wrapper = await mountCard(eventView());

    expect(wrapper.text()).not.toMatch(/online/i);
  });

  it("keeps the Polish card in Polish", async () => {
    const wrapper = await mountCard(eventView({ title: "Warsztat" }), {
      locale: "pl"
    });

    expect(wrapper.get(".event-card__when").text()).toContain("16:00");
    expect(wrapper.find(".event-card__all-day").exists()).toBe(false);
  });
});
