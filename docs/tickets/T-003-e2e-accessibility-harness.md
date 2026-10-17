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
- [x] `pnpm test:e2e` runs headless, starts/stops its own server, and passes.
- [x] Server is not required to be running beforehand.
- [x] axe helper fails the test on critical violations (prove once with a temporary bad fixture, then revert).
- [x] Mock helper intercepts `/.netlify/functions/calendar-events` and returns a typed fixture.
- [x] `test-results/` and `playwright-report/` are gitignored.

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
- (@coder) RED — wrote the E2E scaffolding first (specs, `playwright.config.ts`, `scripts/serve-spa.mjs`, `test:e2e*` scripts) before installing anything. `pnpm test:e2e` failed for the expected reason (exit 1):
  ```
  Error: Cannot find package '@playwright/test' imported from
    .../playwright.config.ts
  code: 'ERR_MODULE_NOT_FOUND'
  ```
- (@coder) GREEN — installed `@playwright/test@1.63.0` (pinned so its chromium revision `1243` matches the already-cached `~/.cache/ms-playwright/chromium-1243` / `chromium_headless_shell-1243`; newest available `1.64.1` maps to `1248`, which is NOT cached) and `@axe-core/playwright@4.14.0`. `pnpm test:e2e:install` exited 0 with no download. `pnpm test:e2e` then started its own server (`[serve-spa] serving .../dist/spa on http://127.0.0.1:4173`) and passed:
  ```
  Running 4 tests using 3 workers
    ✓ e2e/mocks.spec.ts  intercepts the calendar function with the typed fixture
    ✓ e2e/mocks.spec.ts  intercepts Supabase REST reads and defaults to empty data
    ✓ e2e/smoke.spec.ts  responds 200 with a non-empty title and the page heading
    ✓ e2e/smoke.spec.ts  passes axe with no critical violations
    4 passed (37.1s)   exit 0
  ```
- (@coder) axe-fail proof — added temporary `e2e/axe-fail.proof.spec.ts` rendering an `<img>` without `alt` and an empty `<button>`, then `pnpm exec playwright test e2e/axe-fail.proof.spec.ts` failed (exit 1):
  ```
  Error: axe found 2 critical violation(s):
  - button-name (critical): Buttons must have discernible text — 1 node(s)
      button
  - image-alt (critical): Images must have alternative text — 1 node(s)
      img
  expect(received).toHaveLength(expected)  Expected: 0  Received: 2
  1 failed
  ```
  The temporary spec was then deleted (`grep -rl "TEMP proof" e2e` → none) and `test-results/` removed; the final run above confirms the reverted tree is green.
- (@coder) REFACTOR — the a11y scan lives in `e2e/support/a11y.ts` (`checkA11y(page, selector?)`) and interception in `e2e/support/mocks.ts` + typed fixtures in `e2e/fixtures/calendar-events.ts`, so T-032 extends them without touching smoke.
- (@coder) Verification (from `apps/web/barykadyKultury`):
  ```
  pnpm test:e2e   → 4 passed (43.0s), exit 0
  pnpm lint:check → oxfmt check + oxlint clean (36 files), exit 0
  pnpm typecheck  → vue-tsc --noEmit exit 0
  pnpm test       → 5 passed (2 files), exit 0
  ```
  Teardown/acceptance: after `pnpm test:e2e` no listener remained on 127.0.0.1:4173 (Playwright stopped the server); `git check-ignore -v test-results playwright-report` resolves both to `apps/web/barykadyKultury/.gitignore` (root `.gitignore` also covers them).
- (@coder) Note: `@quasar/app-vite` v3 build output advertises `quasar serve`, but the harness intentionally uses the dependency-free `scripts/serve-spa.mjs` (history fallback on `dist/spa`) as Playwright's `webServer` command, matching the ticket's static-server requirement and the architecture.md §9 history-fallback behavior. Files left uncommitted in the working tree for @reviewer.
- (@coder) handoff: all acceptance criteria checked; awaiting @reviewer (determinism/no-network/role-selector/teardown gate).
- (@coder) Review finding 1 (BLOCKING) FIXED — `playwright.config.ts`: `reuseExistingServer: !process.env.CI` → `reuseExistingServer: process.env.PW_REUSE_SERVER === "1"` (reuse now defaults OFF; explicit `timeout: 180_000` retained) with a comment stating the harness owns start/stop. Origin/port extracted to `e2e/support/origin.ts` so config and guard cannot drift. Verified: `pnpm exec playwright test --list` loads the config (exit 0); a full run starts its own server and `ss -ltnp | grep 4173` is empty afterward.
- (@coder) Review finding 2 (BLOCKING) FIXED — new `e2e/support/network-guard.ts` exports an extended `test` with an auto fixture that routes all traffic, aborts any non-app-origin (`http://127.0.0.1:4173`) HTTP(S) request, records it, and fails at teardown. Mocks registered later in a test win by Playwright's reverse route precedence, so `mockCalendarEvents`/`mockSupabaseRest` keep working (proved by the passing mocks spec). Wired into `smoke.spec.ts` and `mocks.spec.ts`. Proof (temporary `e2e/network-guard.proof.spec.ts`, then deleted):
  ```
  Error: Blocked 1 unmocked external request(s). Add a mock from e2e/support/mocks.ts for each:
  http://127.0.0.1:9999/t-003-guard-probe
  1 failed   exit 1
  ```
  Note: a cross-origin `fetch` probe was rejected by the app CSP before reaching routing; a top-level navigation to a non-routable cross-port origin exercises the guard instead. After deletion `grep -rl "TEMP proof" e2e` → none; the full suite is green.
- (@coder) Review finding 3 (optional) PARTIALLY APPLIED — `smoke.spec.ts` now asserts `getByRole("heading", { level: 1 })` is visible before pinning text. The suggested `/en/` route pin was NOT applied: `src/router/typed-router.d.ts` currently generates only the `/` route and `src/boot/i18n.ts` hard-codes `en`, so navigating `/en/` would fall through to the SPA shell with no matching route and add fragility. Deferred to T-009 (locale routing), where the route and `lang` will exist to assert against.
- (@coder) Re-verification after review fixes (from `apps/web/barykadyKultury`):
  ```
  pnpm test:e2e   → 4 passed (40.1s), exit 0; 127.0.0.1:4173 empty afterward
  pnpm lint:check → oxfmt check + oxlint clean (38 files), exit 0
  pnpm typecheck  → vue-tsc --noEmit exit 0
  pnpm test       → 5 passed (2 files), exit 0
  ```
  STATUS.md / DECISIONS.md untouched; changes left uncommitted for @reviewer.
