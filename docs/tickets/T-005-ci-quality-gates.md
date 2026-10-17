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
- [ ] Workflow YAML validates (`actionlint` or `yamllint` if available; otherwise documented manual schema check).
- [ ] Every gate is a separate step with a clear name; a failure is attributable.
- [ ] No secret is required for a green run; placeholder values are obviously fake.
- [ ] Playwright report uploads even on failure.
- [ ] `scripts/ci-local.sh` reproduces the whole gate sequence and exits non-zero on any failure.

## Verification
```
bash scripts/ci-local.sh
```

## Review gate
- @reviewer: no secrets, no `|| true` masking a required gate, correct working directory for the app, cache keys do not leak env, failure artifacts present.

## Log
- (author) start:
