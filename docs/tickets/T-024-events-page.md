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
- [x] Chronological order proven by test and E2E.
- [x] All-day vs timed rendering correct in all three locales, `Europe/Warsaw` default.
- [x] Project link appears only for published projects with a usable translation.
- [x] Missing location/description/link degrade without empty labels.
- [x] Calendar failure is isolated: error state with retry, rest of page functional.
- [x] `<time datetime>` present; axe 0 critical/serious.
- [x] No hard-coded event content in components.

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

### (author @designer) implementation — 2026-10-19

Read first: this ticket, the orchestrator brief (`/tmp/opencode/t024-brief.md`),
PRD §4/§5/§8, architecture §4–§5, DESIGN_SYSTEM §3/§5/§6, D-11/D-14, the T-023
wire contract in `T-023-calendar-adapter.md` (Log), and the house patterns
(`useProjects`/`usePublications`, `publications.vue`, `PublicationCard`,
`selectTranslation`, `result.ts`, E2E mocks/network-guard).

**Deliverables**

- `src/features/events/sortEvents.ts` — pure ordering: instant resolution
  (timed = verbatim offset parse; all-day = midnight in the event's own
  timezone via a two-pass `Intl` offset correction, never a fake-UTC shift),
  past excluded (`instant >= now` keeps an event starting exactly at `now`),
  unparseable dates dropped, ties broken by an explicit input-index tie-break
  (not by trusting `sort` stability), `now` injected (Date | number | string).
- `src/features/events/formatEvent.ts` — `<time datetime>` view model.
  **RFC 5545 decision:** Google's all-day `end.date` is exclusive, so the
  rendered inclusive end is `end − 1 day` (06-01→06-02 displays as "Jun 1"
  only; the `datetime` attribute carries the inclusive date so the machine
  value matches the human value). Timed ranges split time/date by the
  calendar day in the event timezone (`en-CA` formatToParts).
  `excerptText` collapses whitespace and cuts at the last word boundary.
- `src/features/events/client.ts` — calendar adapter client. Any non-200,
  unparseable body, or structurally wrong payload → `unavailable`; individual
  malformed events are dropped, never guessed at. `fetchImpl` injectable.
- `src/features/events/useEvents.ts` — hook mirroring `useProjects`
  (inject `SUPABASE_CLIENT_KEY`, stale-discard, locale refetch, `ContentResult`).
  Calendar + link query run as **independent** `Promise.all` requests; the join
  is `linkKey(calendarId, googleEventId)` (NUL-joined) against
  `EventProjectLink` from T-015's `api.ts` — the published-only/translation rule
  is NOT re-implemented here (`null` → no link). Link failure degrades to
  "events without links"; calendar failure → `unavailable`. `joinEventsAndLinks`
  is exported pure; `retry()` bumps an attempt ref that re-triggers the effect.
  Components receive plain props only.
- `src/components/events/EventCard.vue` — `<li>` + h2 title; all-day badge is
  text ("All-day" chip), never color-only; every range is
  `<time datetime>`; registration link is `target=_blank rel=noopener noreferrer`
  with SR-only "for {event title}" + "opens in a new tab" (visible text stays
  "Register" — WCAG 2.5.3 name⊇visible); project link accessible name is
  SR-only "Related project:" + visible project title. No "online" label is
  invented anywhere (the wire has no online flag).
- `src/pages/[locale]/events.vue` — rewritten stub: loading = `QSkeleton` rows
  inside a `role="status"` block (fixed heights mirroring the card rhythm,
  list `aria-hidden`); empty / calendar-unavailable (retry `<button>` + RouterLink
  to `/{locale}/contact`) / list states; D-14 note rendered **once** above the
  list. Project href follows the T-019 strict-slug precedent:
  `owningLocale = isFallback ? "en" : currentLocale`.
- i18n: `events.placeholder` removed; `empty`, `calendarUnavailable`, `retry`,
  `contactFallback`, `languageNote`, `allDay`, `register`, `registerFor`,
  `projectLabel` added identically to en/pl/uk (parity test green).
- `vitest.config.ts` — added a `^quasar$` → `quasar/dist/quasar.client.js`
  alias (array form, so sub-path imports keep working) and
  `test.server.deps.inline: ["quasar"]`. Without this, Node's `ssr` export
  condition loads `quasar.server.prod.js` in vitest and mounting any page with
  a Quasar component aborts with "SSR server build was installed without an
  ssrContext". This is the fix Quasar's own error message prescribes.

**D-14 default applied (still open):** calendar content shown as-is (the wire
carries no language field), with one translated note per list:
"Event details are provided by the organizer in their original language."

### RED evidence

- New suites before implementation:
  `pnpm --dir apps/web/barykadyKultury test --run src/features/events/__tests__/sortEvents.test.ts …/formatEvent.test.ts …/client.test.ts …/useEvents.test.ts src/components/events src/pages`
  → `Test Files 6 failed | 11 passed (17) / Tests 7 failed | 78 passed (85)`
  (failed-resolve-import errors for `@/features/events/sortEvents|formatEvent|client|useEvents`
  and `@/components/events/EventCard.vue`, plus stub-page assertions failing).
- Two intermediate REDs during GREEN were kept honest and fixed in the
  implementation, not the spec: (1) `Date.parse(number)` coercion bug in
  `sortEvents`' `now` handling → explicit `typeof now === "number"` branch;
  (2) `en` `dateStyle: "medium"` renders "Jun 1, 2030" (abbreviated month),
  not "June 1, 2030" — test expectations corrected to the real Intl output
  after verifying `format.test.ts` only ever used `dateStyle: "long"`.

### GREEN evidence (exact commands, sequential, unit never parallel with E2E)

- `pnpm --dir apps/web/barykadyKultury test`
  → `Test Files 68 passed (68)`, `Tests 670 passed (670)`.
- `pnpm --dir apps/web/barykadyKultury typecheck` → exit 0 (only the
  pre-existing `[vue-router] No rootDir specified` advisory).
- `pnpm --dir apps/web/barykadyKultury lint:check` → oxfmt + oxlint clean on
  214 files.
- `pnpm --dir apps/web/barykadyKultury build` → `Build succeeded`;
  `.q-skeleton` styles present in `dist/spa/assets/index-*.css`; no
  `GOOGLE_CALENDAR` string in the bundle.
- `pnpm --dir apps/web/barykadyKultury test:e2e --workers=1` (full suite,
  includes the new events journeys) → `71 passed (1.1m)`.
- `pnpm --dir apps/web/barykadyKultury test:e2e --workers=1 --grep "events"`
  → `5 passed` (chronological order + published-only join incl. draft-link and
  wrong-calendar-link drops; registration accessible name; project link →
  published detail; 502 retry/fallback with page usable + axe 0 critical/serious;
  320 px no-overflow).

### Deviations / decisions for review

- **QSkeleton requires a vitest alias + inline-deps change** (above). The app
  source had zero Quasar component imports before; the brief explicitly asked
  for `q-skeleton`, so the test harness was adapted rather than dropping to
  custom CSS. Reviewer: confirm you accept `vitest.config.ts` carrying the
  `^quasar$` alias, or prefer a token-based custom skeleton later.
- **All-day end is rendered inclusively** (`end − 1 day`, RFC 5545). The T-023
  adapter passes Google's exclusive date verbatim; nobody else subtracts it.
  If the NGO ever expects "through June 2" semantics for 06-01→06-02, this is
  the place that decides — covered by `formatEvent.test.ts`.
- **Description excerpt is a hard word-boundary cut (320 chars, `…`)** with no
  detail page to expand to (events have no detail route in MVP). No invented
  "read more" target.
- **Project-link accessible name** = "Related project: {project title}" (SR
  prefix + visible title). The event title is NOT repeated in the link name —
  the brief itself rejected the verbose form, and the card's `h2` provides the
  event context for heading-based navigation. Registration links DO carry the
  event title ("Register for {title}" via SR-only suffix).
- **"Fallback link" in the ticket's states list** is implemented as a
  `/{locale}/contact` link next to the retry button (PRD §5 wording); the
  destination is a real existing route (T-021), no invented contact facts.
- **`events-page__lead`** (stub class) is gone; nothing referenced it.
- Acceptance-criteria checkboxes left unticked for the orchestrator/reviewer.

### Review findings applied — rev-2 + des-2 (2026-10-19)

All merge-gate and follow-up findings applied; architecture unchanged (hook
owns fetch/join, components plain props).

- **B1 (reduced motion):** `src/css/tokens.css` — inside the existing
  `@media (prefers-reduced-motion: reduce)` block:
  `.q-skeleton, .q-skeleton::after { animation: none; }` with a comment that
  Quasar's wave/blink keyframes (and the `::after` sweep) are not governed by
  `--motion-duration`.
- **M1 (retry focus/silence):** `events.vue` — local `retrying` ref spans the
  in-flight round trip; the skeleton shows only on `loading && !retrying`, so
  the failure block stays mounted with the retry button `disabled` +
  `aria-busy="true"` and an unchanged label (focus survives). On success the
  page moves focus to the list (`tabindex="-1"`, `nextTick` +
  `HTMLElement.focus()`) and a persistent sr-only `role="status"` live region
  (`.events-page__live`) announces loading / empty / unavailable / success —
  success with the new `events.loaded` count key. The visible state blocks no
  longer carry their own `role="status"`, so nothing double-announces (the
  skeleton list remains `aria-hidden`). Proven by the new M1 page test
  (prototype-spy on `focus`, since VTU mounts detached) and kept honest in
  E2E (the spec now targets `.events-page__unavailable-text` because the live
  region carries the same sentence).
- **M2 (320 px proof with real strings):** `e2e/events.spec.ts` — two new
  journeys: a single unbroken agglutinative word (EN/PL/UK titles, location,
  long URL description + registration href) overflow-checked at 320 px for
  `/en|pl/uk/events`, and the PL unavailable state (long "Spróbuj ponownie"
  + "Skontaktuj się z nami w sprawie wydarzeń") overflow-checked. Deterministic
  fixtures only.
- **R1 (uk formatting evidence):** `formatEvent.test.ts` — exact ICU strings
  asserted for a uk timed event ("14 трав. 2030 р., 16:00" / "18:00") and a
  uk all-day range ("1 черв. 2030 р." → "3 черв. 2030 р."); verified against
  the same full-icu Node build the existing `format.test.ts` assertions rely
  on, so they are not environment guesses.
- **R2 (unpublished-mapping documentation + fileMode note):** new
  `EventCard.test.ts` case documents that `project: null` is how a
  draft/archived/translation-less mapping arrives from the T-015 mapper, and
  that the card still renders the FULL event (title, both `<time>` elements,
  location, description, registration) with only the project action absent.
  FileMode finding: **false positive in this environment** — `git config
  core.fileMode` is `false` and `git ls-files -s`/index records `100644` for
  every new file despite the WSL mount presenting 777; nothing executable
  entered the repo.
- **D1 (European English dates):** `src/features/i18n/format.ts` — single
  `INTL_DISPLAY_TAGS` choke point maps `en → "en-GB"` for Intl construction
  only; the `Locale` union, URLs, storage and `document.lang` stay "en".
  English now renders "14 May 2030, 16:00". `format.test.ts` gained the
  en-GB assertion and the long-form expectation updated; all downstream
  event/card expectations re-verified (no other suite asserted en date text).
- **D2 (action hierarchy):** Register is the filled accent pill
  (`--color-accent`/`--color-accent-text`, same surface as ActionLink
  primary); the project link is a bordered ghost pill; retry is primary
  filled, contact fallback ghost. Both keep `.focus-ring` (outline drawn
  outside the fill, `--color-focus` ≥3:1 on both light and dark — verified
  against the token contrast table, not by eye).
- **D3 (SR range relation):** visible " – " is now `class="event-card__when-sep"
  aria-hidden="true"` and an sr-only `events.rangeTo` word sits between the
  two `<time>` elements (en "to", pl "do", uk "до"), asserted in
  `EventCard.test.ts`.
- **D4 (grid rhythm):** adopted the sibling rule verbatim —
  `repeat(auto-fill, minmax(min(100%, 20rem), 1fr)); gap: 2rem 1.5rem;` —
  media-query ladder dropped. No deviation.
- **D5 (skeleton fidelity):** bars now mirror title/date/location/description
  /action with the card's 0.375rem gap (new 1rem location bar, description
  5rem); comment softened to "mirrors the card rhythm; exact match is
  impossible with variable content".
- **D6 (skeleton tokens wired):** scoped `:deep(.q-skeleton)` sets
  `background-color: var(--color-skeleton)` and
  `:deep(.q-skeleton--anim-wave::after)` re-points the wave gradient to
  `var(--color-skeleton-shine)`. Quasar hard-codes `#0000001f`/white
  gradients (verified in `quasar.prod.css`); the two properties it exposes
  for us are exactly these, so the token table's promise is now true. The
  `--anim-blink` variant (not used here) would need the same treatment if
  anyone switches `animation` props.
- **D7 (fallback marking):** `EventCard` renders the existing
  `content.fallbackNote` (mirroring `PublicationCard`) when
  `event.project.isFallback` — a `/uk/events` page never shows an unmarked
  English project title. Covered by a new card test.
- **D8 (list semantics):** the events `<ul>` carries `role="list"`
  (VoiceOver restores list announcements after `list-style: none`).

**Copy (applied exactly as specified):** EN/PL/UK `empty`, PL/UK
`languageNote`, PL/UK `registerFor` (colon dropped), new `rangeTo` and
`loaded` keys in all three catalogues; parity test green.

**Out of scope, untouched:** empty-state contact CTA, first-card date
emphasis, tablet-width E2E, backporting skeletons to other pages.

**GREEN evidence after review fixes (sequential, unit never parallel with E2E):**

- `pnpm --dir apps/web/barykadyKultury test`
  → `Test Files 68 passed (68)`, `Tests 676 passed (676)`.
- `pnpm --dir apps/web/barykadyKultury typecheck` → exit 0 (only the
  pre-existing `[vue-router] No rootDir specified` advisory).
- `pnpm --dir apps/web/barykadyKultury lint:check` → oxfmt + oxlint clean on
  214 files.
- `pnpm --dir apps/web/barykadyKultury build` → `Build succeeded`.
- `pnpm --dir apps/web/barykadyKultury test:e2e --workers=1` → `73 passed`
  (full suite; the events spec is now 7 journeys, +2 for M2).

**Deviations from the review instructions:** none in behavior. One test-mechanics
note: the M1 focus assertion uses a `HTMLElement.prototype.focus` spy because
VTU mounts detached (`document.activeElement` can never change); the live
behavior is additionally proven in the browser by the E2E retry journey.

