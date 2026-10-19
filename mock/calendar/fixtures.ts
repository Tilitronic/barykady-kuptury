/**
 * Deterministic Google Calendar fixtures for the local demo (T-037, Lane B).
 *
 * These are *raw Google Calendar v3 events*, not website wire events. The mock
 * server feeds them through the real T-023 handler/normalizer so the demo
 * exercises the same validation, stripping and error shaping as production.
 *
 * Everything is relative to an injected clock: the browser only renders
 * upcoming events (T-024), so a hard-coded date would make the demo look empty
 * as soon as it aged. Tests pass a fixed clock and assert exact ids/shapes.
 */

import type { GoogleCalendarEvent } from "../../apps/web/barykadyKultury/src/features/events/normalize";

export const CALENDAR_SCENARIOS = [
  "default",
  "empty",
  "unavailable",
  "dense",
  "long",
  "dst"
] as const;

export type CalendarScenario = (typeof CALENDAR_SCENARIOS)[number];

export function isCalendarScenario(value: string): value is CalendarScenario {
  return (CALENDAR_SCENARIOS as readonly string[]).includes(value);
}

const MINUTE_MS = 60 * 1000;

const WARSAW_ZONE = "Europe/Warsaw";

interface WarsawParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
}

interface LocalDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

const WARSAW_PARTS_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: WARSAW_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23"
});

const WARSAW_OFFSET_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: WARSAW_ZONE,
  timeZoneName: "longOffset"
});

function readPart(parts: Intl.DateTimeFormatPart[], type: string): number {
  return Number(parts.find(part => part.type === type)?.value ?? 0);
}

function warsawParts(date: Date): WarsawParts {
  const parts = WARSAW_PARTS_FORMATTER.formatToParts(date);

  return {
    year: readPart(parts, "year"),
    month: readPart(parts, "month"),
    day: readPart(parts, "day"),
    hour: readPart(parts, "hour"),
    minute: readPart(parts, "minute"),
    second: readPart(parts, "second")
  };
}

/**
 * Current Europe/Warsaw UTC offset in minutes.
 *
 * `longOffset` yields `GMT+02:00` in summer and `GMT+01:00` in winter. Parsing
 * it (instead of assuming a fixed offset) is what makes the DST scenario
 * faithful: the same local wall-clock time maps to different instants before
 * and after the spring-forward transition.
 */
function warsawOffsetMinutes(date: Date): number {
  const zoneName =
    WARSAW_OFFSET_FORMATTER.formatToParts(date).find(
      part => part.type === "timeZoneName"
    )?.value ?? "GMT+01:00";

  const match = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(zoneName);
  if (!match) return 0;

  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2] ?? 0);
  const minutes = Number(match[3] ?? 0);

  return sign * (hours * 60 + minutes);
}

/** The Europe/Warsaw calendar date `dayOffset` days after the clock date. */
function localDate(now: Date, dayOffset: number): LocalDate {
  const parts = warsawParts(now);
  const base = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  base.setUTCDate(base.getUTCDate() + dayOffset);

  return {
    year: base.getUTCFullYear(),
    month: base.getUTCMonth() + 1,
    day: base.getUTCDate()
  };
}

/**
 * Converts a Europe/Warsaw wall-clock time to an instant.
 *
 * The two-pass offset lookup converges for every time the fixtures use. Times
 * inside the spring-forward gap (02:00–02:59 local on transition day) do not
 * exist, so fixtures deliberately stay outside that range.
 */
function warsawInstant(date: LocalDate, hour: number, minute: number): Date {
  const wallClockMs = Date.UTC(
    date.year,
    date.month - 1,
    date.day,
    hour,
    minute
  );

  let instantMs = wallClockMs;
  for (let pass = 0; pass < 2; pass += 1) {
    instantMs =
      wallClockMs - warsawOffsetMinutes(new Date(instantMs)) * MINUTE_MS;
  }

  return new Date(instantMs);
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Offset-bearing ISO 8601, matching what Google emits for timed events. */
function warsawIso(date: Date): string {
  const parts = warsawParts(date);
  const offset = warsawOffsetMinutes(date);
  const sign = offset >= 0 ? "+" : "-";
  const absolute = Math.abs(offset);

  return (
    `${parts.year}-${pad(parts.month)}-${pad(parts.day)}` +
    `T${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}` +
    `${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`
  );
}

function dateOnly(date: LocalDate): string {
  return `${date.year}-${pad(date.month)}-${pad(date.day)}`;
}

function eventId(index: number): string {
  return `demo-evt-${String(index).padStart(4, "0")}`;
}

interface TimedEventOptions {
  readonly location?: string;
  readonly description?: string;
}

function timedEvent(
  id: string,
  title: string,
  now: Date,
  dayOffset: number,
  hour: number,
  minute: number,
  durationMinutes: number,
  options: TimedEventOptions = {}
): GoogleCalendarEvent {
  const day = localDate(now, dayOffset);
  const start = warsawInstant(day, hour, minute);
  const end = new Date(start.getTime() + durationMinutes * MINUTE_MS);

  return {
    id,
    summary: title,
    start: { dateTime: warsawIso(start), timeZone: WARSAW_ZONE },
    end: { dateTime: warsawIso(end), timeZone: WARSAW_ZONE },
    location: options.location,
    description: options.description
  };
}

function allDayEvent(
  id: string,
  title: string,
  now: Date,
  dayOffset: number,
  options: TimedEventOptions = {}
): GoogleCalendarEvent {
  return {
    id,
    summary: title,
    start: { date: dateOnly(localDate(now, dayOffset)), timeZone: WARSAW_ZONE },
    end: { date: dateOnly(localDate(now, dayOffset + 1)) },
    location: options.location,
    description: options.description
  };
}

const DEMO_REGISTRATION_URL = "https://example.invalid/demo/register";

/**
 * Five upcoming events. Offsets 1/2/4 days are the three the homepage shows,
 * so the "nearest three" behavior (T-024) is visible without a DB join.
 */
function defaultEvents(now: Date): GoogleCalendarEvent[] {
  return [
    timedEvent(eventId(1), "Demo: Open studio — linocut", now, 1, 17, 30, 120, {
      location: "Pracownia demo, ul. Przykładowa 1, Warszawa",
      description: "Wieczór otwarty w pracowni. Materiały zapewniamy."
    }),
    timedEvent(
      eventId(2),
      "Demo: Community print evening / Wieczór druku",
      now,
      2,
      18,
      0,
      120,
      {
        location: "Sala demo, ul. Przykładowa 2, Warszawa",
        description:
          `<p>Wspólne drukowanie i rozmowy przy herbacie.</p>` +
          `<p><a href="${DEMO_REGISTRATION_URL}">Zapisz się</a></p>`
      }
    ),
    timedEvent(eventId(3), "Demo: Zine swap", now, 4, 12, 0, 120, {
      description:
        `<p>Przynieś ziny do wymiany.</p>` +
        `<script>alert("demo")</script>` +
        `<p>Do zobaczenia!</p>`
    }),
    allDayEvent(eventId(4), "Demo: All-day open day", now, 7, {
      location: "Barykady Kultury (demo)",
      description: "Cały dzień otwarty — demo."
    }),
    timedEvent(eventId(5), "Demo: Volunteer briefing", now, 12, 16, 0, 90)
  ];
}

function denseEvents(now: Date): GoogleCalendarEvent[] {
  const events: GoogleCalendarEvent[] = [];

  for (let index = 1; index <= 20; index += 1) {
    const title =
      index % 2 === 0
        ? `Demo: Wydarzenie ${index} — spotkanie społeczności`
        : `Демо: Подія ${index} — зустріч спільноти`;

    if (index === 4 || index === 14) {
      events.push(allDayEvent(eventId(index), title, now, index));
    } else {
      events.push(
        timedEvent(eventId(index), title, now, index, 17, 0, 90, {
          location: index % 3 === 0 ? "Sala demo, Warszawa" : undefined,
          description:
            index % 5 === 0 ? "Wydarzenie demonstracyjne." : undefined
        })
      );
    }
  }

  return events;
}

const LONG_PL =
  "Demo: Międzynarodowy festiwal sztuki współczesnej i działań społecznych " +
  "w dzielnicy — spotkanie organizacyjne dla wolontariuszy, artystek i mieszkanek";

const LONG_UK =
  "Демо: Міжнародний фестиваль сучасного мистецтва та громадських дій " +
  "у районі — організаційна зустріч для волонтерів, мисткинь і мешканок";

function longEvents(now: Date): GoogleCalendarEvent[] {
  return [
    timedEvent(eventId(1), LONG_PL, now, 1, 17, 30, 120, {
      location: "Pracownia demo, ul. Przykładowa 1, Warszawa"
    }),
    timedEvent(eventId(2), LONG_UK, now, 2, 18, 0, 120, {
      location: "Демо-зала, вул. Прикладна 2, Варшава"
    }),
    timedEvent(eventId(3), `${LONG_PL} / ${LONG_UK}`, now, 3, 12, 0, 90),
    timedEvent(eventId(4), LONG_UK, now, 4, 16, 0, 90),
    allDayEvent(eventId(5), LONG_PL, now, 5)
  ];
}

function lastSundayOfMarch(year: number): number {
  // Day 0 of April is the last day of March.
  const lastDay = new Date(Date.UTC(year, 3, 0)).getUTCDate();
  const lastDate = new Date(Date.UTC(year, 2, lastDay));

  return lastDay - lastDate.getUTCDay();
}

/**
 * Next Europe/Warsaw spring-forward instant (02:00 CET → 03:00 CEST, i.e.
 * 01:00 UTC). The DST scenario can fall outside the adapter's 90-day window
 * when viewed from autumn/winter; that is intentional — it is a rendering
 * stress fixture, and the browser still sees it as upcoming.
 */
export function nextWarsawSpringForward(now: Date): Date {
  const year = warsawParts(now).year;
  const thisYear = new Date(
    Date.UTC(year, 2, lastSundayOfMarch(year), 1, 0, 0)
  );

  if (thisYear.getTime() > now.getTime()) return thisYear;

  return new Date(Date.UTC(year + 1, 2, lastSundayOfMarch(year + 1), 1, 0, 0));
}

function dstEvents(now: Date): GoogleCalendarEvent[] {
  const transition = nextWarsawSpringForward(now);
  const offsets = [-90, -30, 30, 90] as const;
  const titles = [
    "Demo: DST — 00:30 przed zmianą czasu",
    "Demo: DST — 01:30 przed zmianą czasu",
    "Demo: DST — 03:30 po zmianie czasu",
    "Demo: DST — 04:30 po zmianie czasu"
  ] as const;

  return offsets.map((offsetMinutes, index) => {
    const start = new Date(transition.getTime() + offsetMinutes * MINUTE_MS);
    const end = new Date(start.getTime() + 60 * MINUTE_MS);

    return {
      id: eventId(index + 1),
      summary: titles[index],
      start: { dateTime: warsawIso(start), timeZone: WARSAW_ZONE },
      end: { dateTime: warsawIso(end), timeZone: WARSAW_ZONE }
    };
  });
}

/**
 * Raw upstream events for a scenario. `unavailable` returns an empty list
 * because the server throws before asking for fixtures; the handler then owns
 * the 502 contract.
 */
export function buildScenarioEvents(
  scenario: CalendarScenario,
  now: Date
): GoogleCalendarEvent[] {
  switch (scenario) {
    case "default":
      return defaultEvents(now);
    case "empty":
      return [];
    case "unavailable":
      return [];
    case "dense":
      return denseEvents(now);
    case "long":
      return longEvents(now);
    case "dst":
      return dstEvents(now);
  }
}
