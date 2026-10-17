# T-032 — Full E2E journey matrix

**Session:** 7 · **Lane:** verification · **Owner:** @coder · **Status:** todo
**Reviewers:** @reviewer
**Depends on:** T-019…T-031 · **Blocks:** T-035

## Outcome
All twelve journeys from `docs/TESTING.md` §2 run deterministically in CI, including mobile viewport and keyboard-only variants.

## Scope
In — one spec per journey, all fixture-driven:
1. Anonymous navigation + direct deep link to project/publication detail.
2. Locale detection at `/`, explicit locale URLs, switching, persisted choice.
3. Theme: system first visit, override persists.
4. Homepage upcoming events in chronological order (mocked function).
5. Event with project links to the published detail; event without project renders.
6. Featured order + recent fallback.
7. Contact details/mailto and any enabled form (validation/success/error) — form path only if D-09 provides a provider; otherwise assert the no-form contract.
8. Admin routes require auth; anonymous admin mutations rejected.
9. Admin creates/edits/publishes project and publication; drafts invisible anonymously.
10. Admin associates/unassociates an event with a project.
11. Upload/download obeys the access policy.
12. Mobile viewport + keyboard-only navigation through main and admin workflows.

Out: cross-browser matrix beyond chromium (optional), visual regression snapshots, load testing.

## Design constraints
- `docs/TESTING.md` §2 (all twelve), §3, §4 (axe in key journeys).
- `docs/PRODUCT_REQUIREMENTS.md` §8 acceptance criteria.
- `docs/DESIGN_SYSTEM.md` §6.

## TDD plan
E2E tickets are themselves tests.
1. RED: write each spec first; run against the current build and record genuine failures where behaviour is incomplete.
2. GREEN: fix product code or fixture gaps until all pass — no test weakening to force green.
3. REFACTOR: extract page objects/fixtures; keep selectors role-based.

## Acceptance criteria
- [ ] 12/12 journeys present and passing headless in CI.
- [ ] No test depends on a real calendar, Supabase project, network timing, or live content.
- [ ] Keyboard-only variant proves focus visibility and no traps.
- [ ] Mobile variant at 360×640 completes each journey.
- [ ] axe assertions on home, a detail page, mobile nav, contact, and an admin form.
- [ ] Failure screenshots/traces captured as artifacts.
- [ ] Test run time documented; suite is not flaky across 3 consecutive runs.

## Verification
```
pnpm test:e2e
pnpm test:e2e --repeat-each=3 --grep "critical"
```

## Review gate
- @reviewer: every journey maps to a quoted acceptance criterion; no weakened assertions, no arbitrary waits, selectors stable.

## Log
- (author) start:
