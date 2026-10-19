/**
 * Google Calendar event normalization (T-023).
 *
 * The adapter function is the only place that talks to Google, and this module
 * is the only place that decides what a calendar event means to the website.
 * Keeping it pure has two payoffs:
 *
 * - the browser never sees Google's payload shape (docs/architecture.md §5:
 *   "return only needed event fields"), and
 * - every edge case the ticket calls out (all-day, timezone-less, DST,
 *   cancellation, HTML descriptions) is testable without a network.
 *
 * Calendar text is untrusted (AGENTS.md "treat Calendar descriptions as
 * untrusted"), so descriptions/locations are reduced to plain text and the
 * registration URL is accepted only when it is `http(s)`.
 */

/** Organization timezone fallback (D-11, docs/architecture.md §5). */
export const DEFAULT_TIMEZONE = "Europe/Warsaw";

/**
 * The fields this adapter reads from a Google Calendar v3 event.
 *
 * Google's own bookkeeping fields are listed only so fixtures can prove they
 * are dropped; normalization never copies them into the output.
 */
export interface GoogleEventDateTime {
  readonly dateTime?: string | undefined;
  readonly date?: string | undefined;
  readonly timeZone?: string | undefined;
}

export interface GoogleCalendarEvent {
  readonly id?: string | undefined;
  readonly status?: string | undefined;
  readonly summary?: string | undefined;
  readonly start?: GoogleEventDateTime | undefined;
  readonly end?: GoogleEventDateTime | undefined;
  readonly location?: string | undefined;
  readonly description?: string | undefined;

  // Google-internal fields. Declared so tests can feed realistic payloads and
  // assert they never reach the wire; deliberately not read below.
  readonly kind?: unknown;
  readonly etag?: unknown;
  readonly htmlLink?: unknown;
  readonly created?: unknown;
  readonly updated?: unknown;
  readonly creator?: unknown;
}

/** The minimal, stable event shape consumed by T-024/T-025. */
export interface NormalizedEvent {
  /** Stable Google Calendar event identifier (`google_event_id`). */
  readonly id: string;
  readonly title: string;
  /**
   * Timed events keep Google's offset-bearing ISO 8601 value verbatim.
   * All-day events use a date-only value so no timezone can shift the day.
   */
  readonly start: string;
  readonly end: string | null;
  readonly allDay: boolean;
  /** The event's own timezone, otherwise {@link DEFAULT_TIMEZONE}. */
  readonly timezone: string;
  readonly location: string | null;
  /** Plain text; HTML is stripped because Calendar descriptions are untrusted. */
  readonly description: string | null;
  /** Only a validated `http(s)` URL extracted from the description. */
  readonly registrationUrl: string | null;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Google always emits an offset for timed events. Requiring one (instead of
 * accepting a bare local timestamp) prevents the server's own timezone from
 * silently reinterpreting an event.
 */
const DATE_TIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/;

const URL_PATTERN = /\bhttps?:\/\/[^\s<>"']+/gi;

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"'
};

function decodeEntities(value: string): string {
  return value.replace(
    /&(#x?[0-9a-f]+|[a-z]+);/gi,
    (match: string, code: string) => {
      if (code.startsWith("#")) {
        const isHex = code[1]?.toLowerCase() === "x";
        const digits = isHex ? code.slice(2) : code.slice(1);
        const point = Number.parseInt(digits, isHex ? 16 : 10);

        if (!Number.isInteger(point) || point < 0 || point > 0x10ffff) {
          return match;
        }

        try {
          return String.fromCodePoint(point);
        } catch {
          return match;
        }
      }

      return NAMED_ENTITIES[code.toLowerCase()] ?? match;
    }
  );
}

/**
 * Reduces untrusted Calendar HTML to single-line plain text.
 *
 * Script/style bodies are removed with their content, not just their tags:
 * leaving `alert('xss')` behind would still be confusing text. Remaining tags
 * become spaces so block boundaries do not glue words together.
 *
 * An unterminated script/style block runs to the end of the input: a truncated
 * description must not leak its body as visible text.
 */
function toPlainText(value: string): string {
  const withoutBlocks = value
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(
      /<(script|style|template|iframe|object|embed)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
      " "
    )
    .replace(/<(script|style|template|iframe|object|embed)\b[^>]*\/\s*>/gi, " ")
    .replace(
      /<(script|style|template|iframe|object|embed)\b[^>]*>[\s\S]*$/gi,
      " "
    )
    .replace(/<[^>]*>/g, " ");

  return decodeEntities(withoutBlocks).replace(/\s+/g, " ").trim();
}

function optionalText(value: string | undefined): string | null {
  if (typeof value !== "string") return null;

  const text = toPlainText(value);
  return text === "" ? null : text;
}

function isValidDateOnly(value: string): boolean {
  if (!DATE_ONLY.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number) as [
    number,
    number,
    number
  ];
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isValidDateTime(value: string): boolean {
  return DATE_TIME.test(value) && !Number.isNaN(Date.parse(value));
}

interface StartValue {
  readonly value: string;
  readonly allDay: boolean;
}

function readStart(start: GoogleEventDateTime | undefined): StartValue | null {
  if (!start) return null;

  if (typeof start.date === "string") {
    const value = start.date.trim();
    if (isValidDateOnly(value)) return { value, allDay: true };
  }

  if (typeof start.dateTime === "string") {
    const value = start.dateTime.trim();
    if (isValidDateTime(value)) return { value, allDay: false };
  }

  return null;
}

/**
 * `end` is optional by contract. An all-day end must stay date-only and a timed
 * end must keep its offset; a mismatched or invalid value becomes `null` rather
 * than being guessed from the start.
 */
function readEnd(
  end: GoogleEventDateTime | undefined,
  allDay: boolean
): string | null {
  if (!end) return null;

  if (allDay) {
    const value = typeof end.date === "string" ? end.date.trim() : "";
    return isValidDateOnly(value) ? value : null;
  }

  const value = typeof end.dateTime === "string" ? end.dateTime.trim() : "";
  return isValidDateTime(value) ? value : null;
}

function readTimezone(
  start: GoogleEventDateTime | undefined,
  end: GoogleEventDateTime | undefined
): string {
  const startZone = start?.timeZone?.trim();
  if (startZone) return startZone;

  const endZone = end?.timeZone?.trim();
  return endZone || DEFAULT_TIMEZONE;
}

/** Removes sentence punctuation and an unbalanced closing bracket from a URL. */
function trimUrlCandidate(candidate: string): string {
  let value = candidate.replace(/[.,;:!?]+$/u, "");

  while (
    value.endsWith(")") &&
    (value.match(/\(/g)?.length ?? 0) < (value.match(/\)/g)?.length ?? 0)
  ) {
    value = value.slice(0, -1).replace(/[.,;:!?]+$/u, "");
  }

  return value;
}

/**
 * Extracts the first `http(s)` URL from a description.
 *
 * Google Calendar descriptions are HTML, and the common registration pattern is
 * `<a href="…">Register</a>`. Stripping tags first would throw the href away, so
 * anchors are inspected in the raw markup and only their `href` value is kept.
 * Plain-text URLs are the fallback for descriptions that paste a bare link.
 *
 * Only `http:`/`https:` survive validation; a `javascript:`/`ftp:` candidate is
 * ignored, not passed through.
 */
function extractRegistrationUrl(
  rawDescription: string | undefined,
  description: string | null
): string | null {
  if (typeof rawDescription === "string") {
    // Google emits double-quoted attributes; single quotes are accepted because
    // descriptions are hand-written HTML and both forms occur in practice.
    const anchorPattern = /<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;

    for (const match of rawDescription.matchAll(anchorPattern)) {
      // An attribute value is already delimited, so it is NOT sentence-trimmed:
      // trailing dots/brackets may legitimately belong to the URL.
      const candidate = decodeEntities(match[1] ?? match[2] ?? "");

      try {
        const url = new URL(candidate);
        if (url.protocol === "http:" || url.protocol === "https:") {
          return url.toString();
        }
      } catch {
        // Not a parseable absolute URL; try the next anchor.
      }
    }
  }

  if (!description) return null;

  for (const match of description.matchAll(URL_PATTERN)) {
    const candidate = trimUrlCandidate(match[0]);

    try {
      const url = new URL(candidate);
      if (url.protocol === "http:" || url.protocol === "https:") {
        return url.toString();
      }
    } catch {
      // Not a parseable absolute URL; try the next candidate.
    }
  }

  return null;
}

/**
 * Normalizes one Google event, or returns `null` when it cannot be shown.
 *
 * Excluded cases:
 * - cancelled events (deleted events arrive as cancelled);
 * - an event without a usable stable id, start, or title. A title-less event
 *   has nothing accessible to render and inventing placeholder copy is
 *   forbidden (AGENTS.md rule 6), so it is dropped instead.
 */
export function normalizeEvent(
  raw: GoogleCalendarEvent
): NormalizedEvent | null {
  const status =
    typeof raw.status === "string" ? raw.status.trim().toLowerCase() : "";
  if (status === "cancelled") return null;

  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  if (id === "") return null;

  const start = readStart(raw.start);
  if (!start) return null;

  const title = typeof raw.summary === "string" ? toPlainText(raw.summary) : "";
  if (title === "") return null;

  const description = optionalText(raw.description);

  return {
    id,
    title,
    start: start.value,
    end: readEnd(raw.end, start.allDay),
    allDay: start.allDay,
    timezone: readTimezone(raw.start, raw.end),
    location: optionalText(raw.location),
    description,
    registrationUrl: extractRegistrationUrl(raw.description, description)
  };
}

/** Normalizes a list, dropping cancelled/unusable events and preserving order. */
export function normalizeEvents(
  rawEvents: readonly GoogleCalendarEvent[]
): NormalizedEvent[] {
  const events: NormalizedEvent[] = [];

  for (const raw of rawEvents) {
    const event = normalizeEvent(raw);
    if (event) events.push(event);
  }

  return events;
}
