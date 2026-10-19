import { describe, expect, it } from "vitest";

import { excerptText, formatEventWhen } from "@/features/events/formatEvent";
import type { NormalizedEvent } from "@/features/events/normalize";

/**
 * Date-range rendering (T-024): timed events show the localized date plus the
 * wall-clock time in the event's own timezone; all-day events show a date (or
 * an inclusive date range — Google's all-day `end` is exclusive per RFC 5545,
 * so 06-01…06-02 means "June 1") and never a time. The `datetime` attributes
 * are the machine values the `<time>` elements must carry.
 */

function event(overrides: Partial<NormalizedEvent> = {}): NormalizedEvent {
  return {
    id: "event-1",
    title: "Event",
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

describe("formatEventWhen — timed events", () => {
  it("renders date and local times in the event timezone", () => {
    const when = formatEventWhen(event(), "en")!;

    expect(when.allDay).toBe(false);
    expect(when.startText).toBe("14 May 2030, 16:00");
    expect(when.endText).toBe("18:00");
    expect(when.startAttr).toBe("2030-05-14T16:00:00+02:00");
    expect(when.endAttr).toBe("2030-05-14T18:00:00+02:00");
  });

  it("uses the requested locale (24-hour Polish time)", () => {
    const when = formatEventWhen(event(), "pl")!;

    expect(when.startText).toContain("2030");
    expect(when.startText).toContain("16:00");
    expect(when.endText).toBe("18:00");
  });

  // R1 (T-024 review): the ticket criterion is "correct in all three
  // locales". These ICU strings are stable across the pinned Node versions
  // (verified against the same full-icu build the format.test.ts assertions
  // rely on), so exact text is asserted.
  it("renders the Ukrainian timed form", () => {
    const when = formatEventWhen(event(), "uk")!;

    expect(when.startText).toBe("14 трав. 2030 р., 16:00");
    expect(when.endText).toBe("18:00");
    expect(when.startAttr).toBe("2030-05-14T16:00:00+02:00");
  });

  it("shows the end date when the event crosses midnight", () => {
    const when = formatEventWhen(
      event({
        start: "2030-05-14T22:00:00+02:00",
        end: "2030-05-15T01:00:00+02:00"
      }),
      "en"
    )!;

    expect(when.startText).toBe("14 May 2030, 22:00");
    expect(when.endText).toBe("15 May 2030, 01:00");
  });

  it("omits the end segment when there is no end", () => {
    const when = formatEventWhen(event({ end: null }), "en")!;

    expect(when.endText).toBeNull();
    expect(when.endAttr).toBeNull();
  });

  it("ignores an unparseable or non-later end instead of rendering it", () => {
    expect(
      formatEventWhen(event({ end: "nonsense" }), "en")!.endText
    ).toBeNull();
    expect(
      formatEventWhen(event({ end: "2030-05-14T15:00:00+02:00" }), "en")!
        .endText
    ).toBeNull();
  });

  it("returns null for an unparseable start", () => {
    expect(
      formatEventWhen(event({ start: "to-be-or-not-to-be" }), "en")
    ).toBeNull();
  });
});

describe("formatEventWhen — all-day events", () => {
  it("renders a date without any time", () => {
    const when = formatEventWhen(
      event({ start: "2030-06-01", end: null, allDay: true }),
      "en"
    )!;

    expect(when.allDay).toBe(true);
    expect(when.startText).toBe("1 Jun 2030");
    expect(when.startAttr).toBe("2030-06-01");
    expect(when.endText).toBeNull();
  });

  it("renders the Ukrainian all-day form", () => {
    const when = formatEventWhen(
      event({ start: "2030-06-01", end: "2030-06-04", allDay: true }),
      "uk"
    )!;

    expect(when.startText).toBe("1 черв. 2030 р.");
    expect(when.endText).toBe("3 черв. 2030 р.");
    expect(when.endAttr).toBe("2030-06-03");
  });

  it("treats Google's exclusive all-day end as one day (06-01 → 06-02 is June 1 only)", () => {
    const when = formatEventWhen(
      event({ start: "2030-06-01", end: "2030-06-02", allDay: true }),
      "en"
    )!;

    expect(when.endText).toBeNull();
  });

  it("renders an inclusive multi-day range (06-01 → 06-04 is June 1 to June 3)", () => {
    const when = formatEventWhen(
      event({ start: "2030-06-01", end: "2030-06-04", allDay: true }),
      "en"
    )!;

    expect(when.startText).toBe("1 Jun 2030");
    expect(when.endText).toBe("3 Jun 2030");
    expect(when.endAttr).toBe("2030-06-03");
  });

  it("returns null for an invalid all-day date", () => {
    expect(
      formatEventWhen(event({ start: "2030-13-45", allDay: true }), "en")
    ).toBeNull();
  });
});

describe("excerptText", () => {
  it("leaves short text untouched", () => {
    expect(excerptText("Short description.")).toBe("Short description.");
  });

  it("truncates long text at a word boundary with an ellipsis", () => {
    const text = "alpha bravo charlie delta echo foxtrot golf hotel";
    const excerpt = excerptText(text, 20);

    expect(excerpt.length).toBeLessThanOrEqual(21);
    expect(excerpt).toBe("alpha bravo charlie…");
  });

  it("collapses whitespace runs before truncating", () => {
    expect(excerptText("one\n\n  two   three", 100)).toBe("one two three");
  });
});
