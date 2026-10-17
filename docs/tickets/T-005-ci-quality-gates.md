# T-005 — CI quality gates

**Session:** 1 · **Lane:** foundation/ci · **Owner:** @coder · **Status:** todo
**Reviewers:** @reviewer
**Depends on:** T-001, T-002, T-003 · **Blocks:** T-032, T-035

## Outcome
A GitHub Actions workflow runs the eight gates from `docs/TESTING.md` §5 with frozen lockfile, dummy public env values, and no production credentials.

## Scope
In:
- `.github/workflows/ci.yml`: install (frozen lockfile) → format check → lint → typecheck → unit tests → build → Playwright with browser cache → upload report artifacts.
- Dummy browser-safe env values for CI (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` pointing at a local/mock server, never real).
- Cache pnpm store; Node version from `package.json` engines.
- Optional job skeleton for DB/RLS tests, gated on `supabase` being configured (skip cleanly when secrets are absent — never fail on missing prod creds).
- `README` CI badge/section.

Out: deployment workflow (T-034), secrets provisioning, release automation.

## Design constraints
- `docs/TESTING.md` §5 (gate order), §7 (`CI must not require production credentials` — architecture §9).
- `docs/architecture.md` §9.

## TDD plan
Infra — verification-first.
1. RED: push-less local proof — run the workflow steps locally in order via a `scripts/ci-local.sh`; it fails at the missing script names before T-002/T-003 land.
2. GREEN: workflow + script green locally.
3. REFACTOR: deduplicate step definitions between `ci-local.sh` and the workflow YAML where practical.

## Acceptance criteria
- [x] Workflow YAML validates (`actionlint` or `yamllint` if available; otherwise documented manual schema check).
- [x] Every gate is a separate step with a clear name; a failure is attributable.
- [x] No secret is required for a green run; placeholder values are obviously fake.
- [x] Playwright report uploads even on failure.
- [x] `scripts/ci-local.sh` reproduces the whole gate sequence and exits non-zero on any failure.

## Verification
```
bash scripts/ci-local.sh
```

## Review gate
- @reviewer: no secrets, no `|| true` masking a required gate, correct working directory for the app, cache keys do not leak env, failure artifacts present.

## Log
- (author) start:
- (author) RED (2026-10-17, verification-first, before any file was created) — two honest *current* failures, exit-code captured:
  1. `bash scripts/ci-local.sh` → `bash: scripts/ci-local.sh: No such file or directory`, **exit 127** (the local gate runner did not exist).
  2. `pnpm run test` at the repository root → `ERR_PNPM_NO_SCRIPT  Missing script: test` / `Command "test" not found.`, **exit 1** (the root delegating `test*` scripts that `AGENTS.md` expects were absent).
  The ticket's original TDD plan mentions failing at "missing T-002/T-003 script names"; that is **superseded and deliberately not claimed** — T-002/T-003 landed, so the honest RED is the two failures above.
- (author) GREEN (2026-10-17) — `bash scripts/ci-local.sh` **exit 0**, 8 gates, each attributable by name and labelled identically to the workflow step names:
  `Gate 1 install (frozen lockfile)` 17s · `Gate 2 formatting (oxfmt)` 2s · `Gate 3 lint (oxlint + oxfmt)` 11s · `Gate 4 type check (vue-tsc)` 38s · `Gate 5 unit/component (vitest, 5 passed / 2 files)` 18s · `Gate 6 DB/RLS` **SKIP (not configured)** 0s · `Gate 7 Playwright E2E (4 passed, 43.6s, chromium, own server on 127.0.0.1:4173)` 56s · `Gate 8 production build (quasar build)` 39s.
- (author) Fail-path proof (acceptance: "exits non-zero on any failure") — an isolated copy of the script (`/tmp/opencode/ci-neg`, with `apps/` + `package.json` symlinked so the repository was **not** mutated) had Gate 2 replaced by `false`: output `PASS Gate 1 …` then `FAIL Gate 2 — Formatting check (oxfmt) (exit 1, 0s)` + `ci-local: STOPPED at "Gate 2 …"`, **exit 1**. The committed script was verified untouched afterwards.
- (author) YAML validation — `actionlint` and `yamllint` are **not installed** on this machine (`command -v` → missing) and `python3 -m pip` is unavailable, so `actionlint` **v1.7.7** was downloaded to the throwaway path `/tmp/opencode` and run: `/tmp/opencode/actionlint -color .github/workflows/ci.yml` → **exit 0, zero findings**. Additionally a PyYAML parse (`yaml.safe_load`) succeeded and a scripted schema check confirmed: 8 `Gate N — …` steps present in §5 order; every step has exactly one of `run`/`uses`; **no `if:` expression anywhere references `secrets`**; Gate 6's condition is `env.SUPABASE_DB_URL != ''`; the upload step's condition is `always()`. Note: PyYAML parses the top-level `on:` key as boolean `True` (YAML 1.1 quirk) — harmless here, but it is why the key list printed as `['name','True',…]`; `actionlint` reads it correctly as `on`.
- (author) Decisions and deviations (each traced to a design rule):
  - **Gate order** — `docs/TESTING.md` §5, i.e. E2E (7) **before** production build (8). The Scope bullet lists build before Playwright; §5 is the cited design constraint for order, so §5 wins. Gate 7's `webServer` performs its own `pnpm build` (T-003 contract, untouched), so a broken build still fails inside Gate 7; Gate 8 re-builds and validates the deployable artifact.
  - **Frozen install targets the app, never the root** — the lockfile is `apps/web/barykadyKultury/pnpm-lock.yaml` (workspace root = app); root-level `--frozen-lockfile` cannot work. Both the workflow and the script use `pnpm --dir apps/web/barykadyKultury install --frozen-lockfile`.
  - **Root-script gap closed (in scope)** — added root `test`, `test:coverage`, `test:e2e`, `test:e2e:install` delegating through the existing `pnpm --dir apps/web/barykadyKultury …` pattern, because `AGENTS.md` specifies those root commands as expected intent and the workflow calls them. No new dependency was added.
  - **Secrets-gating pitfall** — GitHub Actions cannot resolve `secrets` in an `if:` (job *or* step level). Gate 6 therefore maps the secret at job level (`env: SUPABASE_DB_URL: ${{ secrets.SUPABASE_DB_URL }}`) and tests the mapped env in a step-level `if: env.SUPABASE_DB_URL != ''`; the step additionally exits 0 with an `::notice::` when `supabase/migrations` is absent. With no secret configured the value expands to `""`, so the gate skips cleanly and no production credential is ever required for a green run.
  - **Deviation: Gate 6 is a step, not a separate job.** The Scope says "optional job skeleton". A separate job cannot sit between gates 5 and 7 without either losing §5 order (jobs run in parallel) or chaining `needs:` through a job that is skipped in the common case — GitHub then skips the dependents too unless they carry `if: !cancelled()`, which would also let them run after a real failure and break per-gate attribution. Keeping it as an in-order step preserves §5 order, keeps failures attributable, and avoids a duplicated install. It is self-contained so it can be promoted to a job when Supabase config lands (T-012/T-013). Flagging this explicitly for @reviewer to adjudicate.
  - **Toolchain pins** — Node 24 (matches local v24.18.0; satisfies `engines.node` `">= 26 || ^24 || ^22.12"`) and pnpm **10.33.0** exact via `pnpm/action-setup@v4` (never `latest`). No new dependency.
  - **Caches** — pnpm store via `actions/setup-node` with `cache-dependency-path: apps/web/barykadyKultury/pnpm-lock.yaml`; Playwright browsers via `actions/cache` keyed on the version resolved from the installed lockfile (`pnpm exec playwright --version` → `1.63.0`). No cache key contains an env value or secret.
  - **CI env placeholders** — `VITE_SUPABASE_URL=http://127.0.0.1:54321`, `VITE_SUPABASE_PUBLISHABLE_KEY=ci-dummy-publishable-key-not-a-real-credential`; obviously fake, loopback-only, exported identically by `ci-local.sh` (architecture §9).
  - **README badge** — the configured remote is `https://github.com/Tilitronic/barykady-kuptury.git`, used verbatim as the only factual source (no URL invented); note the remote slug reads `kuptury`, which may be a typo in the remote itself and is out of this ticket's scope.
  - **Documentation observation (not fixed here)** — the ticket cites "`docs/TESTING.md` §7"; `TESTING.md` has only six sections, and the quoted rule ("CI must not require production credentials") actually lives in `docs/architecture.md` §9, which was used. `docs/` alignment belongs to T-004.
- (author) REFACTOR — gate names are a 1:1 contract between `scripts/ci-local.sh` labels and `.github/workflows/ci.yml` step names, documented as such at the top of both files. Full single-sourcing (a shared gate manifest + generator) was rejected as needless complexity for eight git-command-shaped gates (`AGENTS.md` rule 7); the naming contract keeps a failure attributable to the same name in both places.
- (author) Verification block, all from the repository root: `bash scripts/ci-local.sh` → **0**; `actionlint .github/workflows/ci.yml` → **0**; `pnpm --dir apps/web/barykadyKultury install --frozen-lockfile` → **0**; `pnpm test` → **0** (2 files / 5 tests); `pnpm test:e2e` → **0** (4 passed). Working tree left uncommitted for @reviewer.
