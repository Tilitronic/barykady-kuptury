# T-030 — Admin featured ordering

**Session:** 6 · **Lane:** feature/admin · **Owner:** @coder · **Status:** todo
**Reviewers:** @reviewer
**Depends on:** T-027 · **Blocks:** T-032

## Outcome
An administrator can mark published projects as featured and control their order; the homepage honours that order and falls back to recent published projects when nothing is featured.

## Scope
In:
- Featured view: list of currently featured published projects in order, add/remove, move up/down.
- Persistence: `featured_rank` (dense, gap-free, deterministic) updated transactionally; unpublishing or deleting a featured project removes it from the featured set without breaking order.
- Guard: only published projects can be featured (drafts rejected with a localized message).
- Tests: add/remove/reorder produces gap-free ranks; reordering is deterministic under concurrent saves (last-write-wins documented); unpublish removes from featured; empty featured set ⇒ homepage fallback.
- E2E: feature two projects in a chosen order → homepage reflects order; unfeature both → recent published shown.

Out: drag-and-drop reordering, scheduling featured content, per-locale featured sets.

## Design constraints
- `docs/PRODUCT_REQUIREMENTS.md` §5, §6 (featured selection and order), §8.
- `docs/architecture.md` §4 (predictable ordering).
- `docs/DESIGN_SYSTEM.md` §6 (keyboard operability).

## TDD plan
1. RED: `reorderFeatured.test.ts` — `produces dense ranks after a move`, `rejects drafts`, `removes unpublished on read`.
2. GREEN: implement reorder service + view.
3. RED E2E: featured order on homepage; empty-featured fallback.
4. REFACTOR: reuse the T-028 ordering control if its contract fits.

## Acceptance criteria
- [ ] Ranks remain gap-free and unique after any add/remove/move sequence.
- [ ] Drafts cannot be featured (service + RLS/test).
- [ ] Unpublished/deleted projects disappear from featured without manual cleanup.
- [ ] Homepage order matches admin order exactly (E2E).
- [ ] Empty featured set triggers the recent-published fallback (E2E).
- [ ] Reordering is keyboard operable; no drag-only path.
- [ ] All strings translated.

## Verification
```
pnpm test --run src/features/admin/featured
pnpm test:e2e --grep "featured"
```

## Review gate
- @reviewer: rank integrity, no duplicate ordering, fallback still correct after mutations.

## Log
- (author) start:
