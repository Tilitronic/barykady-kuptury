# T-016 — About: organization content

**Session:** 4 · **Lane:** feature/content · **Owner:** @designer · **Status:** todo
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
- [ ] Mission/history/values render from data, not literals in the template.
- [ ] Fallback note appears with the source language name; no untranslated string shown as if translated.
- [ ] PL/UK unapproved content is seeded as draft or marked `needsReview`, never silently published.
- [ ] Empty/error states are explicit and translated.
- [ ] Single h1; headings ordered; body measure readable.
- [ ] No invented organizational facts.

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
- (author) start:
