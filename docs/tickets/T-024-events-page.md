# T-024 — Events page

**Session:** 5 · **Lane:** feature/events · **Owner:** @designer · **Status:** todo
**Reviewers:** @reviewer + @designer
**Depends on:** T-023, T-019, T-015 · **Blocks:** T-025, T-031, T-032

## Outcome
The Events page lists upcoming public events chronologically, styled by the site, joining each event to a published project only when that project is actually public.

## Scope
In:
- Data flow: fetch normalized events (function) + event-project mappings (Supabase), join on `calendar_id` + `google_event_id`.
- Rows/cards: title, date range (all-day vs timed, locale/timezone aware), location or online note, description excerpt, registration link, project link **only if** the project is published and the translation exists.
- Ordering: soonest first; past events excluded; equal start times stable.
- States: loading (skeleton), empty ("no upcoming events"), calendar unavailable (retry + fallback link), partial data (events without mappings render normally).
- Requested-locale handling per D-14 (default: show calendar content as-is with a language note).
- Accessibility: semantic list, `<time datetime>`, link names include event title, no color-only cancelled/online status.
- Component tests: timed, all-day, no project, unpublished project (no link), event with project (link), missing fields.
- E2E with mocked function: chronological order, project link resolves, event without project renders, API failure shows fallback while page still works.

Out: calendar grid/iframe view, event creation, per-locale calendars.

## Design constraints
- `docs/PRODUCT_REQUIREMENTS.md` §4 (Events: fields, zero-or-one project, published-only links, cancelled/all-day/timezone/API-error handling), §8.
- `docs/architecture.md` §4–§5 (join, public link rules).
- `docs/DESIGN_SYSTEM.md` §6 (no iframe-only experience, `<time>`, accessible names).
- D-14.

## TDD plan
1. RED: `EventItem.test.ts` — `renders an all-day event without a time`, `omits the project link when the project is unpublished`, `renders an event with no project`.
2. GREEN: implement item + join mapper.
3. RED: `sortEvents.test.ts` — chronological, stable, past excluded, invalid date ignored.
4. RED E2E: mocked 3-event fixture renders in order; 502 fixture shows error state + retry, page still usable.
5. REFACTOR: share date-range formatting with T-019.

## Acceptance criteria
- [ ] Chronological order proven by test and E2E.
- [ ] All-day vs timed rendering correct in all three locales, `Europe/Warsaw` default.
- [ ] Project link appears only for published projects with a usable translation.
- [ ] Missing location/description/link degrade without empty labels.
- [ ] Calendar failure is isolated: error state with retry, rest of page functional.
- [ ] `<time datetime>` present; axe 0 critical/serious.
- [ ] No hard-coded event content in components.

## Verification
```
pnpm test --run src/features/events
pnpm test:e2e --grep "events"
pnpm typecheck && pnpm lint:check
```

## Review gate
- @reviewer: spec axis (field list, published-only link), timezone correctness, failure isolation.
- @designer: list rhythm, mobile scanability, all-day/timed visual distinction without color alone.

## Log
- (author) start:
