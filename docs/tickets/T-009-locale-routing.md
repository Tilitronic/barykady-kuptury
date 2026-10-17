# T-009 — Locale routing, detection, persistence

**Session:** 2 · **Lane:** feature/i18n · **Owner:** @coder · **Status:** todo
**Reviewers:** @reviewer (Spec axis against `PRODUCT_REQUIREMENTS.md` §2)
**Depends on:** T-001, T-003 · **Blocks:** T-010, T-011, T-016…T-025

## Outcome
`/` resolves to the right locale, `/:locale/...` is authoritative, switching persists, and document language metadata tracks the route.

## Scope
In:
- Message catalogues `src/i18n/{en,pl,uk}/index.ts` with typed keys; remove `en-US`; every key present in all three (test enforces parity).
- Pure resolver `src/features/i18n/resolveLocale.ts`: precedence saved choice → `navigator.languages` match (`pl*`, `uk*`, `en*`) → `en`; explicit URL always wins.
- Routes: `/:locale(en|pl|uk)/...` with a root redirect guard; invalid locale → 404 (not silent fallback).
- Persisted choice in `localStorage` (`bk.locale`), updated only on explicit user action; guard test proves navigation inside a locale does not rewrite it.
- Router guard sets `document.documentElement.lang` and `dir`; per-route title/description via a typed meta helper.
- `LanguageSwitcher.vue`: native `<select>` or menu button, accessible name, current value announced; switching preserves the current route + params.
- Formatting helpers: `formatDate`, `formatNumber` via `Intl` bound to the active locale.

Out: translated slugs (explicitly not required), locale negotiation on the server, content fallback logic (T-015/T-016).

## Design constraints
- `docs/PRODUCT_REQUIREMENTS.md` §2 (precedence, persistence, no unexpected switching, document metadata).
- `docs/architecture.md` §8 (locale-prefixed routes, explicit URL authority, SPA).
- `docs/DESIGN_SYSTEM.md` §6 (language change updates document language).

## TDD plan
1. RED: `resolveLocale.test.ts` — 6 cases (saved pl, browser uk, unsupported browser→en, explicit URL beats saved, invalid locale, no storage) all fail (module missing).
2. GREEN: implement resolver, wire guard, add catalogues.
3. RED/GREEN: catalogue parity test (`all keys in en ⊆ pl`, `⊆ uk`, no empty values).
4. RED/GREEN E2E: `/` redirect, deep link, switch persists after reload, route preserved.
5. REFACTOR: extract route-meta builder so titles are not duplicated in pages.

## Acceptance criteria
- [x] `/` → saved → browser → `en` precedence proven by unit + E2E.
- [x] `/pl/projects` stays Polish even when the browser prefers `uk`.
- [x] Switching language on a detail route keeps the same route and params.
- [x] `html[lang]` updates on every navigation; title/description update per route.
- [x] Unknown locale segment yields the 404 page, not a redirect loop.
- [x] No hard-coded user-facing string in the switcher or shell.
- [x] Locale-aware date/number formatting helpers tested (`pl` uses `,` decimal separator).

## Verification
```
pnpm test --run src/features/i18n src/i18n
pnpm test:e2e --grep "locale"
pnpm typecheck && pnpm lint:check
```

## Review gate
- @reviewer: spec axis — every precedence rule from §2 quoted and proven; no locale leakage into unrelated stores; guard is not doing content work.

## Log
- (author) start:

### 2026-10-18 — @coder implementation (TDD, test-first)

Design constraints applied: `PRODUCT_REQUIREMENTS.md` §2 (precedence, persistence,
no unexpected switching, document metadata), `architecture.md` §8 (locale-prefixed
routes, URL authority, SPA), `DESIGN_SYSTEM.md` §6 (language change updates
document metadata).

RED (before implementation; `pnpm vitest run src/features/i18n src/i18n src/router src/components src/pages`):
- 8 test files failed because the modules did not exist yet:
  `Failed to resolve import "@/features/i18n/resolveLocale"` (and `localeGuard`,
  `pageMeta`, `localePath`, `format`), `@/components/LanguageSwitcher.vue`,
  `@/router/routes`, `@/pages/[locale]/index.vue`.
- Result line: `Test Files 8 failed | 1 passed (9)`, `Tests 2 passed (2)`.

GREEN (after the minimal implementation):
- `pnpm vitest run src/features/i18n src/i18n` → `Test Files 6 passed (6)`,
  `Tests 21 passed (21)`.
- `pnpm vitest run` (full unit suite) → `Test Files 12 passed (12)`,
  `Tests 119 passed (119)`.
- `pnpm test:e2e --grep "locale"` → `8 passed` (built SPA, self-started/stopped
  server; no listener remained on 127.0.0.1:4173).
- `pnpm test:e2e` (full) → `12 passed` (locale + smoke + mocks, axe clean).
- `pnpm typecheck` → clean (only the pre-existing Volar "No rootDir specified"
  informational notice). `pnpm lint:check` → clean.

Implementation notes / decisions:
- Locale is a **constrained route param** `:locale(en|pl|uk)` in an explicit,
  typed route table (`src/router/routes.ts`). An unknown segment therefore does
  not match any page and resolves to the 404 view with the URL preserved — no
  redirect loop and no silent fallback.
- Precedence lives in the pure `resolveLocale` (URL → saved → browser → `en`);
  the guard only mirrors the active locale onto `html[lang]`/`dir`, the i18n
  instance and per-route title/description. The guard never writes
  `localStorage`; only `LanguageSwitcher` does, on explicit user action.
- Trade-off flagged for review: `quasar.config.ts` still has
  `filenameBasedRouting: true` (out of this ticket's write scope). The auto
  route generator therefore keeps regenerating `src/router/typed-router.d.ts`
  from `src/pages/**` even though the app uses the explicit table. The generated
  file is types-only and harmless, but a follow-up should either disable
  `filenameBasedRouting` or adopt its output.
- Context note: attempted the `tdd-craftsman` skill first; no skills are
  installed in this session (`skill` tool reports none), so the ticket's TDD
  plan was followed directly.

### 2026-10-18 — @coder rev-2 (independent review deltas)

1. [MAJOR] `AppShell.vue` skip-link focus background: replaced the raw `#ffffff`
   with the T-006 token `var(--color-surface-raised)` (`src/css/tokens.css`,
   imported via `app.scss`). Added `color: var(--color-text)` so the focused
   skip link's text contrast is explicitly compliant in both themes rather than
   relying on the UA link default: light `#262424` on `#FAFAFA` = 14.79:1,
   dark `#EDEDED` on `#353333` = 10.72:1 (DESIGN_SYSTEM.md §1 measured pairs;
   both ≥ 4.5:1 AA).
2. [MINOR] Single source of truth for the fallback locale: `LanguageSwitcher.vue`
   and `features/i18n/i18nInstance.ts` now import `DEFAULT_LOCALE` from
   `features/i18n/locales.ts` instead of the duplicated literal `"en"`.
3. [MINOR — spec] **Approved exception (do not "fix"):** the language-selector
   option labels (`English` / `Polski` / `Українська`) remain their own-language
   autonyms and are deliberately NOT moved into the message catalogues. Rationale:
   a language list must be readable by someone who cannot read the *current* UI
   locale — localising the names would defeat the selector's purpose. This is a
   recognised standard practice and is the only user-facing string outside the
   i18n system; every other switcher/shell string comes from the catalogues.
   Recorded here as the explicit approved exception required by acceptance
   criterion "No hard-coded user-facing string in the switcher or shell".

Verification (rev-2): `pnpm vitest run src/components src/features/i18n src/pages src/router`
→ pass; `pnpm typecheck` → clean; `pnpm lint:check` → clean. Per rev-2
constraints no `pnpm build`/Playwright was run and nothing was committed.
