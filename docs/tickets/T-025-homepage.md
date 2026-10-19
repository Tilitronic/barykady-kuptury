# T-025 — Homepage composition

**Session:** 7 · **Lane:** feature/homepage · **Owner:** @designer · **Status:** done
**Reviewers:** @reviewer + @designer
**Depends on:** T-016, T-019, T-022, T-024 · **Blocks:** T-032, T-034

## Outcome
The homepage explains the organization, offers one primary next step, shows the nearest upcoming events, and shows featured projects with a recent-projects fallback — with intentional empty states and calendar failure isolation.

## Scope
In:
- Sections: intro/mission (from `site_pages`, no literal copy), primary CTA from config, upcoming events (nearest N, ordered), featured projects (configured order; fallback = most recently updated published), routes to Projects/Events/Publications/Contact/Support.
- CTA selection is config-driven (`src/config/cta.ts`); with no configured destination the CTA is omitted rather than invented.
- Per-section states: loading, empty, error — independent so one failure cannot blank the page.
- Performance: above-the-fold content not blocked by calendar/fetch failures; no layout shift from images (dimensions set).
- Component tests: featured ordering, fallback ordering, empty events + empty projects, CTA omitted when unconfigured.
- E2E: featured projects in configured order; fallback when none featured; calendar 502 still renders mission + projects; axe 0 critical/serious.

Out: hero animation/parallax, marketing gradients (explicitly discouraged), CMS-driven section ordering.

## Design constraints
- `docs/PRODUCT_REQUIREMENTS.md` §5 (homepage contents, no fabricated content, empty states, calendar fallback), §8.
- `docs/DESIGN_SYSTEM.md` §3 (hierarchy, restraint), §4, §6.
- `docs/architecture.md` §8.

## TDD plan
1. RED: `HomePage.test.ts` — `renders featured projects in configured order`, `falls back to recent published when none featured`, `omits the CTA when unconfigured`.
2. GREEN: implement sections consuming T-015 helpers.
3. RED E2E: calendar 502 fixture — mission and projects still visible, events show error state.
4. RED E2E: no featured projects fixture — recent published shown, drafts absent.
5. REFACTOR: extract `SectionShell` for consistent heading/spacing across homepage sections.

## Acceptance criteria
- [x] Mission text comes from data; no hard-coded organizational copy.
- [x] Events on the homepage are the nearest upcoming, ordered, from the adapter.
- [x] Featured order honoured; fallback to recent published proven; drafts never appear.
- [x] CTA omitted when no destination configured.
- [x] Calendar failure leaves the rest of the page intact.
- [x] Empty states translated and never fabricate content.
- [x] axe 0 critical/serious; LCP element is not blocked by remote data.

## Verification
```
pnpm test --run src/pages/home src/features/home
pnpm test:e2e --grep "home"
pnpm typecheck && pnpm lint:check
```

## Review gate
- @reviewer: spec axis §5 checklist, fallback correctness, no fabricated content, failure isolation.
- @designer: hierarchy and first-impression quality, mobile composition, scarlet restraint.

## Log

### (author @designer) implementation — 2026-10-19

Read first: this ticket, the orchestrator brief (`/tmp/opencode/t025-brief.md`),
PRD §5/§8, architecture §8, DESIGN_SYSTEM §3/§4/§6, and the house patterns
(`about.vue` + `useSitePage`, `ordering.ts` + `featuredProjects` (T-015,
consumed, not re-implemented), `useEvents`/`EventCard` (T-024),
`useProjects`/`ProjectCard` (T-019 strict-slug), `support.ts` config style,
`navigation.ts` model, E2E mocks/network-guard, `smoke.spec.ts` h1 contract).

### Architectural decisions applied

1. **SectionShell** (`src/components/home/SectionShell.vue`, ticket REFACTOR
   step): `<section aria-labelledby>` + one `h2` (id via Vue's `useId`) +
   optional intro + optional "view all" `RouterLink` + slot body. The page
   maps `ContentResult` states to markup only; heading hierarchy and spacing
   cannot drift between sections.
2. **CTA config shape** (`src/config/cta.ts`): `HomeCta { labelKey, href }`
   with `homeCta: HomeCta | null = null` — the **unconfigured default renders
   no CTA at all** (AGENTS rule 6; D-06 posture). `href` is a
   locale-agnostic segment (navigation.ts model: components prepend the
   locale) or an absolute `http(s)` URL (rendered as
   `target=_blank rel=noopener noreferrer` + sr-only "opens in a new tab").
   `ctaIsExternal` accepts only `http(s)` — any other scheme stays an inert
   internal segment, never an external navigation. Pure helpers are unit-
   tested; the page test swaps the mocked config via a `vi.mock` getter.
3. **Failure isolation**: four independent data flows — `useSitePage("home")`,
   `useEvents`, `useProjects`, static config — each mapped to its own section
   state. A calendar 502 shows only a compact message inside the events
   section; the section's "All events" link (always rendered by the shell) is
   the onward route, and the full retry control stays on the Events page
   (T-024), so the home never duplicates the retry UX.
4. **Ordering/caps**: events = `useEvents` output (already sorted
   soonest-first, past excluded) `.slice(0, 3)`; projects =
   `featuredProjects(items).slice(0, 3)` — featured order honoured, fallback
   to most-recently-updated published, drafts/archived excluded by the T-015
   helper (RLS is the real boundary). Nothing re-implemented.
5. **Strict-slug rule extracted** to `src/features/events/projectLink.ts`
   (`eventProjectPath(link, currentLocale)`), now consumed by BOTH
   `events.vue` (T-024 refactored to it — its tests unchanged and green) and
   the homepage, with its own unit test. Project cards keep the same
   `isFallback ? en : currentLocale` rule inline (`ProjectCard` contract).
6. **Above-the-fold**: `h1` (`t("home.title")` — smoke contract holds) and
   the configured CTA render synchronously from catalogues/config; remote
   sections sit below and never block or blank them. `ProjectCard` keeps the
   cover `width/height` + aspect-ratio, so no image shift. Loading states use
   compact `q-skeleton` rows (`role="status"` + sr-only text, visual rows
   `aria-hidden` — no double announcement, same M1 pattern as T-024).
7. **Explore links** derive from `mainNavItems` (filtering out the About
   landing, which the header already provides) — no hard-coded route list.
8. **i18n**: obsolete `home.placeholder` removed from all three catalogues;
   new `home.sections.{mission,events,projects,explore}`, `home.allEvents`,
   `home.allProjects`, `home.eventsEmpty` added identically (parity test
   green). Reuses `events.calendarUnavailable` and `projects.empty` rather
   than duplicating copy. Empty states are intentional translated text; no
   fabricated content anywhere.

### Test-first notes

- `mountWithPlugins` gained an optional `slots` passthrough (additive; used
  by `SectionShell.test.ts`), and `mountHome` respects
  `exactOptionalPropertyTypes` for the fake Supabase `error` option.
- The homepage test mocks `@/config/cta` with a getter so the same test file
  proves both CTA branches (omitted when `null`, rendered when configured)
  without module-registry gymnastics.

### RED evidence

- Before implementation:
  `pnpm --dir apps/web/barykadyKultury test --run src/pages/__tests__/index.test.ts src/components/home src/config/__tests__/cta.test.ts src/features/events/__tests__/projectLink.test.ts`
  → `Test Files 4 failed (4)`, `Tests 14 failed | 2 passed (16)` —
  `Failed to resolve import "@/config/cta" / "@/components/home/SectionShell.vue" / "@/features/events/projectLink"`
  and the stub page failing every composition assertion.
- One intermediate RED was honest: section-scoped state classes
  (`.home-events__state` / `.home-projects__state`) were asserted before the
  template carried them; fixed in the implementation, not by weakening the
  spec.

### GREEN evidence (exact commands, sequential; unit never parallel with E2E)

- `pnpm --dir apps/web/barykadyKultury test`
  → `Test Files 71 passed (71)`, `Tests 696 passed (696)`.
- `pnpm --dir apps/web/barykadyKultury typecheck` → exit 0 (only the
  pre-existing `[vue-router] No rootDir specified` advisory).
- `pnpm --dir apps/web/barykadyKultury lint:check` → oxfmt + oxlint clean on
  221 files.
- `pnpm --dir apps/web/barykadyKultury build` → `Build succeeded`.
- `pnpm --dir apps/web/barykadyKultury test:e2e --workers=1` (full suite)
  → `77 passed (1.2m)` — includes the 4 new `homepage` journeys (featured
  order + draft/unfeatured absence, recent fallback, calendar-502 isolation,
  320 px no-overflow, axe 0 critical/serious on the composed page) and the
  unchanged smoke journeys (h1 "Barykady Kultury" survives).

### Deviations / notes for review

- **Mission section loading state is text, not skeleton** (matches
  `about.vue`); only the events/projects sections use compact skeletons, as
  the brief scoped skeletons to those states.
- **Home events failure state has no retry button** — the brief's home
  requirement is "compact message + link to /xx/events"; the M1 retry UX
  stays single-sourced on the Events page.
- **CTA lives inside the mission section body** (below the intro text) rather
  than a standalone hero band — one primary scarlet surface per view
  (DESIGN_SYSTEM §3) and no invented hero copy.
- **`home.sections.mission` is UI copy ("About us")** — the organizational
  text itself comes only from `site_pages`.
- Acceptance-criteria checkboxes left unticked for the orchestrator/reviewer.

### Review findings applied — rev-3 + des-4 (2026-10-19)

**Majors**

- **M1 (heading outline):** `EventCard.vue` + `ProjectCard.vue` gained an
  optional `headingLevel` prop (default `2`, allowed `2 | 3`, rendered via
  `<component :is="...">`) — the homepage passes `3`, the Events/Projects
  listing pages keep the default and their existing tests are unchanged.
  `richText.ts` gained `headingOffset` in `RenderRichTextOptions` (default
  `0`, clamped to h1..h6) surfaced as `LocalizedRichText`'s `headingOffset`
  prop — the homepage mission passes `1` ("## " renders h3), `about.vue`
  keeps its levels. Implemented against the actual sanitized AST: only the
  rendered tag of already-parsed headings shifts; parsing, the restricted
  subset and the inert-input guarantees are untouched (new offset tests in
  `richText.test.ts` include the clamp case). New assertions: homepage
  component test (one h1, exactly the four section h2s in order, card AND
  authored headings at h3) and an explicit E2E outline block — role/level
  queries, so axe's *moderate* `heading-order` can no longer hide a
  regression; `checkA11y` stays critical-only as designed.
- **M2 (mission empty copy):** new `home.missionEmpty` (exact approved copy
  in en/pl/uk) replaces `content.empty` in the mission empty state; the
  section heading and Explore links stay visible (asserted).
- **M3 (h1 on the scale + lede):** `.home__title` now uses
  `--font-size-display` / `--font-weight-display` / `--line-height-display`
  (the `.text-display` token set) with a sibling-consistent `margin`
  (padding-block ladder dropped), and `t("home.description")` renders as a
  muted `.home__lede` under the h1 — existing catalogue copy, nothing
  invented.

**Minors**

- **m1:** the home events section reuses the Events-page card-shaped skeleton
  (title/date/location/description/action bars); BOTH skeletons now render
  `SECTION_CAP` (3) rows — the 2/3 mismatch is gone.
- **m2:** `role="list"` on the Explore `<ul>` (asserted).
- **m3:** Explore filters `projects` and `events` out of `mainNavItems`
  (Contact, Support, Publications remain — the section routes already own
  the other two); while `homeCta` is unconfigured the Support item takes the
  filled-accent primary treatment once (it is then the only route to
  support), and it goes quiet the moment a CTA is configured. Conditional +
  rationale documented in a template comment and covered by two tests.
- **m4:** Explore pills adopt the About-subnav treatment (quiet
  `--color-border`, muted text, color/underline on hover/focus-visible) —
  one pill system, the competing bordered-link style is gone.
- **m5:** mission loading state carries `role="status"`.
- **m6:** `.home__stack { max-width: 48rem; }`.
- **m7:** covered by M3 (h1 margin now sibling-consistent).

**Copy (applied exactly):** p1 `home.eventsEmpty` pl/uk; p2 uk
`sections.projects` → "Вибрані проєкти"; p3 `sections.mission` → "Our
mission"/"Nasza misja"/"Наша місія"; p4 the en catalogue carries the
"intentionally shorter than `events.empty`" comment; p5 no change. Plus the
new `home.missionEmpty` in all three locales (parity test green). The
rev-3 CTA simplification (`const cta = homeCta` — static config, no
computed wrapper) was already applied and is kept.

**Not done (out of scope):** site-wide `.sr-only` utility consolidation —
logged as fast-follow by the reviewer; untouched here.

**GREEN evidence after review fixes (sequential; unit never parallel with
E2E):**

- `pnpm --dir apps/web/barykadyKultury test`
  → `Test Files 71 passed (71)`, `Tests 705 passed (705)`.
- `pnpm --dir apps/web/barykadyKultury typecheck` → exit 0 (only the
  pre-existing `[vue-router] No rootDir specified` advisory).
- `pnpm --dir apps/web/barykadyKultury lint:check` → oxfmt + oxlint clean.
- `pnpm --dir apps/web/barykadyKultury build` → `Build succeeded`.
- `pnpm --dir apps/web/barykadyKultury test:e2e --workers=1`
  → `77 passed (1.3m)` — the homepage compose journey now asserts the full
  outline (1 h1; h2 = [Our mission, Upcoming events, Featured projects,
  Explore]; h3 for authored + card headings) plus axe 0 critical/serious.

**Deviations:** none from the review instructions. Note: `LocalizedRichText`
gained an `h4` deep style (font-size falls back to `--font-size-h3` if the
`h4` token is absent) so offset-rendered headings stay on the scale.

