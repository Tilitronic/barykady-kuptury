# T-003 — E2E + accessibility harness

**Session:** 1 · **Lane:** foundation/testing · **Owner:** @coder · **Status:** todo
**Reviewers:** @reviewer
**Depends on:** T-001 · **Blocks:** T-009, T-010, T-011, T-032, T-033

## Outcome
Playwright starts the built app on a fixed port, runs a smoke journey, and has axe wired for accessibility assertions. Calendar and Supabase are mockable from the start.

## Scope
In:
- `@playwright/test`, browsers config (chromium mandatory; firefox/webkit optional in CI), `playwright.config.ts` with `webServer` running `quasar build && quasar serve` or vite preview on `127.0.0.1:4173`.
- `e2e/smoke.spec.ts`: page responds 200, has non-empty `<title>`, and passes `axe` with no critical violations.
- `e2e/fixtures/` directory + `e2e/support/mocks.ts` for intercepting the calendar function and Supabase REST endpoints (skeleton only, filled in T-023/T-032).
- `@axe-core/playwright` helper `checkA11y(page, selector?)`.
- Scripts: `test:e2e`, `test:e2e:ui`, `test:e2e:install`.

Out: the full 12-journey matrix (T-032).

## Design constraints
- `docs/TESTING.md` §2 (Playwright mandatory, deterministic, no live services), §4 (axe integrated into journeys).
- `docs/DESIGN_SYSTEM.md` §6 (WCAG 2.2 AA target).

## TDD plan
1. RED: write `e2e/smoke.spec.ts` first; `pnpm test:e2e` fails with "Playwright not installed".
2. GREEN: install + configure until the smoke spec and axe check pass.
3. REFACTOR: extract the a11y helper and the mock module so T-032 can extend them.

## Acceptance criteria
- [ ] `pnpm test:e2e` runs headless, starts/stops its own server, and passes.
- [ ] Server is not required to be running beforehand.
- [ ] axe helper fails the test on critical violations (prove once with a temporary bad fixture, then revert).
- [ ] Mock helper intercepts `/.netlify/functions/calendar-events` and returns a typed fixture.
- [ ] `test-results/` and `playwright-report/` are gitignored.

## Verification
```
pnpm test:e2e
pnpm lint:check
pnpm typecheck
```

## Review gate
- @reviewer: determinism (no network, no real clock/tz dependence), no prod credentials, selectors are role/label based rather than CSS-position based, teardown clean.

## Log
- (author) start:
