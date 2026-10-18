# T-016 — About: organization content

**Session:** 4 · **Lane:** feature/content · **Owner:** @designer · **Status:** done
**Reviewers:** @reviewer + @designer
**Depends on:** T-011, T-015 · **Blocks:** T-025, T-028

## Outcome
The About landing page presents the organization's real mission, history and values in all three locales, with a visible hierarchy and a documented fallback when a translation is missing.

## Scope
In:
- About landing route with subsections for organization info, team (T-018) and documents (T-017).
- Content sourced from `site_pages` + translations, seeded with **only verified material**: mission ("To expand Ukrainian culture beyond borders and give it the space it deserves", EN from brandbook, PL/UK translations marked as needing approval before publish), history (founded by Daria Yakovleva, Poznań — from brandbook p. 4), values (Identity, Education, Support, Community — brandbook p. 10), and the aims from the regulations (PL/EN/UKR already exist).
- Public fallback: when the requested locale is missing, render the English body with an inline note naming the original language (docs §6 accessibility guidance), never a silent mix.
- An admin-only "untranslated" indicator hook ready for T-031 (no admin UI here).
- Loading / empty / error states using the T-015 result model.
- Component tests: localized render, fallback note, empty state, heading hierarchy (single h1, ordered h2s).
- E2E: About reachable from header and footer, content visible in all three locales.

Out: editing UI (T-028), invented biographies, translated copy that has not been approved — PL/UK mission text must be flagged `needsReview` rather than presented as final.

## Design constraints
- `docs/PRODUCT_REQUIREMENTS.md` §4 (About subsections, localized content, fallback identified), §2.6.
- `docs/DESIGN_SYSTEM.md` §3 (hierarchy, whitespace), §6 (heading order, language of fallback content).
- Brandbook p. 4, 5, 10 (history, mission, values).

## TDD plan
1. RED: `AboutPage.test.ts` — `renders the mission for the active locale`, `shows a fallback note when only English exists` — fail (page missing).
2. GREEN: implement page + content mapper consumption.
3. RED: empty-state test (no published page row) → intentional message, no fabricated copy.
4. REFACTOR: extract `LocalizedRichText.vue` (sanitised rendering, no `v-html` of untrusted input) reused by projects/publications.

## Acceptance criteria
- [x] Mission/history/values render from data, not literals in the template.
- [x] Fallback note appears with the source language name; no untranslated string shown as if translated.
- [x] PL/UK unapproved content is seeded as draft or marked `needsReview`, never silently published.
- [x] Empty/error states are explicit and translated.
- [x] Single h1; headings ordered; body measure readable.
- [x] No invented organizational facts.

## Verification
```
pnpm test --run src/pages/about src/features/content
pnpm test:e2e --grep "about"
pnpm typecheck && pnpm lint:check
```

## Review gate
- @reviewer: spec axis — fallback and localization rules quoted and proven; no template literals of org copy.
- @designer: hierarchy and rhythm; scarlet not overused; mobile reading order.

## Log
- (author) start: 2026-10-18
- RED: `AboutPage.test.ts` failed as expected — page still rendered placeholder
  ("Information about us is being prepared.") instead of mission content.
- GREEN: implemented `useSitePage` composable, `LocalizedRichText.vue`,
  `src/shared/content/richText.ts`, and data-driven `about.vue`.
- RED: empty-state test failed initially because placeholder was still shown;
  implemented explicit `loading`/`empty`/`unavailable` states.
- Added `loading` to the shared `ContentResult` union (T-015 result model) so
  pages can switch on a single discriminated shape.
- Extended `SitePageContent` + select + `mapSitePage` with `needsReview` and
  covered it in `api.test.ts` for the T-031 admin hook.
- Replaced fictional `site_pages` seed block with verified mission/history/
  values/aims content; PL/UK translations have title+slug only, `body NULL`,
  `needs_review = true`.
- E2E seam: set `VITE_SUPABASE_URL` to `APP_ORIGIN` in `playwright.config.ts`
  so production-build requests are same-origin and `mockSupabaseRest` can
  intercept them without CORS blocking.
- Verification:
  - `pnpm test`: 31 files / 350 tests passed (was 29 files / 331 tests).
  - `pnpm test:e2e`: 40 passed (was 36).
  - `pnpm typecheck`: pass.
  - `pnpm lint:check`: pass.
  - `pnpm build`: pass.
  - `pnpm dlx supabase@2.121.0 db reset`: pass.
  - `pnpm dlx supabase@2.121.0 test db`: pass (231 tests).
  - `pnpm test:db:idempotency`: pass (12 tables, 25 rows).
- Review-fix pass (2026-10-18):
  - Added heading-hierarchy component test (one h1, h2 order Mission→History→Values→Aims).
  - Added `lang` prop to `LocalizedRichText.vue`; fallback prose is marked `lang="en"`.
  - E2E now asserts h2 order, active sub-nav `aria-current="page"`, and runs `checkA11y` on success and fallback journeys.
  - Moved sub-navigation before body copy; increased tap target to min 2.75rem height.
  - Fixed Polish fallback grammar to "po angielsku"; verified Ukrainian wording.
  - External `target="_blank"` links now append a visually-hidden "opens in a new tab" suffix.
  - Added branded `:focus-visible` ring, `overflow-wrap: break-word`, and `max-width: 65ch` to title/state/rich-text.
  - Reduced E2E fixture drift by asserting only key verified excerpts.
  - Re-verification:
    - `pnpm test`: 31 files / 353 tests passed.
    - `pnpm test:e2e`: 40 passed.
    - `pnpm typecheck`: pass.
    - `pnpm lint:check`: pass.
    - `pnpm build`: pass.
    - `pnpm dlx supabase@2.121.0 db reset`: pass.
    - `pnpm dlx supabase@2.121.0 test db`: pass (231 tests).
    - `pnpm test:db:idempotency`: pass (12 tables, 25 rows).
- Regression fix (2026-10-18): localized the external-link "opens in a new tab" SR suffix via new `content.opensInNewTab` key in en/pl/uk, added `newTabLabel`/`labelLang` props to `LocalizedRichText`, and marked the suffix `<span>` with the matching `lang` attribute. Updated `richText.test.ts` to prove non-English labels are used and no hardcoded English remains. Re-verified: `pnpm test` 31 files / 355 tests; `pnpm typecheck`; `pnpm lint:check`; `pnpm build`; `pnpm test:e2e` 40 passed.

### Review verdicts (2026-10-18) — @reviewer (rev-1) + @designer (des-2)

Implementation `3f455c1`; fixed point `f3362e4`.

- **@reviewer (two-axis): 1 Spec Major, 2 Standards Suggestions — all resolved.** Spec Major: the ticket-required heading-hierarchy component test was missing → added (`about.test.ts` asserts one `h1` and `h2` order Mission→History→Values→Aims). Standards Suggestions: (a) no `CODEOWNERS` to codify cross-cutting ownership — **deferred** as repo governance, not T-016 scope; (b) canonical About text duplicated between E2E and seed — **addressed** by asserting only verified excerpts in E2E. Confirmed **no assertions were weakened**; `supabase.from` remains confined to `src/features/*/api.ts`; no `v-html`. **Close verdict: YES (Standards + Spec).**
- **@designer (design/a11y): 2 Major, 4 Minor, 3 polish — all resolved, then 1 new regression resolved.** Resolved: EN fallback prose marked `lang="en"`; E2E now asserts ordered `h2`s, `aria-current="page"`, and runs `checkA11y` on success + fallback journeys; Polish fallback grammar fixed ("po angielsku"); sub-nav moved before body copy; sub-nav tap target ≤24px raised to `min-height: 2.75rem`; external links announce the new tab; branded `:focus-visible` ring; `65ch` measure on title/state; `overflow-wrap: break-word`. The fix initially hard-coded the new-tab announcement in English → **regression resolved** by localizing via `content.opensInNewTab` (en/pl/uk) with a matching `lang` attribute. **Design verdict: gate satisfied.**

#### Final verification (orchestrator, on the committed tree `3f455c1`)

- `pnpm test` → **31 files / 355 tests pass**.
- `pnpm typecheck` → clean; `pnpm lint:check` → clean (140 files).
- `pnpm test:e2e` → **40 passed**.
- (Author-reported, corroborated by both review lanes: `pnpm build` pass; `supabase db reset` pass; `supabase test db` 231 pgTAP pass; `pnpm test:db:idempotency` pass — 12 tables, 25 rows.)

#### Follow-ups

- **CODEOWNERS** (reviewer Suggestion) deferred — candidate for the release/handoff backlog.
- T-027's publish gate must agree with the T-015 `requiredFields` read-time completeness definition (carried from T-015).
- `LocalizedRichText.vue` + `richText.ts` are the shared safe-render contract for T-019/T-020 — reuse, do not fork.
