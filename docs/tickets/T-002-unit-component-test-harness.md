# T-002 — Unit/component test harness

**Session:** 1 · **Lane:** foundation/testing · **Owner:** @coder · **Status:** todo
**Reviewers:** @reviewer
**Depends on:** T-001 · **Blocks:** T-006…T-033 (all test-first tickets)

## Outcome
`pnpm test` runs Vitest with Vue Test Utils + happy-dom, coverage is reported, and at least one real component test proves the harness works against the app's actual mount setup.

## Scope
In:
- Add `vitest`, `@vue/test-utils`, `happy-dom`, `@vitest/coverage-v8`.
- `vitest.config.ts` merging the Quasar/Vite alias config (`#q-app`, `src`, `app`), `environment: 'happy-dom'`, jsdom-compatible setup file.
- `test/unit/setup.ts` with global stubs needed by Quasar components.
- `src/test-utils/mount.ts` helper that mounts a component with Pinia + i18n + router.
- First real test: `src/layouts/__tests__/` or `src/App.test.ts` asserting the app renders a `<main>` landmark and the document language attribute is set from the active locale (will be finalised in T-009; assert the current contract only).
- Scripts: `test`, `test:unit`, `test:coverage`, `test:watch`.

Out: Playwright (T-003), snapshot-heavy tests, E2E.

## Design constraints
- `docs/TESTING.md` §1 (TDD loop), §2 (unit vs component layers), §5 (gates).
- `AGENTS.md` rule 1 (TDD), rule 10 (separate reproducible commands).
- Single test framework only — no Jest.

## TDD plan
1. RED: create `src/App.test.ts` before installing anything; `pnpm test` fails with "vitest: not found" (record output).
2. GREEN: install and configure Vitest + helper until the test passes.
3. RED/GREEN: add one failing assertion that imports a `@/`-aliased module to prove alias resolution, then fix config.

## Acceptance criteria
- [ ] `pnpm test` executes ≥3 tests and exits 0.
- [ ] A test that deliberately fails (temporary) is detected — proven once and reverted.
- [ ] `@/` and `#q-app` aliases resolve inside tests.
- [ ] `pnpm test:coverage` emits a coverage summary.
- [ ] Tests run in CI mode without watch hanging.

## Verification
```
pnpm test --run
pnpm test:coverage --run
pnpm typecheck
```

## Review gate
- @reviewer: no test-only code leaking into production bundles, config not duplicating Quasar aliases by hand where they can be imported, no fake assertions that cannot fail.

## Log
- (author) start:
