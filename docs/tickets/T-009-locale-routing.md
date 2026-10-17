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
- [ ] `/` → saved → browser → `en` precedence proven by unit + E2E.
- [ ] `/pl/projects` stays Polish even when the browser prefers `uk`.
- [ ] Switching language on a detail route keeps the same route and params.
- [ ] `html[lang]` updates on every navigation; title/description update per route.
- [ ] Unknown locale segment yields the 404 page, not a redirect loop.
- [ ] No hard-coded user-facing string in the switcher or shell.
- [ ] Locale-aware date/number formatting helpers tested (`pl` uses `,` decimal separator).

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
