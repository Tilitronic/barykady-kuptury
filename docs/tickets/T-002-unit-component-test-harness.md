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
- (author) start: T-001 closed at `0f34816`.
- RED: created `src/pages/__tests__/index.test.ts` and `src/test-utils/mount.ts` first, then ran `pnpm test` — exit code 1 with no script output (`vitest` not installed, no `test` script). Captured at `/tmp/opencode/red-t002.log`.
- Dependencies added (dev): `vitest` + `@vitest/coverage-v8` (runner + coverage), `@vue/test-utils` (component mounting), `happy-dom` (fast DOM environment), `@vitejs/plugin-vue` (SFC compilation in tests). Each is the minimum needed for the layer `docs/TESTING.md` §2 requires; no second test framework was added.
- Config: `vitest.config.ts` aliases `@`/`app` → `src` and `#q-app` → `@quasar/app-vite`, mirroring Quasar's own build alias (`quasar-config-file.js`: `'#q-app': '@quasar/app-vite'`). The package root resolves to `exports/wrappers.js` at runtime; an earlier attempt pointed at `@quasar/app-vite/client`, which is a declaration-only entry and would fail at runtime. Reusing Quasar's generated alias table was not possible without importing Quasar's internal config-tools, so aliases are declared explicitly and documented in the config.
- Convention: app tests live in `src/**/__tests__/*.test.ts`; infrastructure tests live in `test/unit/`; shared mount helpers in `src/test-utils/`. Setup file `test/unit/setup.ts` provides the `matchMedia` stub happy-dom lacks (needed by T-010).
- Tests: 5 falsifiable assertions across 2 files — h1 text, the placeholder paragraph in `en`, `pl`, `uk`, and a boot-file import that exercises the `#q-app` runtime alias (`src/boot/__tests__/i18n.test.ts` asserts the Quasar wrapper returns a function). Alias resolution for `@/` is proven by importing the page and helper through it.
- Deliberate-failure proof (review finding): added a temporary probe test asserting the rendered paragraph equals `"This copy does not exist"`. `pnpm test` → exit 1, `AssertionError: expected 'Website content is being prepared.' to be 'This copy does not exist'`, 1 failed / 5 passed. Probe deleted immediately; the final suite is 5 passed.
- Coverage correction (review finding): the v8 remapper cannot parse type-only syntax in files no test imports, so `src/boot/**` and `src/stores/**` are excluded with an in-config rationale. Before the exclusion the report silently dropped them with `PARSE_ERROR`; after it, `pnpm test:coverage` emits the summary with no parse warnings.
- `test` and `test:unit` are intentionally identical for now (`vitest run`); `test` is the canonical gate and `test:unit` exists so CI can target the layer once E2E lands. Documented here rather than adding a premature distinction.
- Scope note (review finding): the close-out edits for T-001 (criterion wording, Log, STATUS row) landed in this commit's working tree and were therefore included. They are bookkeeping for the previous ticket, not T-002 implementation.
- Verification: `pnpm test` → 5 passed (2 files), exit 0. `pnpm test:coverage` → v8 report, no parse warnings, exit 0. `pnpm typecheck` → exit 0 (pre-existing `vue-router` rootDir advisory only). `pnpm lint:check` → 29 files formatted, oxlint clean.
- No production code changed; only the app `package.json` scripts, test config, test utilities and the ticket itself.
