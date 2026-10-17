# T-019 — Projects: listing, detail, draft protection

**Session:** 4 · **Lane:** feature/projects · **Owner:** @designer · **Status:** todo
**Reviewers:** @reviewer + @designer
**Depends on:** T-011, T-015, T-013 · **Blocks:** T-025, T-027, T-032

## Outcome
A visitor can browse published projects and open a localized detail page; drafts are unreachable and unreadable anonymously at the data layer.

## Scope
In:
- `/locale/projects` listing: title, summary, status, dates, optional cover; intentional empty and error states; pagination or "load more" only if the seed volume justifies it (defer otherwise).
- `/locale/projects/:slug` detail: full description (sanitised localized rich text), dates, status, cover image with alt, related upcoming events slot (filled by T-024).
- Translation fallback per T-015 (`isFallback` surfaced as a subtle note).
- Draft protection proven twice: RLS test (anon select returns zero rows) and E2E (direct URL to a draft slug → 404, not an empty page).
- Slugs unique per locale; an English fallback slug must not silently resolve a Polish URL.
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
- [ ] Listing shows only published projects; empty state translated.
- [ ] Detail page renders localized content with fallback note when applicable.
- [ ] Draft slug returns 404 for anonymous visitors; no draft data appears in the HTML payload.
- [ ] Cover images have correct alt/dimensions and do not cause layout shift.
- [ ] Rich text is sanitised; raw HTML from content is not rendered.
- [ ] Cards are links (real anchors), keyboard operable, with visible focus.
- [ ] No user-facing string outside i18n.

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
