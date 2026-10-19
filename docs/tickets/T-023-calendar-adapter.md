# T-023 — Calendar adapter function

**Session:** 7 · **Lane:** integration/backend · **Owner:** @coder · **Status:** done
**Reviewers:** @reviewer + @architector
**Depends on:** T-005, D-07 · **Blocks:** T-024, T-025
**Blocked by:** D-07 (calendar ID + read-only credentials). Function and tests can be built against fixtures before credentials exist.

## Outcome
A read-only Netlify Function returns a normalized, bounded list of public events with a safe error contract and short cache policy; no credential or arbitrary calendar ID is accepted from the browser.

## Scope
In:
- `netlify/functions/calendar-events.ts` + `src/features/events/normalize.ts` (pure, shared with tests).
- Config from server env only: `GOOGLE_CALENDAR_ID`, `GOOGLE_CALENDAR_API_KEY` (or service-account JSON in a single env value). Request query params may narrow the window but never override the calendar identity.
- Validation: bounded window (e.g. max 90 days ahead, max 50 results), reject malformed params with 400.
- Normalization: `start.dateTime|start.date` (all-day), `end` fallbacks, event timezone else `Europe/Warsaw`, cancelled/deleted filtering, missing location/description/URL, HTML stripped from descriptions, registration URL extracted only if it is http(s).
- Response shape: `{ calendarId, events: NormalizedEvent[], generatedAt }` with stable IDs (`google_event_id`) and the configured calendar scope for the T-024 join, no Google-internal fields.
- Cache: `Cache-Control` short (e.g. `public, max-age=300, stale-while-revalidate=600`).
- Errors: controlled 502/500 JSON `{ error: 'calendar_unavailable' }`; never leak raw Google payloads or stack traces.
- Unit tests against fixtures: timed, all-day, no end, cancelled, missing optional fields, timezone-less, DST boundary.
- Handler test with the Google client mocked: 200 shape, 400 invalid params, 502 on upstream failure.

Out: write access, OAuth, per-locale calendars (D-14), event creation.

## Design constraints
- `docs/architecture.md` §5 (function requirements, read-only, normalization, caching, error handling, timezone).
- `docs/TESTING.md` §2 (calendar normalization unit tests).
- D-07, D-11.

## TDD plan
1. RED: `normalize.test.ts` — 8 fixture cases fail (module missing).
2. GREEN: implement normalization.
3. RED: `handler.test.ts` — invalid window → 400; upstream throw → 502 with no stack.
4. GREEN: implement handler + cache headers.
5. REFACTOR: single `NormalizedEvent` type consumed by T-024/T-025.

## Acceptance criteria
- [x] All-day events produce date-only start/end and are not shifted by timezone.
- [x] Cancelled/deleted events are excluded.
- [x] Missing `end`, location, description, and URL are handled without throwing.
- [x] Descriptions are plain text (no HTML), URLs validated as http(s).
- [x] Window and result count are bounded server-side; browser cannot change the calendar.
- [x] No secret appears in responses, logs, or the client bundle.
- [x] Cache headers present; error contract stable and documented in the ticket Log.

## Verification
```
pnpm test --run src/features/events netlify
pnpm typecheck
rg -n "GOOGLE_CALENDAR" netlify src --glob '!**/*.test.ts'
```

## Review gate
- @reviewer: secret hygiene, input validation, error leakage, fixture realism (DST, all-day).
- @architector: function stays a thin adapter; no backend creep.

## Log

### (author) start — 2026-10-19

Read first: this ticket, `docs/architecture.md` §2/§4/§5/§9, `docs/TESTING.md` §2,
`docs/tickets/DECISIONS.md` (D-07, D-11, D-14), the T-015 event→project helper
(`src/features/events/api.ts`), the E2E calendar skeleton
(`e2e/fixtures/calendar-events.ts`, `e2e/support/mocks.ts`) and house style
(`src/shared/content/result.ts`, `src/features/projects/__tests__/api.test.ts`).

### Architectural decisions applied

1. **Function location = repo root** — `netlify/functions/calendar-events.ts`, matching
   `docs/architecture.md` §2's tree and AGENTS.md. Per D-23 (review finding), the
   Netlify build base is now the **repository root** (`base = "."`), with explicit
   app install/build and publish paths, so `[functions] directory =
   "netlify/functions"` stays inside base-path resolution (no `../../`
   traversal). No new dependency: the Netlify Functions **v2 Web-standard**
   signature (`export default async (Request) => Response`) runs on Node 22
   globals, so `@netlify/functions` is unnecessary. The invocation path stays
   `/.netlify/functions/calendar-events`, already intercepted by the E2E mocks.
2. **Testable logic lives in app source** (so it is covered by vitest,
   `pnpm typecheck`, oxlint and oxfmt):
   - `src/features/events/normalize.ts` — pure normalization. No `@/` alias
     imports, because the repo-root entry imports it by relative path.
   - `src/features/events/calendarHandler.ts` — `createCalendarHandler({ config,
     fetchUpstream, now })` returning `(Request) => Promise<Response>`. It owns
     query validation, bounds, cache headers and the error contract.
   - `netlify/functions/calendar-events.ts` — binding only: `process.env` read
     per request, a `fetch`-based read-only Google Calendar v3 listing, delegate.
3. **Config names are confined to the entry.** The handler takes neutral
   `config: { calendarId, apiKey }` rather than reading `process.env`, so
   `GOOGLE_CALENDAR_*` appears in exactly one non-test file. This is what makes
   the ticket's `rg GOOGLE_CALENDAR netlify src` gate meaningful (0 hits under
   `src/`, 0 hits in the built SPA).
4. **Type-safety proof for the repo-root tree.** The app tsconfig includes
   `./../**/*` but `vue-tsc` only checks files reachable from the program;
   `test/unit/calendar-events.test.ts` imports the real entry by relative path.
   Proven by temporarily appending `const __t023Probe: number = "not-a-number";`
   to the entry: `pnpm typecheck` failed with
   `../../../netlify/functions/calendar-events.ts(108,7): error TS2322: Type 'string' is not assignable to type 'number'.`
   Reverted; typecheck green again.
5. **No `projectSlug` on the wire.** The project association is a Supabase join
   owned by T-024; `e2e/fixtures/calendar-events.ts` now aliases the adapter's
   own `NormalizedEvent` type (`export type CalendarEvent = NormalizedEvent`) so
   the mocks cannot drift from the function.
6. **D-11 / D-14 honored.** Timezone falls back to `Europe/Warsaw`; descriptions
   are emitted as-is (single-language) with no locale translation, per D-14's
   "show calendar content as-is" default. The locale note is a T-024 UI concern.

### Final wire contract

Success — `200`, `content-type: application/json; charset=utf-8`,
`cache-control: public, max-age=300, stale-while-revalidate=600`:

```json
{
  "calendarId": "public-calendar@example.org",
  "events": [
    {
      "id": "stable-google-event-id",
      "title": "Plain text",
      "start": "2030-05-14T16:00:00+02:00",
      "end": "2030-05-14T18:00:00+02:00",
      "allDay": false,
      "timezone": "Europe/Warsaw",
      "location": null,
      "description": null,
      "registrationUrl": null
    }
  ],
  "generatedAt": "2030-05-01T00:00:00.000Z"
}
```

- `calendarId` is the configured public calendar scope, top-level only (never
  duplicated on an event). It is not a secret; T-024 joins Supabase
  `calendar_event_links (calendar_id, google_event_id)` on
  `(calendarId, event.id)`.
- `start`/`end`: timed events keep Google's offset-bearing ISO 8601 verbatim;
  all-day events are date-only (`YYYY-MM-DD`) and are never timezone-shifted.
- `end` is `null` when absent. `location`/`description`/`registrationUrl` are
  `null` when absent (never omitted).
- `description` is plain text: tags, script/style bodies and entities are
  reduced. `registrationUrl` is the first validated `http(s)` URL — preferring
  a real `<a href>` (how Google Calendar actually stores links) over a bare URL.
- `timezone` is the event's own `timeZone`, else `Europe/Warsaw`.
- Cancelled/deleted events are excluded server-side; **no `cancelled` field**.
- No Google-internal fields (`kind`, `etag`, `htmlLink`, `creator`, …).
- `id` is the Google event id (`google_event_id`), the stable join key for T-024.

Query parameters (all optional; anything else, including `calendarId`/`key`, is
ignored): `from`, `to` (ISO 8601 instants), `maxResults` (integer 1–50).
Defaults: `from = now` (a past `from` is clamped to now), `to = now + 90 days`,
`maxResults = 50`. The window must be `from < to` and `to ≤ now + 90 days`.

Stable errors — `cache-control: no-store`, JSON `{ "error": <code> }`:

| Status | Code | Cause |
|---|---|---|
| 400 | `invalid_request` | malformed/out-of-range query, or inverted/oversized window |
| 405 | `method_not_allowed` | anything except `GET`/`HEAD` (`allow: GET, HEAD`) |
| 500 | `calendar_unavailable` | missing/blank `GOOGLE_CALENDAR_ID` or `GOOGLE_CALENDAR_API_KEY` (server fault) |
| 502 | `calendar_unavailable` | upstream throw, non-2xx, or malformed upstream payload |

`HEAD` returns the same status and headers as `GET` with no body. No error
response contains a stack, upstream body, or credential.

### RED evidence

1. `normalize.test.ts` before `normalize.ts` existed:
   `Error: Failed to resolve import "@/features/events/normalize" … Does the file exist?`
   → `Test Files 1 failed (1) / Tests no tests`.
2. `calendarHandler.test.ts` with `calendarHandler.ts` temporarily removed:
   `Error: Failed to resolve import "@/features/events/calendarHandler" …`
   → `Test Files 1 failed (1) / Tests no tests`.
3. `test/unit/calendar-events.test.ts` with the entry temporarily removed:
   `Error: Failed to resolve import "../../../../../netlify/functions/calendar-events" …`
   → `Test Files 1 failed (1) / Tests no tests`.
4. Two later regression tests were also seen failing before their fixes:
   - anchor-href extraction: expected `https://example.org/register`, received
     `https://example.org/about` (HTML stripping discarded the href);
   - unterminated `<script>`: expected `"Intro"`, received `"Intro alert('xss')"`.
5. Review-fix RED (before applying FIX 1/FIX 2): `10 failed | 48 passed` — the
   adapter/handler assertions for a top-level `calendarId` received `undefined`,
   and the missing-configuration cases returned `400` instead of `500`.

### GREEN evidence

- `pnpm --dir apps/web/barykadyKultury test --run src/features/events`
  → `Test Files 2 passed (2)`, `Tests 48 passed (48)`.
- `pnpm --dir apps/web/barykadyKultury test --run test/unit/calendar-events.test.ts`
  → included in `Test Files 3 passed (3)`, `Tests 58 passed (58)` when run with
  the events suite.
- `pnpm --dir apps/web/barykadyKultury test` (full suite)
  → `Test Files 62 passed (62)`, `Tests 611 passed (611)`.
- `pnpm --dir apps/web/barykadyKultury typecheck` → exit 0 (only the pre-existing
  `[vue-router] No rootDir specified` advisory).
- `pnpm --dir apps/web/barykadyKultury lint:check` → oxfmt + oxlint clean on 202
  files.
- `pnpm --dir apps/web/barykadyKultury build` → `Build succeeded`, SPA output at
  `dist/spa`.
- `pnpm build` from the repository root (D-23 config) → `Build succeeded`,
  `Output folder: apps/web/barykadyKultury/dist/spa`; the configured publish
  path `apps/web/barykadyKultury/dist/spa/index.html` exists.
- The exact Netlify command
  `pnpm --dir apps/web/barykadyKultury install --frozen-lockfile && pnpm --dir apps/web/barykadyKultury build`
  was run from the repo root → install `Done in 13.4s`, build succeeded. The
  explicit install is **not** redundant: the lockfile lives in the app workspace,
  and Netlify's automatic install only looks in `base` (the repo root, which has
  no lockfile).
- `pnpm --dir apps/web/barykadyKultury test:e2e --workers=1 --grep "external service mocks"`
  → `2 passed` (fixture contract with `calendarId`/`generatedAt`).
- **Adapter bundle smoke test** (outside the app test harness): the entry was
  bundled with the repo's esbuild exactly as Netlify does for TypeScript
  (`--bundle --platform=node --target=node22 --format=esm`), then executed in
  Node with a stubbed `fetch`. Result: `200`,
  `cache-control: public, max-age=300, stale-while-revalidate=600`, top-level
  `calendarId: "public-calendar@example.org"` with no `calendarId` on the event,
  upstream URL
  `https://www.googleapis.com/calendar/v3/calendars/public-calendar%40example.org/events`
  with the key in the query string, and the key absent from the response body.
  `node --check` accepted the bundle (≈10 KB).
- `rg -n "GOOGLE_CALENDAR" netlify src --glob '!**/*.test.ts'` (grep fallback,
  `rg` unavailable locally) → hits only in `netlify/functions/calendar-events.ts`;
  **zero** in `src/` and zero in the built `dist/spa`.

### Deviations / notes for review

- **`from` in the past is clamped, not rejected.** The UI only shows upcoming
  events (T-024) and a client clock may be behind. Any `to` beyond
  `now + 90 days` is still a hard 400.
- **Events with no id, no usable start, or a blank title are dropped** rather
  than emitted with invented placeholder copy (AGENTS.md rule 6).
- **Timed values are not re-serialized.** Google's offset string is preserved
  verbatim (rather than converting to UTC) so DST boundaries cannot shift an
  event and the browser renders it in the intended wall-clock time.
- **oxlint/typecheck coverage of the entry:** `vue-tsc` checks it (proven above).
  A standalone `oxlint` run on the entry warns `Cannot find name 'process'`
  because oxlint resolves `@types/node` from the app directory only; the app-wide
  `pnpm lint:check` does not include the repo-root file. `process.env` is correct
  for the Netlify Node 22 runtime. Reviewer may decide whether a root
  lint/tsconfig entry is warranted.
- **`netlify/functions/package.json`** (`{"type":"module"}`) was added because
  Netlify decides a `.ts` function's module format from the *closest*
  `package.json`: without `"type": "module"` the repo-root entry would be loaded
  as CommonJS and its ESM `export default` would fail. This is a runtime marker,
  not a dependency.
- **Brief path correction:** the brief's `test/unit/calendar-events.test.ts`
  import path `../../../../netlify/functions/calendar-events` resolves to
  `apps/netlify/...`; the test uses the correct five-level
  `../../../../../netlify/functions/calendar-events` (verified with `realpath`).
- Acceptance-criteria checkboxes are left unticked for the orchestrator/reviewer.

### Review findings applied

- **Calendar scope on the wire (rev-1 + arc-1):** success payload now carries the
  configured `calendarId` at the top level (never per event), so T-024 can join
  `calendar_event_links` on `(calendarId, event.id)`; handler/adapter tests and
  the E2E fixture/mocks were updated.
- **Misconfiguration is a server fault (rev-1 + arc-1):** missing/blank calendar
  id or API key now returns `500 { "error": "calendar_unavailable" }` with
  `cache-control: no-store`; `calendar_unconfigured` was removed from the error
  union and contract.
- **Deployment base moved to the repo root (arc-1):** `netlify.toml` now uses
  `base = "."`, explicit app install/build and publish paths, and
  `[functions] directory = "netlify/functions"` (D-23), removing the `../../`
  traversal outside `base`.
- **Docs recorded (rev-1 + arc-1):** D-23 added to `DECISIONS.md`; architecture
  §5 (payload/join/error contract) and §9 (root build base) updated.

