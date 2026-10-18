# T-015 — Generated types & feature data access

**Session:** 3 · **Lane:** data/architecture · **Owner:** @coder · **Status:** todo
**Reviewers:** @reviewer + @architector
**Depends on:** T-012, T-013 · **Blocks:** T-016…T-025, T-027…T-031

## Outcome
One typed Supabase client, generated database types, and small per-feature data-access modules with pure, unit-tested mapping logic — no raw query construction in components.

## Scope
In:
- `src/types/database.types.ts` generated from the migrated schema via `supabase gen types`; script `pnpm types:db` documented (requires local Supabase only).
- `src/boot/supabase.ts`: single browser client from `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY`; fails loudly in dev when missing, degrades to a clear "content unavailable" state in production (never a service key).
- Feature modules: `src/features/{content,projects,publications,team,documents,events}/api.ts` — typed select functions returning domain models, never raw rows.
- Pure mappers with translation fallback: `selectTranslation(row, locale, { allowFallback: true })` → `{ value, isFallback }`; only complete published translations are considered (docs §4 requirement).
- `featuredProjects(projects)` and `recentProjects(projects)` ordering helpers (fallback behaviour is consumed in T-025 but defined and tested here).
- Unit tests with a fake Supabase client (typed, no network): published filter, fallback flag, ordering, empty result.
- Error model: `{ kind: 'unavailable' | 'empty' | 'ok' }` so pages can render explicit states.

Out: UI components, RLS (T-013), admin mutations (T-027+).

## Design constraints
- `docs/architecture.md` §3 (feature modules, typed data access, thin components), §4 (translation/fallback rules).
- `AGENTS.md` rule 4, rule 9 (no hard-coded strings), "generated types derived from migrated schema".
- `docs/TESTING.md` §2 (unit tests for sorting/fallback/joins).

## TDD plan
1. RED: `selectTranslation.test.ts` — `returns Polish when complete`, `falls back to English and flags isFallback`, `ignores an incomplete published translation`.
2. GREEN: implement mapper + fallback policy.
3. RED: `featuredProjects.test.ts` — featured order respected; empty featured ⇒ most-recently-updated published; drafts excluded.
4. RED: `api.test.ts` with fake client — query filters published only, and maps rows to domain objects without leaking DB column names.
5. REFACTOR: one shared `Result`/state type across modules.

## Acceptance criteria
- [ ] No component-level `supabase.from(...)` exists after this ticket (grep check).
- [ ] Domain models contain locale-resolved fields plus `isFallback` metadata.
- [ ] Fallback is English-only and can be disabled per call site.
- [ ] Featured/recent helpers are pure and fully tested.
- [ ] Missing env vars produce a clear, non-crashing state; no secret-shaped variable is referenced.
- [ ] Generated types are committed and reproducible via the documented script.

## Verification
```
pnpm types:db        # local Supabase
pnpm test --run src/features
pnpm typecheck
rg -n "supabase\\.from" src --glob '!src/features/*/api.ts' || true
```

## Review gate
- @reviewer: no duplicated query builders, mappers free of UI concerns, error states usable.
- @architector: boundary between feature modules and pages preserved; no generic service layer.

## Log
- (author) start:
- (part 1, data layer scaffolding) `pnpm types:db` added to the root `package.json` and **D-22 finalised**: the app-local `supabase@2.121.0` devDependency is used as `pnpm --dir apps/web/barykadyKultury exec supabase --workdir "$PWD" gen types typescript --local`, i.e. the workspace root is passed as an absolute workdir. The relative `--workdir ../..` plumbing the review note suggested does **not** work (the CLI resolves the relative path against the resolved binary location and reports `supabase start is not running`); pinning the absolute root avoids it. No root lockfile/workspace was introduced (D-01/architecture §2). Outcome: regeneration reproduces a byte-identical `src/types/database.types.ts` (21 203 bytes, all 12 content tables + `content_status`/`content_locale` enums).
- Added the single browser client `src/boot/supabase.ts` with the env/decision policy extracted to the pure helper `src/features/content/supabaseConfig.ts` (unit-tested; `src/boot/**` is excluded from vitest coverage). Dev with missing vars throws; production returns `{ kind: "unavailable" }` and the client is `null`. No service-role/secret variable is referenced (proven by test).
- Supporting config: `env.d.ts` types the two `VITE_*` vars, `quasar.config.ts` registers the `supabase` boot, and `oxlint.config.ts` excludes the machine-generated `src/types/database.types.ts` from lint (its generated `never`-union helpers trip a correctness rule and must not be hand-edited).
- Added deps: `@supabase/supabase-js` (runtime client) and `supabase` (devDependency for `types:db`); both app-local, lockfile committed.
- Part 1 verification: `pnpm types:db` OK (identical output); `pnpm test` 25 files / 308 tests pass; `pnpm typecheck` OK; `pnpm lint:check` OK.
