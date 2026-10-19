import { describe, expect, it } from "vitest";

import {
  DEFAULT_TIMEZONE,
  normalizeEvent,
  normalizeEvents,
  type GoogleCalendarEvent
} from "@/features/events/normalize";

/**
 * Spec axis: docs/tickets/T-023-calendar-adapter.md — normalization.
 *
 * Google Calendar is an untrusted, optional-field source (docs/architecture.md
 * §5, AGENTS.md "treat Calendar descriptions as untrusted"). These tests pin the
 * normalization contract before any adapter code exists: timed vs all-day,
 * timezone fallback, cancellation, absent fields, DST safety and plain-text
 * descriptions with an http(s)-only registration URL.
 */

function timedEvent(
  overrides: Partial<GoogleCalendarEvent> = {}
): GoogleCalendarEvent {
  return {
    id: "evt-timed",
    status: "confirmed",
    summary: "Spring concert",
    start: {
      dateTime: "2030-05-14T16:00:00+02:00",
      timeZone: "Europe/Warsaw"
    },
    end: {
      dateTime: "2030-05-14T18:00:00+02:00",
      timeZone: "Europe/Warsaw"
    },
    location: "Sample venue, Warszawa",
    description: "Doors open at 15:30.",
    ...overrides
  };
}

describe("normalizeEvent — timed events", () => {
  it("maps a timed event to the minimal wire contract", () => {
    expect(normalizeEvent(timedEvent())).toEqual({
      id: "evt-timed",
      title: "Spring concert",
      start: "2030-05-14T16:00:00+02:00",
      end: "2030-05-14T18:00:00+02:00",
      allDay: false,
      timezone: "Europe/Warsaw",
      location: "Sample venue, Warszawa",
      description: "Doors open at 15:30.",
      registrationUrl: null
    });
  });

  it("does not leak Google-internal fields", () => {
    const normalized = normalizeEvent(
      timedEvent({
        kind: "calendar#event",
        etag: '"etag"',
        htmlLink: "https://calendar.google.com/event?eid=secret",
        created: "2030-01-01T00:00:00Z",
        updated: "2030-01-01T00:00:00Z",
        creator: { email: "staff@example.org" }
      })
    );

    expect(normalized).not.toBeNull();
    for (const key of Object.keys(normalized!)) {
      expect([
        "id",
        "title",
        "start",
        "end",
        "allDay",
        "timezone",
        "location",
        "description",
        "registrationUrl"
      ]).toContain(key);
    }
  });
});

describe("normalizeEvent — all-day events", () => {
  it("keeps date-only start/end and flags the event as all-day", () => {
    expect(
      normalizeEvent({
        id: "evt-all-day",
        summary: "Open day",
        start: { date: "2030-06-01" },
        end: { date: "2030-06-02" }
      })
    ).toMatchObject({
      start: "2030-06-01",
      end: "2030-06-02",
      allDay: true
    });
  });

  it("does not shift an all-day event across the Europe/Warsaw DST boundary", () => {
    // 2030-03-31 is the last Sunday of March: Warsaw jumps 02:00 → 03:00.
    const normalized = normalizeEvent({
      id: "evt-dst-all-day",
      summary: "DST day",
      start: { date: "2030-03-31" },
      end: { date: "2030-04-01" }
    });

    expect(normalized).toMatchObject({
      start: "2030-03-31",
      end: "2030-04-01",
      allDay: true,
      timezone: DEFAULT_TIMEZONE
    });
  });

  it("preserves explicit timed offsets across the DST boundary", () => {
    const normalized = normalizeEvent({
      id: "evt-dst-timed",
      summary: "Early workshop",
      start: {
        dateTime: "2030-03-31T01:30:00+01:00",
        timeZone: "Europe/Warsaw"
      },
      end: {
        dateTime: "2030-03-31T04:00:00+02:00",
        timeZone: "Europe/Warsaw"
      }
    });

    expect(normalized).toMatchObject({
      start: "2030-03-31T01:30:00+01:00",
      end: "2030-03-31T04:00:00+02:00",
      allDay: false
    });
  });
});

describe("normalizeEvent — missing fields", () => {
  it("emits end: null when the event has no end", () => {
    expect(
      normalizeEvent(
        timedEvent({
          end: undefined
        })
      )
    ).toMatchObject({ end: null });
  });

  it("emits null location, description and registrationUrl when absent", () => {
    expect(
      normalizeEvent(
        timedEvent({
          location: undefined,
          description: undefined
        })
      )
    ).toMatchObject({
      location: null,
      description: null,
      registrationUrl: null
    });
  });

  it("treats blank optional strings as absent", () => {
    expect(
      normalizeEvent(
        timedEvent({
          location: "   ",
          description: "  "
        })
      )
    ).toMatchObject({
      location: null,
      description: null,
      registrationUrl: null
    });
  });

  it("falls back to Europe/Warsaw when the event carries no timezone", () => {
    const normalized = normalizeEvent(
      timedEvent({
        start: { dateTime: "2030-05-14T16:00:00+02:00" },
        end: { dateTime: "2030-05-14T18:00:00+02:00" }
      })
    );

    expect(normalized?.timezone).toBe("Europe/Warsaw");
  });

  it("returns null for an event without an id or start", () => {
    expect(normalizeEvent(timedEvent({ id: undefined }))).toBeNull();
    expect(normalizeEvent(timedEvent({ start: undefined }))).toBeNull();
  });
});

describe("normalizeEvents — cancellation", () => {
  it("excludes cancelled events", () => {
    const events = normalizeEvents([
      timedEvent({ id: "kept" }),
      timedEvent({ id: "cancelled", status: "cancelled" }),
      timedEvent({ id: "also-cancelled", status: "CANCELLED" })
    ]);

    expect(events.map(event => event.id)).toEqual(["kept"]);
  });

  it("keeps events without a status (Google omits it for confirmed events)", () => {
    expect(
      normalizeEvents([timedEvent({ id: "no-status", status: undefined })])
    ).toHaveLength(1);
  });
});

describe("normalizeEvent — untrusted description text", () => {
  it("strips HTML tags, scripts and decodes entities", () => {
    const normalized = normalizeEvent(
      timedEvent({
        description:
          "<p>Workshop &amp; talk</p><script>alert('xss')</script>" +
          "<p>Register at https://example.org/register now.</p>"
      })
    );

    expect(normalized?.description).toContain("Workshop & talk");
    expect(normalized?.description).toContain(
      "Register at https://example.org/register now."
    );
    expect(normalized?.description).not.toContain("<");
    expect(normalized?.description).not.toContain("alert");
    expect(normalized?.description).not.toContain("xss");
  });

  it("drops the body of an unterminated script block", () => {
    const normalized = normalizeEvent(
      timedEvent({
        description: "<p>Intro</p><script>alert('xss')"
      })
    );

    expect(normalized?.description).toBe("Intro");
    expect(normalized?.description).not.toContain("alert");
  });

  it("extracts a description-embedded http(s) registration URL", () => {
    expect(
      normalizeEvent(
        timedEvent({
          description: "Free entry. Sign up: https://example.org/signup."
        })
      )?.registrationUrl
    ).toBe("https://example.org/signup");
  });

  it("extracts the href of a real Calendar anchor (Google descriptions are HTML)", () => {
    expect(
      normalizeEvent(
        timedEvent({
          description:
            '<p>Free entry.</p><p><a href="https://example.org/register">' +
            "Register here</a></p>"
        })
      )
    ).toMatchObject({
      description: "Free entry. Register here",
      registrationUrl: "https://example.org/register"
    });
  });

  it("prefers an anchor href over a later plain-text URL", () => {
    expect(
      normalizeEvent(
        timedEvent({
          description:
            '<a href="https://example.org/register">Register</a> ' +
            "More: https://example.org/about"
        })
      )?.registrationUrl
    ).toBe("https://example.org/register");
  });

  it("keeps a trailing dot that is part of an anchor href", () => {
    expect(
      normalizeEvent(
        timedEvent({
          description: '<a href="https://example.org/a.">Details</a>'
        })
      )?.registrationUrl
    ).toBe("https://example.org/a.");
  });

  it("rejects non-http(s) registration URLs", () => {
    expect(
      normalizeEvent(
        timedEvent({ description: "Sign up: ftp://example.org/signup" })
      )?.registrationUrl
    ).toBeNull();

    expect(
      normalizeEvent(
        timedEvent({ description: "Sign up: javascript:alert('xss')" })
      )?.registrationUrl
    ).toBeNull();
  });

  it("does not treat a bare hostname as a registration URL", () => {
    expect(
      normalizeEvent(
        timedEvent({ description: "Sign up at www.example.org/signup" })
      )?.registrationUrl
    ).toBeNull();
  });

  it("returns the first valid http(s) URL when earlier schemes are rejected", () => {
    expect(
      normalizeEvent(
        timedEvent({
          description:
            "Ignore javascript:alert('xss'); register at https://example.org/join"
        })
      )?.registrationUrl
    ).toBe("https://example.org/join");
  });
});
