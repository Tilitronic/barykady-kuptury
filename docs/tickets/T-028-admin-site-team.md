# T-028 — Admin site pages & team CRUD

**Session:** 6 · **Lane:** feature/admin · **Owner:** @coder · **Status:** done
**Reviewers:** @reviewer (rev-1 FIX + fixes verified) + @architector (approve-with-follow-ups)
**Depends on:** T-026, T-016, T-018 · **Blocks:** T-031, T-032

## Outcome
Administrators can edit organization page content and team entries per locale, publish/unpublish them, and see which translations are missing.

## Scope
In:
- Site pages editor: pick page (organization info), edit per-locale title/body (sanitised markdown or plain text), publish/unpublish, preview.
- Team CRUD: create/edit/reorder/delete members; optional portrait upload (T-014 validator), optional role/bio per locale; publish toggle per member.
- Reordering: explicit ascending/descending controls or numeric sort field with immediate persistence; keyboard operable (no drag-only reordering).
- Missing-translation indicators on both editors, reusing the T-027 component.
- Tests: publish requires complete fallback locale; unpublished member disappears publicly; reorder persists and is reflected in public order; portrait removal works.
- E2E: edit mission text → public About updates; add member → appears on About; unpublish → disappears.

Out: arbitrary new page creation, block-based editing, team social links.

## Design constraints
- `docs/PRODUCT_REQUIREMENTS.md` §6 (edit organization info and team entries, missing translations), §4 (About).
- `docs/architecture.md` §4.
- `docs/DESIGN_SYSTEM.md` §6.

## TDD plan
1. RED: `sitePageForm.test.ts` — `blocks publish without a complete fallback translation`, `preserves other locales when editing one`.
2. RED: `teamOrder.test.ts` — reorder updates sort_order deterministically (no duplicate positions).
3. GREEN: implement editors.
4. RED E2E: edit + publish → public reflects change; unpublish → hidden.
5. REFACTOR: extract `LocaleTabs` + `TranslationStatus` shared with T-027/T-029.

## Acceptance criteria
- [ ] Editing one locale never overwrites another locale's fields.
- [ ] Publish blocked with a localized reason when the fallback locale is incomplete.
- [ ] Team reorder persists, is collision-free, and is keyboard operable.
- [ ] Portrait upload respects type/size rules; removal cleans the reference.
- [ ] Public About reflects changes after publish (E2E).
- [ ] All admin strings translated.
- [ ] No drag-only interaction.

## Verification
```
pnpm test --run src/features/admin/content src/features/admin/team
pnpm test:e2e --grep "admin content"
```

## Review gate
- @reviewer: no cross-locale data loss, reorder integrity, admin form a11y.

## Log
- (author) start:
- (gate fix, 2026-10-23) Reviewer Major fixed: E2E `content-store` PostgREST
  ordering now compares numeric columns numerically (regression: 2 before 10)
  and applies `order=` to site-page reads too.
- (gate fix, 2026-10-23) Reviewer Minor + architector FU1 fixed: completeness
  formatter and `LocaleCompleteness` moved to neutral
  `features/admin/shared/completeness`; added shared `TranslationStatus`
  component; projects, site pages and team all render it. T-027 behavior is
  unchanged (its formatter adapter keeps the same public function).
- (gate fix, 2026-10-23) Architector FU3 bounded fix: team reorder documents
  last-writer-wins and retries once on `23505`/`40P01` with the same desired
  order. Unit test forces a first-attempt `23505`.
- Deferred: retrofitting the T-027 project editor to `AdminLocaleTabs`. Reason:
  T-027 is already shipped and locked by its own tests; the ticket requires no
  behaviour change there, and the shared tab strip is used by both new T-028
  editors. T-029 can adopt it without rework.
- Deferred: a database/integration contention scenario for concurrent reorders.
  Reason: FU3 is explicitly bounded to the caller-side retry; the DB proof for
  ordering is the deferrable unique constraint plus the dense-order pgTAP
  assertions, and a deterministic concurrent-commit test needs two sessions /
  advisory orchestration outside this batch.
- Deferred: wider retry rollout (backoff, other mutation paths, cross-feature
  retry policy). Reason: only the team-reorder path has a proven transient
  conflict class in V1; broadening before evidence would hide real failures.
- Deferred: committing `knowledge/` analyzer artifacts. Reason: they are
  pre-existing untracked research outputs; this ticket neither owns nor
  validates them. Leave untracked and never stage them.
