/**
 * Network interception helpers for E2E tests.
 *
 * docs/TESTING.md §2 requires E2E tests to be deterministic and to never touch
 * a live Google Calendar or production Supabase project. Every journey installs
 * these mocks before navigating so the application under test only ever talks
 * to fixtures. This module is intentionally a stable seam: T-023 wires the
 * calendar adapter contract and T-032 grows the Supabase fixtures without
 * changing how specs call these helpers.
 */

import type { Page, Route } from "@playwright/test";

import {
  CALENDAR_EVENTS_FIXTURE,
  type CalendarEvent,
  type CalendarEventsResponse
} from "../fixtures/calendar-events";

/** Path of the read-only Calendar adapter Netlify Function. */
export const CALENDAR_EVENTS_PATH = "/.netlify/functions/calendar-events";

/** Matches absolute or relative requests to the calendar adapter. */
const CALENDAR_EVENTS_GLOB = `**${CALENDAR_EVENTS_PATH}*`;

/** Matches Supabase's REST/PostgREST endpoint surface. */
const SUPABASE_REST_GLOB = "**/rest/v1/**";

/** Matches Supabase Storage public object reads (`/storage/v1/object/...`). */
const SUPABASE_STORAGE_GLOB = "**/storage/v1/object/**";

/**
 * Smallest deterministic PDF body (T-020): real enough for a content-type
 * assertion, no binary asset to maintain, never fetched from a live bucket.
 */
export const PDF_FIXTURE_BODY =
  "%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF";

export interface MockCalendarEventsOptions {
  /** Event list returned by the mock. Defaults to the shared fixture. */
  events?: CalendarEvent[];
  /** Override the HTTP status to exercise error states. */
  status?: number;
}

/**
 * Intercepts `/.netlify/functions/calendar-events` and fulfills it with the
 * typed fixture, so the app never reaches Google.
 */
export async function mockCalendarEvents(
  page: Page,
  options: MockCalendarEventsOptions = {}
): Promise<void> {
  const { events = CALENDAR_EVENTS_FIXTURE, status = 200 } = options;

  const body: CalendarEventsResponse = { events };

  await page.route(CALENDAR_EVENTS_GLOB, async (route: Route) => {
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body)
    });
  });
}

export interface MockSupabaseRestOptions {
  /**
   * Per-table response bodies keyed by table name (the segment after
   * `/rest/v1/`). Unlisted tables resolve to an empty array, which is the
   * correct anonymous default for the deny-by-default RLS model.
   */
  responses?: Record<string, unknown>;
  /** Override the HTTP status to exercise error states. */
  status?: number;
}

/**
 * Skeleton interception of Supabase REST reads (`/rest/v1/<table>`). T-032
 * supplies per-journey table fixtures; the default keeps anonymous reads
 * offline and deterministic.
 */
export async function mockSupabaseRest(
  page: Page,
  options: MockSupabaseRestOptions = {}
): Promise<void> {
  const { responses = {}, status = 200 } = options;

  await page.route(SUPABASE_REST_GLOB, async (route: Route) => {
    const table = new URL(route.request().url()).pathname
      .split("/rest/v1/")[1]
      ?.split("/")[0];

    const payload = (table ? responses[table] : undefined) ?? [];

    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(payload)
    });
  });
}

export interface MockSupabaseStorageOptions {
  /** Body served for every public object read. Defaults to the PDF fixture. */
  body?: string;
  /** Served `Content-Type`. Defaults to `application/pdf`. */
  contentType?: string;
  /** Override the HTTP status to exercise error states. */
  status?: number;
}

/**
 * Intercepts Supabase Storage public object reads (`/storage/v1/object/**`)
 * so E2E download journeys never touch a live bucket (docs/TESTING.md §2).
 * The `?download=` query is ignored — the app builds it, the test asserts
 * the response, and the browser-side disposition is out of scope offline.
 */
export async function mockSupabaseStorage(
  page: Page,
  options: MockSupabaseStorageOptions = {}
): Promise<void> {
  const {
    body = PDF_FIXTURE_BODY,
    contentType = "application/pdf",
    status = 200
  } = options;

  await page.route(SUPABASE_STORAGE_GLOB, async (route: Route) => {
    await route.fulfill({
      status,
      contentType,
      body
    });
  });
}
