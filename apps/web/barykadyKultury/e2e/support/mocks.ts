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
  CALENDAR_EVENTS_CALENDAR_ID,
  CALENDAR_EVENTS_FIXTURE,
  CALENDAR_EVENTS_GENERATED_AT,
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

/** Matches Supabase Auth (GoTrue) traffic: token grant, health, logout. */
const SUPABASE_AUTH_GLOB = "**/auth/v1/**";

/**
 * Smallest deterministic PDF body (T-020): real enough for a content-type
 * assertion, no binary asset to maintain, never fetched from a live bucket.
 */
export const PDF_FIXTURE_BODY =
  "%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF";

export interface MockCalendarEventsOptions {
  /** Event list returned by the mock. Defaults to the shared fixture. */
  events?: CalendarEvent[];
  /** Calendar scope returned by the mock. Defaults to the fixture calendar. */
  calendarId?: string;
  /** Override `generatedAt`. Defaults to the fixed fixture timestamp. */
  generatedAt?: string;
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
  const {
    events = CALENDAR_EVENTS_FIXTURE,
    calendarId = CALENDAR_EVENTS_CALENDAR_ID,
    generatedAt = CALENDAR_EVENTS_GENERATED_AT,
    status = 200
  } = options;

  const body: CalendarEventsResponse = { calendarId, events, generatedAt };

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

/* ── Auth (T-026) ─────────────────────────────────────────────────────────── */

/**
 * Shape of a mock GoTrue user payload. `app_metadata` stays an open record so
 * fixtures can vary the D-17 claim (`role: "admin"` vs absent) without
 * literal-type friction.
 */
export interface E2EAuthUser {
  id: string;
  aud: string;
  role: string;
  email: string;
  phone: string;
  app_metadata: Record<string, unknown>;
  user_metadata: Record<string, unknown>;
  identities: null;
  created_at: string;
  updated_at: string;
  last_sign_in_at: string;
}

/**
 * Fixture users mirroring the lane-A demo provisioning (`admin@demo.local`
 * with the canonical D-17 claim, `viewer@demo.local` without it). These are
 * E2E-only mock payloads — the real demo users are created by
 * `supabase/seed.demo.sql` and used exclusively for manual verification.
 */
export const ADMIN_AUTH_USER: E2EAuthUser = {
  id: "00000000-0000-4000-8000-000000000001",
  aud: "authenticated",
  role: "authenticated",
  email: "admin@demo.local",
  phone: "",
  app_metadata: { provider: "email", providers: ["email"], role: "admin" },
  user_metadata: { email: "admin@demo.local" },
  identities: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  last_sign_in_at: "2026-01-01T00:00:00.000Z"
};

export const VIEWER_AUTH_USER: E2EAuthUser = {
  ...ADMIN_AUTH_USER,
  id: "00000000-0000-4000-8000-000000000002",
  email: "viewer@demo.local",
  // The whole point of the fixture: a signed-in user with NO admin claim.
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { email: "viewer@demo.local" }
};

export interface MockSupabaseAuthOptions {
  /**
   * User granted by a successful password sign-in. Defaults to the admin
   * fixture; pass `VIEWER_AUTH_USER` for the denial journey.
   */
  user?: E2EAuthUser;
  /** Reject every credential grant with GoTrue's 400 invalid_credentials. */
  rejectCredentials?: boolean;
}

/**
 * Intercepts Supabase Auth (GoTrue) traffic so admin-auth journeys exercise
 * the real `supabase-js` client — token persistence, storage restore, logout
 * — against deterministic fixtures instead of a live project
 * (docs/TESTING.md §2). The E2E build points `VITE_SUPABASE_URL` at the app
 * origin, so all auth requests are same-origin and match these globs.
 */
export async function mockSupabaseAuth(
  page: Page,
  options: MockSupabaseAuthOptions = {}
): Promise<void> {
  const { user = ADMIN_AUTH_USER, rejectCredentials = false } = options;

  await page.route(SUPABASE_AUTH_GLOB, async (route: Route) => {
    const { pathname } = new URL(route.request().url());

    // supabase-js probes /auth/v1/health once per client init.
    if (pathname.endsWith("/health")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ version: "e2e", name: "GoTrue" })
      });
      return;
    }

    if (pathname.endsWith("/token")) {
      if (rejectCredentials) {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({
            code: "invalid_credentials",
            error_code: "invalid_credentials",
            error_description: "Invalid login credentials",
            msg: "Invalid login credentials"
          })
        });
        return;
      }
      // 10 h validity: far enough out that no auto-refresh fires mid-test.
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: `e2e-access-token-${user.email}`,
          token_type: "bearer",
          expires_in: 36_000,
          expires_at: Math.floor(Date.now() / 1000) + 36_000,
          refresh_token: "e2e-refresh-token",
          user
        })
      });
      return;
    }

    if (pathname.endsWith("/logout")) {
      await route.fulfill({ status: 204 });
      return;
    }

    // Any other auth endpoint (user, factors, ...) — inert success envelope.
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({})
    });
  });
}
