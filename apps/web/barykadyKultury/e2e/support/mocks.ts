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
    const url = new URL(route.request().url());
    const table = url.pathname.split("/rest/v1/")[1]?.split("/")[0];

    const raw = table ? responses[table] : undefined;
    const rows: readonly unknown[] = Array.isArray(raw)
      ? (raw as readonly unknown[])
      : [];

    // PostgREST `eq` filtering, applied when the row carries the column
    // (T-040): the reader API delegates published+slug selection to the DB,
    // so a filter-blind fake handed drafts and foreign slugs to `data[0]`.
    // Rows without the field pass through — fixtures model projections that
    // legitimately omit columns (e.g. the publications-years query).
    const filters = [...url.searchParams.entries()].filter(([, value]) =>
      value.startsWith("eq.")
    );
    const payload = rows.filter(row => {
      if (typeof row !== "object" || row === null) return true;
      return filters.every(([column, value]) => {
        const cell = (row as Record<string, unknown>)[column];
        return cell === undefined || cell === value.slice(3);
      });
    });

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

/**
 * T-046 fixture: a publications editor. `importer` is included because the
 * shipped publication-publishing surface is the import page; the scenario's
 * point is that no project/team/document capability is present. The DB proof
 * that this account may write publications and not projects lives in
 * `supabase/tests/scoped_admin_matrix_test.sql`.
 */
export const PUBLICATIONS_EDITOR_AUTH_USER: E2EAuthUser = {
  ...ADMIN_AUTH_USER,
  id: "00000000-0000-4000-8000-000000000003",
  email: "editor@demo.local",
  app_metadata: {
    provider: "email",
    providers: ["email"],
    role: "editor",
    scopes: ["publications:write", "importer"]
  },
  user_metadata: { email: "editor@demo.local" }
};

/** T-046 fixture: the mirror case — project editor without import access. */
export const PROJECT_EDITOR_AUTH_USER: E2EAuthUser = {
  ...ADMIN_AUTH_USER,
  id: "00000000-0000-4000-8000-000000000004",
  email: "projects@demo.local",
  app_metadata: {
    provider: "email",
    providers: ["email"],
    role: "editor",
    scopes: ["projects:write"]
  },
  user_metadata: { email: "projects@demo.local" }
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

/* ── Search RPC (T-039) ──────────────────────────────────────────────────── */

/** Matches the PostgREST RPC endpoint for the search function. */
const SEARCH_RPC_GLOB = "**/rest/v1/rpc/search_published_content";

/** One RPC row fixture — mirrors the frozen `SearchRpcRow` wire shape. */
export interface SearchRpcRowFixture {
  kind: string;
  entity_id: string;
  title: string;
  excerpt: string | null;
  slug: string | null;
  page_key: string | null;
  rank: number;
}

export interface MockSearchRpcOptions {
  /** Rows the RPC "returns"; filtered client-side by the request's kinds. */
  rows?: SearchRpcRowFixture[];
  /** Respond 500 so the UI's content-error path is exercised. */
  fail?: boolean;
}

/**
 * Intercepts the `search_published_content` RPC. The handler parses the
 * PostgREST JSON body and honours `result_kinds` exactly like the database
 * function, so auto-filter journeys observe genuinely filtered fixtures —
 * with no live project behind them (docs/TESTING.md §2).
 */
export async function mockSearchRpc(
  page: Page,
  options: MockSearchRpcOptions = {}
): Promise<void> {
  const { rows = [], fail = false } = options;

  await page.route(SEARCH_RPC_GLOB, async (route: Route) => {
    if (fail) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "search unavailable (e2e mock)" })
      });
      return;
    }

    let kinds: string[] | null = null;
    try {
      const body = JSON.parse(route.request().postData() ?? "{}") as {
        result_kinds?: string[];
      };
      kinds = body.result_kinds ?? null;
    } catch {
      kinds = null;
    }

    const matched =
      kinds === null || kinds === undefined
        ? rows
        : rows.filter(row => kinds!.includes(row.kind));

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(matched)
    });
  });
}

/* ── Google import pipeline (T-041/T-042 review fix) ─────────────────────── */

export interface MockImportJobOptions {
  /** Terminal status the polling GET observes. */
  status?:
    | "queued"
    | "running"
    | "succeeded"
    | "unchanged"
    | "blocked"
    | "failed";
  /** Distinct job error code surfaced by the admin UI. */
  errorCode?: string | null;
  entityId?: string | null;
  summary?: unknown;
  /** Rows returned for `organization_documents` reads (reader + admin). */
  documents?: readonly unknown[];
  /** Connection metadata returned by the OAuth status action. */
  connection?: { connected: boolean; googleEmail?: string | null };
  /** Picker session response. `available:false` simulates a missing folder. */
  picker?: {
    available?: boolean;
    error?: string;
    folderId?: string;
  };
}

/**
 * Deterministic Google-import harness.
 *
 * Covers the three network surfaces the admin import route uses:
 * - `content_sync_jobs` insert + polling (the job row is the only state),
 * - the background function acknowledgement (never a real Google call),
 * - the OAuth connection status card (never a real Google consent).
 *
 * Content reads are served from fixtures and honour PostgREST `eq` filters so
 * the published-copy-unchanged journey reads the same row before and after a
 * failed sync.
 */
export async function mockImportPipeline(
  page: Page,
  options: MockImportJobOptions = {}
): Promise<void> {
  const {
    status = "succeeded",
    errorCode = null,
    entityId = "00000000-0000-4000-8000-0000000009f1",
    summary = null,
    documents = [],
    connection = { connected: true, googleEmail: "admin@demo.local" },
    picker = { available: true }
  } = options;

  const job = {
    id: "job-1",
    kind: "document",
    entity_id: entityId,
    locale: "en",
    status,
    error_code: errorCode,
    summary,
    request: {
      mode: "apply",
      kind: "document",
      fileId: "drive-1",
      locale: "en"
    },
    requested_by: ADMIN_AUTH_USER.id,
    created_at: "2030-05-01T00:00:00Z",
    updated_at: "2030-05-01T00:00:01Z",
    started_at: "2030-05-01T00:00:00Z",
    finished_at: "2030-05-01T00:00:01Z"
  };

  await page.route("**/rest/v1/content_sync_jobs*", async route => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ id: job.id })
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(job)
    });
  });

  await page.route("**/rest/v1/content_sync_runs*", async route => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]"
    });
  });

  await page.route("**/rest/v1/organization_documents*", async route => {
    const rows = filterEqRows(route.request().url(), documents);
    await fulfillRows(route, rows);
  });

  await page.route("**/rest/v1/publications*", async route => {
    const rows = filterEqRows(route.request().url(), documents);
    await fulfillRows(route, rows);
  });

  await page.route("**/rest/v1/content_assets*", async route => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]"
    });
  });

  await page.route(
    "**/.netlify/functions/google-doc-sync-background*",
    async route => {
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({ ok: true })
      });
    }
  );

  await page.route("**/.netlify/functions/google-oauth*", async route => {
    const action = new URL(route.request().url()).searchParams.get("action");
    if (action === "picker") {
      if (picker.available === false) {
        await route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({
            error: picker.error ?? "folder-not-configured"
          })
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          accessToken: "e2e-picker-token",
          folderId: picker.folderId ?? "shared-folder-1",
          appId: "1234567890",
          developerKey: "e2e-public-picker-key"
        })
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        connected: connection.connected,
        googleEmail: connection.googleEmail ?? null,
        consentStatus: connection.connected
          ? "connected"
          : "reconsent_required",
        connectedAt: connection.connected ? "2030-05-01T00:00:00Z" : null
      })
    });
  });

  await page.route("**/api/content-check*", async route => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ updateAvailable: false })
    });
  });

  await page.route("**/.netlify/functions/content-original*", async route => {
    await route.fulfill({
      status: 302,
      headers: { location: "/fixtures/original.pdf" }
    });
  });
}

function filterEqRows(
  url: string,
  rows: readonly unknown[]
): readonly unknown[] {
  const params = new URL(url).searchParams;
  const filters = [...params.entries()].filter(([, value]) =>
    value.startsWith("eq.")
  );
  return rows.filter(row => {
    if (typeof row !== "object" || row === null) return false;
    return filters.every(([column, value]) => {
      const cell = (row as Record<string, unknown>)[column];
      return cell === undefined || cell === value.slice(3);
    });
  });
}

async function fulfillRows(
  route: Route,
  rows: readonly unknown[]
): Promise<void> {
  const wantsObject = (route.request().headers()["accept"] ?? "").includes(
    "pgrst.object"
  );
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(wantsObject ? (rows[0] ?? null) : rows)
  });
}
