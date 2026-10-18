# T-018 — About: team

**Session:** 4 · **Lane:** feature/content · **Owner:** @designer · **Status:** todo
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
- [ ] Empty state shown and translated; nothing fabricated.
- [ ] All optional-field combinations render without layout breakage.
- [ ] Portrait alt is meaningful when informative, empty when decorative.
- [ ] Grid adapts 320 px → desktop with no horizontal scroll.
- [ ] Ordered consistently across locales (sort_order independent of locale).
- [ ] No hard-coded names or roles.

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
