# T-010 — Theme preference system

**Session:** 2 · **Lane:** feature/theme · **Owner:** @coder · **Status:** todo
**Reviewers:** @reviewer
**Depends on:** T-006, T-009 · **Blocks:** T-011, T-033

## Outcome
First visit follows `prefers-color-scheme`, an explicit choice overrides and persists, system changes still apply when no choice is stored, and there is no light/dark flash.

## Scope
In:
- Pure `resolveTheme({ systemPrefersDark, stored })` → `'light' | 'dark'`, plus `nextOverride(current)` cycling logic.
- Boot: inline script in `index.html` applies the resolved theme class before first paint (reads `localStorage` key `bk.theme`), no flash.
- Runtime: matchMedia listener active only when no stored override.
- `ThemeToggle.vue`: visible pressed state + accessible name that states the action, keyboard operable, no icon-only ambiguity.
- Quasar `Dark` plugin used as the single source of truth for component theming; brand tokens keyed off the same class.
- Storage failure (privacy mode) must not break the page — guarded access with tests.
- Unit tests for resolver + storage guard; E2E for system-preference first paint, override persistence, and no-flash.

Out: per-page theme overrides, high-contrast theme (only reduced motion is covered in T-006).

## Design constraints
- `docs/PRODUCT_REQUIREMENTS.md` §3.
- `docs/DESIGN_SYSTEM.md` §5 (full token coverage, initial preference, persistence) and §6 (pressed state, no flash).
- `docs/architecture.md` §8 (boot file placement).

## TDD plan
1. RED: `resolveTheme.test.ts` — `stored override wins over system`, `system applies when no override`, `invalid stored value is ignored`, `storage throwing does not throw` — all fail.
2. GREEN: implement resolver + guard + boot script.
3. RED E2E: emulate `colorScheme: 'dark'` → page background token is dark on first paint (assert computed style before hydration is hard; approximate via `addInitScript` + first-frame check).
4. RED E2E: toggle → reload → preference persists and system change is ignored.
5. REFACTOR: single storage module shared with T-009 (locale) if the abstraction is genuinely shared.

## Acceptance criteria
- [x] Three-state precedence proven: stored override > system > light fallback.
- [x] A stored override survives reload; toggling back to "system" (if exposed) or clearing restores behaviour.
- [x] System preference change updates the page live when no override exists.
- [x] No visible theme flash on reload in dark mode (E2E evidence).
- [x] Toggle exposes state to AT (`aria-pressed` or equivalent) and is keyboard operable.
- [x] All surfaces/text pairs from T-006 are exercised in dark mode.

## Verification
```
pnpm test --run src/features/theme
pnpm test:e2e --grep "theme"
pnpm typecheck && pnpm lint:check
```

## Review gate
- @reviewer: no flash workaround that breaks CSP unnecessarily, no duplicated theme state (Pinia + DOM class only), storage access wrapped.

## Log

### 2026-10-18 — @coder TDD run

**Pre-paint / CSP approach (constraint 2) — option (b) chosen.**
`public/theme-init.js` is a self-hosted, classic (parser-blocking) external script
referenced from `index.html` as `<script src="/theme-init.js"></script>` (after the
CSP meta). `script-src 'self'` allows it, so the CSP is **unchanged** — no
`unsafe-inline`, no SHA-256 hash to maintain.

Rationale vs option (a) (inline script + CSP hash): a hash must be recomputed on
every byte change of the inline script (fragile, silently breaks in dev/build), and
any whitespace/formatting change re-opens the hole; the external file is cacheable
and immune to that class of silent breakage. The pre-paint script only sets the
`[data-theme]` selector (D-20 mechanism a); the `bk.theme` read is guarded
(`try/catch`) so blocked storage cannot throw during parse.

**Parity with the pure resolver.** `src/features/theme/theme.ts → resolveTheme` is
the single logical source of truth. `public/theme-init.js` re-implements the same
precedence (stored override > `prefers-color-scheme` > light) in plain ES5 because
it runs before any bundle. `src/features/theme/__tests__/themeInitParity.test.ts`
executes the **real shipped script** in a controlled DOM for a 7-case matrix
(valid/invalid/empty/absent stored × system dark/light × storage-throwing) and
asserts it produces exactly the theme `resolveTheme` returns, so the two cannot
silently drift.

**D-20 wiring.** One write point: `themeRuntime.ts → applyTheme` sets
`document.documentElement[data-theme]` (`applyBrandTheme`) **and**
`Quasar.Dark.set(theme === "dark")` together. `.dark` class is never applied
(asserted in E2E: `html.classList.contains("dark") === false`). `Quasar.Dark`
(`body--dark`) is the component-theming truth; brand tokens key off the same
resolved value.

**State model (constraint 7).** No Pinia. A module-scoped reactive
`createThemeController` (injected deps) is the single source of truth: `override`
is the only persisted input, `theme` the only applied output, and every transition
flows through one `apply`. `ThemeToggle.vue` mutates the shared controller and
holds no state.

**RED — unit (step 1).** Wrote `__tests__/theme.test.ts` + `__tests__/themeStorage.test.ts`
first; both failed with `Failed to resolve import "@/features/theme/theme"` (modules
not implemented) — the expected reason for brand-new modules.

**GREEN — unit (step 2).** Implemented `theme.ts`, `themeStorage.ts`,
`systemTheme.ts`, `brandTheme.ts`, `themeController.ts`, `themeRuntime.ts`,
`boot/theme.ts` (+ `boot` registration), i18n keys in en/pl/uk, `ThemeToggle.vue`,
`AppShell.vue` mount, `index.html` + `public/theme-init.js`.
`vitest run src/features/theme src/components/__tests__/ThemeToggle.test.ts` →
**5 files, 31 passed**.

**RED — E2E (steps 3–4).** Wrote `e2e/theme.spec.ts`; to prove the no-flash test
can fail, temporarily renamed `public/theme-init.js` and ran
`pnpm test:e2e --grep theme` → **1 failed, 3 passed**:
`a stored override is applied before the app bundle runs (no flash)` failed with
`expect(locator).toHaveAttribute('data-theme','dark') / Received: ""` (attribute
`null`) — the correct reason (pre-paint path absent; app bundle neutralised by the
test). Restored the file.

**GREEN — E2E.** `pnpm test:e2e --grep theme` → **4 passed**.

**Verification (actual).**
- `pnpm test` (full) → **17 files, 172 passed** (baseline before ticket: 12/141,
  i.e. +5 files / +31 tests, all theme).
- `pnpm typecheck` → **passed** (only the pre-existing
  `[vue-router] No rootDir specified…` notice).
- `pnpm lint:check` → **passed** (after `pnpm format`; fixed 5 formatting diffs,
  `no-unused-vars` on the script's catch bindings, and `no-implied-eval` on the
  parity test's intentional `new Function`, which executes the real shipped
  script).
- `pnpm test:e2e --grep theme` → **4 passed** (self-built `pnpm build` succeeded
  inside the harness).
- Full `pnpm test:e2e` (regression check, incl. smoke axe) → **16 passed**.
- `pnpm test` again after E2E → **17 files, 172 passed** (no regression).

**REFACTOR (step 5) — evaluated, deliberately not forced.** The T-009
`localeStorage` store guards nothing and only needs `getItem`/`setItem`;
`themeStorage` needs a `removeItem` and must never throw in privacy mode. A shared
abstraction would either drop the guard the theme needs or add unused surface to
the locale store, so the two stay separate (per "do not force it").

**Decisions / deviations for the reviewer.**
- `nextOverride(current)` cycles between the two explicit themes (a 2-state
  toggle); "return to system" is **not exposed** in V1 (acceptance allows "if
  exposed") — clearing `bk.theme` restores system following. The controller's
  `setOverride(null)` is implemented and unit-tested for a future control.
- `ThemeToggle` is mounted in the existing `AppShell` header so the E2E toggle
  journey is reachable; T-011 replaces the header and should keep it.
- Accessible name is the constant i18n label ("Dark theme" / "Tryb ciemny" /
  "Темна тема") with `aria-pressed` exposing state — the standard toggle-button
  pattern; a name that changes per press would contradict `aria-pressed` for AT.
- `public/theme-init.js` is referenced with a root-absolute path (`/theme-init.js`),
  matching the configured `publicPath: '/'`. Netlify serves the existing static
  file ahead of the `/* → /index.html` rewrite, so no `netlify.toml` change is needed.

### 2026-10-18 — review verdict (@reviewer, rev-1) and close-out (orchestrator)

Two-axis review on the uncommitted tree (fixed point `26a639b`).

**Standards:** 0 findings. Deliberate pre-paint duplication of the resolver is
accepted — it is controlled by `themeInitParity.test.ts` (executes the real
shipped script over a 7-case matrix), justified by pre-bundle execution.

**Spec:** one **Major** raised, now **resolved**:
- `ThemeToggle.vue` accessible name did not *state the action* (spec line 15).
  Fixed: `theme.toggleLabel` → `"Toggle dark theme"` / `"Przełącz tryb ciemny"` /
  `"Перемкнути темну тему"` in all three catalogues; the name stays constant while
  `aria-pressed` conveys state (no double-encoding). Component docblock updated.
  `ThemeToggle.test.ts` and `e2e/theme.spec.ts` label references updated to match.
- (Suggestion) `STATUS.md` scope noise — accepted as orchestrator-owned
  operational metadata; no change.

**Ticket-specific review gates — all PASS:** CSP unchanged and pre-paint proven;
single theme state / no `.dark` class; storage access guarded; D-20 dual trigger
(`[data-theme="dark"]` + `Quasar.Dark.set()`) driven together.

**Re-check after the fix:** Standards resolved; Spec Major resolved; gates still
PASS. Orchestrator re-ran the full gate after the label change:

- `pnpm test` → **17 files / 172 passed**
- `pnpm typecheck` → passed (pre-existing vue-router `rootDir` notice only)
- `pnpm lint:check` → passed
- `pnpm test:e2e --grep theme` → **4 passed**

**Acceptance criterion 6 evidence:** every T-006 surface/text pair is validated in
dark mode by the T-006 gates (`tokens.test.ts` requires every `REQUIRED_TOKENS`
entry in `[data-theme="dark"]`; `contrast.test.ts` parses `tokens.css` and checks
each `CONTRAST_PAIRS` entry against the dark block), and the runtime application
of the dark tokens is proven by `e2e/theme.spec.ts` (`--color-background` = NERO,
`body--dark`). No new surface tokens were introduced by T-010.

**Close-out:** acceptance criteria all satisfied; ticket moved to `done`.

