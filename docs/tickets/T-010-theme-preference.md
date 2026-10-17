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
- [ ] Three-state precedence proven: stored override > system > light fallback.
- [ ] A stored override survives reload; toggling back to "system" (if exposed) or clearing restores behaviour.
- [ ] System preference change updates the page live when no override exists.
- [ ] No visible theme flash on reload in dark mode (E2E evidence).
- [ ] Toggle exposes state to AT (`aria-pressed` or equivalent) and is keyboard operable.
- [ ] All surfaces/text pairs from T-006 are exercised in dark mode.

## Verification
```
pnpm test --run src/features/theme
pnpm test:e2e --grep "theme"
pnpm typecheck && pnpm lint:check
```

## Review gate
- @reviewer: no flash workaround that breaks CSP unnecessarily, no duplicated theme state (Pinia + DOM class only), storage access wrapped.

## Log
- (author) start:
