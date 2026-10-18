# T-018 — About: team

**Session:** 4 · **Lane:** feature/content · **Owner:** @designer · **Status:** done
**Reviewers:** @reviewer + @designer
**Depends on:** T-016 · **Blocks:** T-028
**Blocked by:** team data from the NGO (none supplied yet) — implement with an empty published set and ship the empty state.

## Outcome
Team members render consistently with optional role, bio and portrait; the section is fully hidden or shows a truthful empty state while no approved team data exists.

## Scope
In:
- Listing from `team_members` + translations, ordered by `sort_order`.
- Card: portrait (optional, lazy, `alt` from localized name/role, aspect-ratio enforced, object-fit cover), name, role, short bio with measured line length.
- Responsive grid: 1 col mobile, 2–3 desktop; consistent card heights without clipping long Ukrainian/Polish text.
- Optional fields collapse cleanly; no placeholder avatars presented as real people (neutral monogram or nothing).
- Per-member note naming the source language **only when English role/bio actually stand in** for the requested locale (review amendment, see Log).
- Accessibility: list semantics, headings, no color-only role distinction.
- Component tests: full/partial data matrix, image alt rules, empty state.
- E2E: section renders the empty state today; fixture-driven render tested with mocked data.

Out: biography authoring, portrait cropping tools, social profiles per person (not requested).

## Design constraints
- `docs/PRODUCT_REQUIREMENTS.md` §4 (team: name, role, bio, portrait; publish only approved info/images).
- `docs/DESIGN_SYSTEM.md` §3 (real imagery only when supplied), §6 (alt text, responsive, longer translations).

## TDD plan
1. RED: `TeamList.test.ts` — `renders name and role when bio is absent`, `uses empty alt for decorative portrait`, `shows translated empty state with no members`.
2. GREEN: implement card + list + data mapping.
3. RED: long-text test (Ukrainian bio) asserts no truncation.
4. REFACTOR: extract `PersonCard` if reused on project pages.

## Acceptance criteria
- [x] Empty state shown and translated; nothing fabricated.
- [x] All optional-field combinations render without layout breakage.
- [x] Portrait alt is meaningful when informative, empty when decorative.
- [x] Grid adapts 320 px → desktop with no horizontal scroll.
- [x] Ordered consistently across locales (sort_order independent of locale).
- [x] No hard-coded names or roles.
- [x] Fallback note renders only when English role/bio text actually stands in for the requested locale (never for an empty stand-in translation).

## Verification
```
pnpm test --run src/features/team
pnpm test:e2e --grep "team"
pnpm typecheck && pnpm lint:check
```

## Review gate
- @reviewer: alt-text rules, sort stability, no invented people.
- @designer: card consistency, portrait proportion, typographic rhythm.

## Log
- (author) start:
- (designer) impl 2026-10-18: `useTeamMembers` (mirrors `useDocuments`) + `about-team.vue` grid + `src/components/team/PersonCard.vue`; portrait public URL resolves through `src/features/team/portrait.ts` (`public-media` bucket, T-014) with the fake client extended only for `storage.from().getPublicUrl()`. Decisions: (1) alt composed from name + optional role ("alt from localized name/role"); (2) no approved photo → neutral initials monogram, `aria-hidden`, no `img` — the "decorative" case keeps nothing in the a11y tree; (3) per-card English-stand-in note reusing `content.fallbackNote` (accurate per member; `TEAM_MEMBER_REQUIRED_FIELDS` is empty, so fallback is real); (4) `aboutTeam.empty` added in en/pl/uk and the now-unused `aboutTeam.placeholder` removed from all three catalogues. Grid: `repeat(auto-fill, minmax(min(100%, 16rem), 1fr))` — 1 col at 320 px (E2E-asserted scroll-free), 2–3 desktop. RED→GREEN evidence in `about-team.test.ts` (11) + `useTeamMembers.test.ts` (4) + `e2e/team.spec.ts` (3, axe 0 critical/serious).
- (designer) rev-1 2026-10-18: @reviewer two-axis gate — 4 findings applied. (1, Standards) `PersonCard` no longer injects `SUPABASE_CLIENT_KEY` or imports `portrait.ts`: `useTeamMembers` now emits a `TeamMemberView` carrying `portraitUrl` (resolved once through the `teamPortraitUrl` seam, covered directly by `portrait.test.ts`) and the page passes it as a plain prop. (2, Spec) the per-card fallback note was over-scoped and could claim a substitution that is not visible — it now renders only when `isFallback && (role || bio)`; the rule is folded into Scope + Acceptance above (amends decision (3) of the impl entry). (3, Standards) the hook test now asserts the immediate `loading` state before the first flush.
- (reviewer) rev-2 2026-10-18: **confirmed all 4 findings fixed; 0 new Standards findings; 0 new Spec findings.** Verified the component boundary (no inject/import), the `TeamMemberView` seam + `portrait.test.ts` coverage, the pre-flush `loading` assertion, the ticket scope/acceptance amendment, and that the `isFallback && (role || bio)` gate is correct given `TEAM_MEMBER_REQUIRED_FIELDS = []` (`name` is a locale-independent root field; only role/bio localize).
- **Verification (orchestrator, working tree with the fixes):** `pnpm test` **37 files / 399 tests**; `pnpm typecheck` clean; `pnpm lint:check` clean (153 files); `pnpm build` PASS; `pnpm test:e2e` **48 passed**. **Status: done.**
