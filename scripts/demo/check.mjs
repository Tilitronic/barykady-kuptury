#!/usr/bin/env bun
/**
 * `pnpm demo:check` — read-only smoke test for a running demo environment.
 *
 * It proves the four things that can silently break the design walkthrough:
 *   1. the local database/PostgREST is reachable through the browser-safe key;
 *   2. `/en`, `/pl`, `/uk` return 200 from the dev server;
 *   3. every calendar scenario keeps the production wire contract through the
 *      same-origin dev proxy (proxy → Bun mock);
 *   4. at least one demo asset referenced by the database is public and served
 *      with the expected content type.
 *
 * This script must never seed, reset or write files. It only reads
 * `supabase status`, `.env.local`-free public endpoints and HTTP responses.
 *
 * Design authority: docs/tickets/T-037-demo-environment.md "Verification",
 * docs/tickets/HANDOFF-S8-2026-10-19.md §6/§8.
 */
import {
  CALENDAR_PATH,
  DEMO_PASSWORD,
  DEMO_USERS,
  assertSupabaseCli,
  checkBaseUrl,
  fetchWithTimeout,
  readStatus,
  trimBase
} from "./demo-lib.mjs";

const LOCALES = ["en", "pl", "uk"];

function usage() {
  console.log(`Usage: pnpm demo:check

Read-only smoke test against a running \`pnpm demo\` environment.
Set DEMO_BASE_URL to probe a dev server on another port (default
http://127.0.0.1:9000, or http://127.0.0.1:\$DEMO_DEV_PORT).

Options:
  -h, --help   show this help
`);
}

async function request(url, options = {}) {
  try {
    return await fetchWithTimeout(url, { timeoutMs: 15_000, ...options });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`request to ${url} failed: ${reason}`);
  }
}

async function responseSnippet(response) {
  try {
    return (await response.text()).slice(0, 240);
  } catch {
    return "";
  }
}

function apiBase(status) {
  return trimBase(status.apiUrl);
}

function authHeaders(status) {
  if (!status.publishableKey) {
    throw new Error(
      "`supabase status` did not report a publishable key; re-run `pnpm demo` " +
        "to rewrite .env.local."
    );
  }
  return {
    apikey: status.publishableKey,
    accept: "application/json"
  };
}

async function checkDatabase(status) {
  const response = await request(
    `${apiBase(status)}/rest/v1/site_pages?select=page_key&limit=1`,
    { headers: authHeaders(status) }
  );

  if (!response.ok) {
    throw new Error(
      `database/PostgREST check failed (${response.status}): ` +
        `${await responseSnippet(response)}\n` +
        "The local stack may be stopped or RLS may be rejecting the publishable " +
        "key. Run `pnpm demo` (or `pnpm demo:reset` for a deterministic rebuild)."
    );
  }

  const rows = await response.json();
  if (!Array.isArray(rows)) {
    throw new Error("database/PostgREST check returned an unexpected body");
  }

  return apiBase(status);
}

async function checkPages(base) {
  const checked = [];

  for (const locale of LOCALES) {
    const url = `${base}/${locale}`;
    let response;
    try {
      response = await request(url);
    } catch (error) {
      throw new Error(
        `${error.message}\n` +
          "Is the Quasar dev server running? Start the demo with `pnpm demo`, " +
          "or set DEMO_BASE_URL to the actual dev server origin."
      );
    }
    if (response.status !== 200) {
      throw new Error(
        `GET ${url} returned ${response.status}; expected 200.\n` +
          "Is the Quasar dev server running? Start the demo with `pnpm demo`, " +
          "or set DEMO_BASE_URL to the actual dev server origin."
      );
    }
    checked.push(`/${locale}`);
  }

  return checked;
}

async function checkCalendar(base) {
  const scenarios = [
    { name: "default", status: 200, events: 5 },
    { name: "empty", status: 200, events: 0 },
    { name: "unavailable", status: 502 },
    { name: "dense", status: 200, events: 20 },
    { name: "long", status: 200, events: 5, longTitle: true },
    { name: "dst", status: 200, events: 4 }
  ];

  for (const scenario of scenarios) {
    const url = `${base}${CALENDAR_PATH}?scenario=${scenario.name}`;
    let response;
    try {
      response = await request(url, {
        headers: { accept: "application/json" }
      });
    } catch (error) {
      throw new Error(
        `${error.message}\n` +
          "The dev proxy or the Bun mock is not healthy. Start/restart with " +
          "`pnpm demo`; inspect .demo/logs/calendar-mock.log and .demo/logs/dev.log."
      );
    }

    if (response.status !== scenario.status) {
      throw new Error(
        `calendar scenario "${scenario.name}" returned ${response.status}; ` +
          `expected ${scenario.status}.\n` +
          "The dev proxy or the Bun mock is not healthy. Start/restart with " +
          "`pnpm demo`; inspect .demo/logs/calendar-mock.log and .demo/logs/dev.log."
      );
    }

    const body = await response.json().catch(() => null);
    if (body === null) {
      throw new Error(
        `calendar scenario "${scenario.name}" did not return JSON`
      );
    }

    if (scenario.name === "unavailable") {
      if (body.error !== "calendar_unavailable") {
        throw new Error(
          `calendar scenario "unavailable" returned ${JSON.stringify(body)}; ` +
            'expected { "error": "calendar_unavailable" }'
        );
      }
      const cacheControl = response.headers.get("cache-control") ?? "";
      if (!cacheControl.includes("no-store")) {
        throw new Error(
          'calendar scenario "unavailable" must not be cached (cache-control: no-store)'
        );
      }
      continue;
    }

    if (typeof body.calendarId !== "string" || body.calendarId.length === 0) {
      throw new Error(
        `calendar scenario "${scenario.name}" is missing calendarId`
      );
    }
    if (!Array.isArray(body.events)) {
      throw new Error(
        `calendar scenario "${scenario.name}" is missing the events array`
      );
    }
    if (body.events.length !== scenario.events) {
      throw new Error(
        `calendar scenario "${scenario.name}" returned ${body.events.length} events; ` +
          `expected ${scenario.events}`
      );
    }

    const generatedAt = Date.parse(body.generatedAt);
    if (Number.isNaN(generatedAt)) {
      throw new Error(
        `calendar scenario "${scenario.name}" has an invalid generatedAt`
      );
    }

    if (
      scenario.longTitle &&
      !body.events.some(
        event => typeof event.title === "string" && event.title.length > 80
      )
    ) {
      throw new Error(
        'calendar scenario "long" did not include a long Polish/Ukrainian title'
      );
    }
  }

  return scenarios.map(scenario => scenario.name);
}

async function checkAsset(status) {
  const headers = authHeaders(status);
  const api = apiBase(status);

  const response = await request(
    `${api}/rest/v1/projects?select=cover_path&cover_path=not.is.null&status=eq.published&limit=1`,
    { headers }
  );

  if (!response.ok) {
    throw new Error(
      `could not read a demo asset reference (${response.status}): ` +
        `${await responseSnippet(response)}\n` +
        "Run `pnpm demo:reset` to rebuild the deterministic demo dataset."
    );
  }

  const rows = await response.json();
  const path = Array.isArray(rows) ? rows[0]?.cover_path : null;
  if (typeof path !== "string" || path.length === 0) {
    throw new Error(
      "no published demo project cover was found. The demo dataset is missing; " +
        "run `pnpm demo:reset`."
    );
  }

  const encoded = path.split("/").map(encodeURIComponent).join("/");
  const assetUrl = `${api}/storage/v1/object/public/public-media/${encoded}`;
  const asset = await request(assetUrl);

  if (asset.status !== 200) {
    throw new Error(
      `demo asset ${assetUrl} returned ${asset.status}; expected 200.\n` +
        "The Storage objects are missing. Run `pnpm demo:reset`."
    );
  }

  const contentType = (asset.headers.get("content-type") ?? "").toLowerCase();
  if (!contentType.startsWith("image/png")) {
    throw new Error(
      `demo asset ${path} returned "${contentType}"; expected image/png`
    );
  }

  return { bucket: "public-media", path, contentType };
}

/**
 * T-026 data-boundary proof against the real local stack.
 *
 * The admin guard is UX only; authorization is RLS. This check signs in as the
 * demo viewer (no `app_metadata.role`), proves the claim is absent, and then
 * proves the database rejects a write that an admin could make:
 *
 *   - INSERT into `projects` is denied (RLS `42501`, PostgREST 401/403);
 *   - UPDATE of a draft project affects zero rows (silent RLS filter);
 *   - the row is unchanged when re-read as the admin;
 *   - the admin can read the draft row, proving the claim itself works.
 *
 * The SQL-level counterpart already exists in
 * `supabase/tests/rls_content_matrix_test.sql` ("non-admin insert denied on
 * projects", "non-admin update affects no projects rows"). Together they are
 * the ticket's "SQL test + E2E" evidence: database proof plus a live
 * authenticated API proof using the demo users.
 */
async function signInDemoUser(api, status, email) {
  const response = await request(`${api}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      ...authHeaders(status),
      "content-type": "application/json"
    },
    body: JSON.stringify({ email, password: DEMO_PASSWORD })
  });

  if (!response.ok) {
    throw new Error(
      `could not sign in ${email} (${response.status}): ` +
        `${await responseSnippet(response)}\n` +
        "Run `pnpm demo` (or `pnpm demo:reset`) so the demo users exist."
    );
  }

  const body = await response.json().catch(() => null);
  if (typeof body?.access_token !== "string") {
    throw new Error(`sign-in for ${email} returned no access token`);
  }

  return {
    accessToken: body.access_token,
    role: body.user?.app_metadata?.role ?? null
  };
}

function bearerHeaders(status, accessToken) {
  return {
    ...authHeaders(status),
    authorization: `Bearer ${accessToken}`
  };
}

async function readProject(api, status, id) {
  const response = await request(
    `${api}/rest/v1/projects?id=eq.${encodeURIComponent(id)}&select=id,status,featured_rank`,
    { headers: authHeaders(status) }
  );
  if (!response.ok) {
    throw new Error(`could not read project ${id} (${response.status})`);
  }
  const rows = await response.json();
  return Array.isArray(rows) ? rows : [];
}

async function checkAuthBoundary(status) {
  const api = apiBase(status);
  const viewer = await signInDemoUser(api, status, "viewer@demo.local");
  if (viewer.role === "admin") {
    throw new Error(
      "viewer@demo.local unexpectedly carries the admin claim; demo users are wrong"
    );
  }

  const draftId = "00000000-0000-4000-8000-000000000202";

  // 1) Authenticated non-admin INSERT is denied by RLS.
  const insert = await request(`${api}/rest/v1/projects`, {
    method: "POST",
    headers: {
      ...bearerHeaders(status, viewer.accessToken),
      "content-type": "application/json",
      prefer: "return=representation"
    },
    body: JSON.stringify({
      id: "10000000-0000-4000-8000-0000000000f2",
      status: "draft"
    })
  });
  if (insert.status !== 401 && insert.status !== 403) {
    throw new Error(
      `viewer INSERT into projects returned ${insert.status}; expected 401/403. ` +
        "RLS is not enforcing admin writes at the data boundary."
    );
  }

  // 2) Authenticated non-admin UPDATE affects zero rows (RLS filters it).
  const before = await readProject(api, status, draftId);
  const update = await request(
    `${api}/rest/v1/projects?id=eq.${encodeURIComponent(draftId)}`,
    {
      method: "PATCH",
      headers: {
        ...bearerHeaders(status, viewer.accessToken),
        "content-type": "application/json",
        prefer: "return=representation"
      },
      body: JSON.stringify({ status: "archived" })
    }
  );
  const updatedRows =
    update.status === 200 ? await update.json().catch(() => null) : null;
  const denied =
    update.status === 401 ||
    update.status === 403 ||
    update.status === 204 ||
    (Array.isArray(updatedRows) && updatedRows.length === 0);
  if (!denied) {
    throw new Error(
      `viewer UPDATE on a draft project returned ${update.status} with ` +
        `${Array.isArray(updatedRows) ? updatedRows.length : "non-array"} rows; ` +
        "expected a denial or zero affected rows."
    );
  }

  // 3) The row is unchanged, and the admin can read it (claim works).
  const after = await readProject(api, status, draftId);
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    throw new Error(
      "the draft project changed during the viewer write attempt; RLS is broken"
    );
  }

  const admin = await signInDemoUser(api, status, "admin@demo.local");
  if (admin.role !== "admin") {
    throw new Error(
      "admin@demo.local lacks app_metadata.role=admin; the demo admin user is wrong"
    );
  }
  const adminRead = await request(
    `${api}/rest/v1/projects?id=eq.${encodeURIComponent(draftId)}&select=id,status`,
    { headers: bearerHeaders(status, admin.accessToken) }
  );
  if (!adminRead.ok) {
    throw new Error(`admin could not read the draft project (${adminRead.status})`);
  }
  const adminRows = await adminRead.json();
  if (!Array.isArray(adminRows) || adminRows.length !== 1) {
    throw new Error(
      "admin could not read the draft project; the admin claim path is broken"
    );
  }

  return { viewer: "denied", admin: "allowed", draftId };
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    usage();
    return;
  }

  const base = checkBaseUrl();
  console.log(`demo:check: probing ${base} (read-only)`);

  assertSupabaseCli();
  const status = readStatus();
  if (!status) {
    throw new Error(
      "local Supabase is not running (no API URL from `supabase status`).\n" +
        "Start Docker Desktop and run `pnpm demo`, then re-run `pnpm demo:check`."
    );
  }

  const api = await checkDatabase(status);
  console.log(`✔ database reachable: ${api} (REST 200)`);

  const pages = await checkPages(base);
  console.log(`✔ pages: ${pages.join(", ")} → 200`);

  const scenarios = await checkCalendar(base);
  console.log(
    `✔ calendar scenarios through ${base}: ${scenarios.join(", ")}`
  );

  const asset = await checkAsset(status);
  console.log(
    `✔ demo asset: ${asset.bucket}/${asset.path} → 200 ${asset.contentType}`
  );

  const boundary = await checkAuthBoundary(status);
  console.log(
    `✔ auth boundary (T-026): viewer write denied, admin draft read allowed ` +
      `(project ${boundary.draftId})`
  );

  console.log(
    [
      "",
      "✔ demo check passed",
      `  Demo users: ${DEMO_USERS.join(", ")} (password ${DEMO_PASSWORD})`,
      "  Demo content is fictional and local-only — never migrate or deploy it.",
      ""
    ].join("\n")
  );
}

main().catch(error => {
  console.error(
    `\n✖ demo:check: ${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exit(1);
});
