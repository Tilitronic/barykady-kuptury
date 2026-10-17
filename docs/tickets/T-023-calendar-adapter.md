# T-023 — Calendar adapter function

**Session:** 5 · **Lane:** integration/backend · **Owner:** @coder · **Status:** todo
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
- Response shape: `{ events: NormalizedEvent[], generatedAt }` with stable IDs (`google_event_id`), no Google-internal fields.
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
- [ ] All-day events produce date-only start/end and are not shifted by timezone.
- [ ] Cancelled/deleted events are excluded.
- [ ] Missing `end`, location, description, and URL are handled without throwing.
- [ ] Descriptions are plain text (no HTML), URLs validated as http(s).
- [ ] Window and result count are bounded server-side; browser cannot change the calendar.
- [ ] No secret appears in responses, logs, or the client bundle.
- [ ] Cache headers present; error contract stable and documented in the ticket Log.

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
- (author) start:
