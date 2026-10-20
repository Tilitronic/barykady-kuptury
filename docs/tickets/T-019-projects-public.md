# T-019 — Projects: listing, detail, draft protection

**Session:** 4 · **Lane:** feature/projects · **Owner:** @designer · **Status:** done
**Reviewers:** @reviewer + @designer
**Depends on:** T-011, T-015, T-013 · **Blocks:** T-025, T-027, T-032

## Outcome
A visitor can browse published projects and open a localized detail page; drafts are unreachable and unreadable anonymously at the data layer.

## Scope
In:
- `/locale/projects` listing: title, summary, dates, optional cover; intentional empty and error states; pagination or "load more" only if the seed volume justifies it (defer otherwise). **Status (review amendment):** the listing is published-only by construction, so a per-card lifecycle badge would be uniform noise — the localized status is surfaced on the detail page instead (see the detail bullet and Log).
- `/locale/projects/:slug` detail: full description (sanitised localized rich text), dates, **localized status label**, cover image with alt, related upcoming events slot (filled by T-024).
- Translation fallback per T-015 (`isFallback` surfaced as a subtle note).
- Draft protection proven twice: RLS test (anon select returns zero rows) and E2E (direct URL to a draft slug → 404, not an empty page).
- Canonical slug rule (D-24/T-038, supersedes the original localized-slug rule): one root slug is shared by every locale; a public URL resolves only when the row is published, the root slug matches, and a translation exists for the requested locale. A fallback translation must never resolve under a locale that has no translation.
- Component tests: card matrix (cover/no cover, dates absent, long titles), detail heading hierarchy.
- E2E: listing → detail; direct deep link; draft 404; keyboard navigable cards.

Out: admin editing (T-027), featured ordering (T-025/T-030), project-event management (T-031).

## Design constraints
- `docs/PRODUCT_REQUIREMENTS.md` §4 (Projects), §8 (drafts invisible, anonymous cannot write).
- `docs/architecture.md` §4 (lifecycle, translations), §6 (RLS).
- `docs/DESIGN_SYSTEM.md` §3 (card behaviour consistency), §6.
- `AGENTS.md` (no unrestricted `v-html`).

## TDD plan
1. RED: `ProjectCard.test.ts` — `renders without cover`, `omits missing dates`, `links to the localized slug`.
2. GREEN: implement card + listing + detail.
3. RED: `projectDraft.test.ts` (RLS/SQL): anon select returns 0 rows for draft.
4. RED E2E: `/pl/projects/<draft-slug>` → 404 with a translated message.
5. REFACTOR: shared `ContentCard` if it genuinely fits publications too (avoid premature abstraction).

## Acceptance criteria
- [x] Listing shows only published projects; empty state translated.
- [x] Detail page renders localized content with fallback note when applicable.
- [x] Draft slug returns 404 for anonymous visitors; no draft data appears in the HTML payload.
- [x] Cover images have correct alt/dimensions and do not cause layout shift.
- [x] Rich text is sanitised; raw HTML from content is not rendered.
- [x] Cards are links (real anchors), keyboard operable, with visible focus.
- [x] No user-facing string outside i18n.

## Verification
```
pnpm test --run src/features/projects
pnpm test:e2e --grep "projects"
supabase test db
pnpm typecheck && pnpm lint:check
```

## Review gate
- @reviewer: spec axis (§4 + §8), no draft leakage in payload, sanitisation path, i18n completeness.
- @designer: card grid, detail reading experience, responsive behaviour.

## Log
- (author) start:
- (designer) impl 2026-10-18: listing `projects.vue` (fluid `auto-fill minmax(min(100%,20rem),1fr)` grid) + `ProjectCard.vue` + detail `project-detail.vue` + route `projects/:slug` (`project-detail`, `meta.pageMeta` = projects keys). **Slug-rule interpretation (line 16):** detail resolution is STRICT on (requestedLocale, slug) — `findProjectBySlug` matches only the requested locale's own translation row and rejects non-published roots; `/pl/…/<en-slug>` and any draft slug render the translated 404 content (`notFound.title/message`), never a cross-locale match. Tension with T-015 content fallback is resolved on the LINKING side instead: a listing card whose text stands in from English carries the English slug, so it links under the **English prefix** (`detailPath` uses the owning locale) — the URL always contains its own slug, so there are no dead links and no silent cross-locale resolution. The two rules compose: fallback identifies content language (visible note), slugs stay locale-strict. **Status placement:** public surfaces are published-only by construction, so the localized chip renders only for a non-published status reaching a view (defensive; labels in `projects.status.*`, never raw enum) — documented in `ProjectCard.vue`. **Cover seam:** `cover.ts` mirrors the T-018 portrait rule; URL resolved in `useProjects`/`useProject` view models, passed as plain props (card alt="" decorative inside the named link; detail alt=title informative; explicit width/height + CSS aspect-ratio, no layout shift). **Pagination deferred** (small published set; noted in `projects.vue`). Events slot omitted with a comment (T-024; nothing invented). Draft protection: RLS proof untouched; app-layer complement tested (leaked draft rows in payload never render/link/resolve). `projects.placeholder` removed (unused after rewrite); `empty`/`detail.back`/`status.*` added in en/pl/uk. Tests: api(+8)/cover(3)/useProjects(5)/ProjectCard(11)/listing(7)/detail(9) unit — RED (15 assertion failures + 4 import failures) → GREEN; `e2e/projects.spec.ts` 6 journeys incl. draft-404, cross-locale-slug-404, keyboard, axe 0 critical + 0 serious.
- (designer) rev-1 2026-10-18: @reviewer gate — 2 findings applied. (1, Spec Major) the impl entry's status placement is superseded: the card's defensive non-published chip never rendered in the public flow (published-only listing), so it was dead code — removed from `ProjectCard.vue` together with its tests. PRD §4 "support status" is now honored where it is not uniform noise: the **detail page** renders the localized lifecycle label (`projects.status.*`, shown in a muted meta line beside the dates; E2E-asserted "Published", component-tested en+pl). Scope bullets amended above. (2, Standards Suggestion) chose the documented-duplication option for the media seam: `cover.ts` carries a note explaining why the per-feature URL helper is intentionally parallel to `team/portrait.ts` (each feature owns its bucket/path/alt policy; extract a shared helper only when a third seam appears), with a one-line cross-reference added in `portrait.ts` (comment-only, team ticket untouched). No unused i18n keys: all three `projects.status.*` values stay reachable through the detail's enum-driven dynamic lookup.
- (reviewer) rev-2 2026-10-18: **both findings fixed; 0 new Standards findings; 0 new Spec findings.** Confirmed the detail renders the localized enum-driven status (en "Published" + pl asserted in `project-detail.test.ts`, E2E too), the scope bullets + Log record the decision, the card's dead status code/tests are gone, and the media seam carries the documentation-only resolution.
- (orchestrator) verification 2026-10-18 (working tree with the fixes): `pnpm test` **46 files / 468 tests**; `pnpm typecheck` clean; `pnpm lint:check` clean (171 files); `pnpm build` PASS; `pnpm test:e2e --workers=1` **55 passed**. **Status: done.**
