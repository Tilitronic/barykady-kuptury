# T-001 — Repository & toolchain baseline

**Session:** 1 · **Lane:** foundation/architecture · **Owner:** @boss (structural) · **Status:** todo
**Reviewers:** @reviewer (Standards + Spec) + @architector (layout/constraints)
**Depends on:** D-01, D-02 · **Blocks:** T-002…T-035

## Outcome
The project root is a single git repository containing `docs/`, `AGENTS.md`, `NGOinfoSources/` and `apps/`. The Quasar app builds with `history` routing, no demo scaffold remains, and the chosen lint/format toolchain runs green.

## Scope
In:
- Decide D-01/D-02 and record the outcome in `DECISIONS.md` + `docs/architecture.md`.
- Make the project root the git repository (existing app history preserved or explicitly re-initialised — record which).
- Root `.gitignore`, root `README.md` pointing at docs and tickets.
- Remove Quasar demo artifacts: `src/pages/index.vue`, `src/pages/index/(index).vue`, `src/pages/index/second.vue`, `src/pages/[...path].vue`, `src/components/EssentialLink.vue`, `src/assets/quasar-logo-vertical.svg`, `src/stores/example-store.ts`.
- Replace `src/pages` with a minimal real home route placeholder (no invented content).
- `vueRouterMode: "history"`; add `netlify.toml` with SPA redirect and publish dir `apps/web/barykadyKultury/dist/spa`.
- Scripts: `dev`, `build`, `typecheck`, `lint`, `lint:check`, `format:check`.

Out: Turborepo, tests (T-002/T-003), Supabase, any content feature.

## Design constraints
- `docs/architecture.md` §2 (layout, "create only needed dirs"), §9 (publish dir, history fallback).
- `AGENTS.md` rule 7 (avoid needless complexity), rule 10 (ESLint/Prettier or recorded alternative).
- D-01/D-02 decision rows.

## TDD plan
Infra ticket — verification-first.
1. RED: record the failing checks on the untouched scaffold (`git` root missing docs; `pnpm build` after demo removal fails on missing routes; `quasar` dev serves `#/`).
2. GREEN: apply restructuring until every check below passes.
3. REFACTOR: remove dead config left from the demo (`roboto-font`/`material-icons` extras only if actually unused after T-007).

## Acceptance criteria
- [ ] `git rev-parse --show-toplevel` returns the project root; `git status` is clean.
- [ ] `docs/`, `AGENTS.md`, `NGOinfoSources/` are tracked.
- [ ] No demo page/component/store/asset remains; `rg -i "quasar-logo|EssentialLink|second.vue"` returns nothing.
- [ ] Router uses `history`; the built SPA served with a history fallback returns `index.html` for unknown paths (`/` → 200, `/en/` → 200), and `netlify.toml` provides the same redirect in production. Locale-prefixed routes themselves are implemented in **T-009** — this ticket proves the fallback contract, not locale routing.
- [ ] `pnpm lint:check`, `pnpm typecheck`, `pnpm build` pass.
- [ ] `DECISIONS.md` D-01/D-02 are `decided` with rationale.

## Verification
```
git rev-parse --show-toplevel && git status --short
rg -i "quasar-logo|EssentialLink" apps/web/barykadyKultury/src || true
pnpm --dir apps/web/barykadyKultury lint:check
pnpm --dir apps/web/barykadyKultury typecheck
pnpm --dir apps/web/barykadyKultury build
```

## Review gate
- @reviewer: no orphaned config, no demo remnants, script names match `AGENTS.md`, no content invented in the placeholder page.
- @architector: layout matches (or documents a deliberate divergence from) `docs/architecture.md` §2.

## Log
- (author) start: decisions D-01/D-02 recorded (`decided`).
- RED baseline: `git rev-parse --show-toplevel` resolved to `apps/web/barykadyKultury` while `docs/`, `AGENTS.md` and `NGOinfoSources/` were untracked; router mode was `hash`; demo pages/components/store present.
- GREEN: moved `.git` to the project root, added root `.gitignore`/`README.md`/`package.json`/`netlify.toml`, removed demo `pages/*`, `EssentialLink.vue`, `quasar-logo-vertical.svg`, `example-store.ts`; replaced i18n `en-US` with `en`; set `vueRouterMode: "history"`.
- Verification: `pnpm lint:check` — all files formatted, oxlint clean (22 files). `pnpm typecheck` — exit 0 (only a `vue-router` rootDir advisory). `pnpm build` — Build succeeded, SPA output at `apps/web/barykadyKultury/dist/spa`.
- Deep-link check: served `dist/spa` with SPA fallback on :4173 — `/` → 200, `/en/` → 200, `<title>Barykady Kultury</title>`.
- `rg -i "quasar-logo|EssentialLink|second.vue" src` → no matches.
- Commit: `bec10ba`.
- Note: `quasar serve` is unavailable in `@quasar/app-vite` v3 (no `serve` command); no `preview` script was added. T-003 owns the preview server for Playwright.
- Independent review (rev-1, range `fdbe7c9...0f34816`): 5 Standards + 4 Spec findings raised, all Major/Critical items resolved in `0f34816`; verdict: "T-001 can be closed".
- Review fixes: `docs/architecture.md` records D-01/D-02 and the implemented layout; pl/uk i18n bundles added (rule 9); README documents app-local install and content-source policy; acceptance criterion reworded to the actual history-fallback contract (locale routes explicitly T-009).
- Clean tree evidence: `git status --short` empty immediately after `0f34816`; subsequent ledger/ticket edits are committed bookkeeping only.
- Carried to T-004: the batch commit (`bec10ba`) mixes baseline and source-material import; no action required beyond the doc alignment ticket.
