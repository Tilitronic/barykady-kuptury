#!/usr/bin/env bash
#
# ci-local.sh — run the CI quality gates locally (T-005).
#
# Why this exists: GitHub Actions cannot be executed from this environment, but
# docs/TESTING.md §5 requires that "for checks not available in a developer
# environment, state the blocker and ensure CI is configured to run them". This
# script is the executable equivalent of .github/workflows/ci.yml so a developer
# (or an agent) can prove the same gates before pushing.
#
# CONTRACT: the gate labels below are a 1:1 mirror of the step names in
# .github/workflows/ci.yml. Keep the two lists identical, in the same order, so
# a failing gate is attributable to the same name in both places.
#
# Design rules honoured here:
# - Frozen-lockfile install (TESTING §5.1). The lockfile lives in the app
#   workspace (apps/web/barykadyKultury/pnpm-lock.yaml), NOT at the repository
#   root, so the install must be scoped with `pnpm --dir`; a root-level frozen
#   install cannot work (README "Commands", architecture.md §2).
# - No secret is required for a green run (architecture.md §9 "CI must not
#   require production credentials"): the same obviously fake, loopback-pointing
#   Supabase placeholders as the workflow are exported below.
# - Gate 6 (DB/RLS) skips cleanly when Supabase is not configured. A skip is
#   reported as SKIP and is never counted as a pass.
# - No `|| true`, `|| :` or `set +e` around a required gate: the first failure
#   aborts with a non-zero exit code.
#
# Usage: bash scripts/ci-local.sh

set -uo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="apps/web/barykadyKultury"

GATES_RUN=0
GATE_STATUS="passed"

# Mirror the workflow environment so local runs exercise the same code paths.
# playwright.config.ts keys `retries` and `forbidOnly` off CI, so an accidental
# `.only` in a spec must fail the local gates exactly as it fails in CI.
export CI="${CI:-true}"

# Browser-safe, obviously fake placeholders — identical to the workflow `env`
# block. They point at the loopback address a local Supabase would use and are
# not credentials. Never replace these with a real project URL or key.
export VITE_SUPABASE_URL="${VITE_SUPABASE_URL:-http://127.0.0.1:54321}"
export VITE_SUPABASE_PUBLISHABLE_KEY="${VITE_SUPABASE_PUBLISHABLE_KEY:-ci-dummy-publishable-key-not-a-real-credential}"

cd "$REPO_ROOT" || exit 1

banner() {
  printf '\n──────── %s ────────\n' "$1"
}

# Marks the gate currently executing as skipped (it must still exit 0).
skip_gate() {
  GATE_STATUS="skipped"
}

# run_gate <name> <command...>
# Runs one gate, prints an attributable PASS/SKIP/FAIL line, and aborts the
# whole script with a non-zero exit code on the first failure.
run_gate() {
  local name="$1"
  shift
  GATES_RUN=$((GATES_RUN + 1))
  local label="Gate $GATES_RUN — $name"
  local started=$SECONDS
  GATE_STATUS="passed"

  banner "$label"
  if "$@"; then
    local elapsed=$((SECONDS - started))
    if [ "$GATE_STATUS" = "skipped" ]; then
      printf 'SKIP %s (%ss)\n' "$label" "$elapsed"
    else
      printf 'PASS %s (%ss)\n' "$label" "$elapsed"
    fi
  else
    local code=$?
    # Normalise signal/odd statuses so an aborted gate can never look like 0.
    if [ "$code" -eq 0 ]; then
      code=1
    fi
    printf 'FAIL %s (exit %s, %ss)\n' "$label" "$code" "$((SECONDS - started))" >&2
    printf '\nci-local: STOPPED at "%s". Fix it and re-run: bash scripts/ci-local.sh\n' "$label" >&2
    exit "$code"
  fi
}

# ── Gate 1 ────────────────────────────────────────────────────────────────────
gate_install() {
  pnpm --dir "$APP_DIR" install --frozen-lockfile
}

# ── Gate 2 ────────────────────────────────────────────────────────────────────
gate_format() {
  pnpm format:check
}

# ── Gate 3 ────────────────────────────────────────────────────────────────────
gate_lint() {
  pnpm lint:check
}

# ── Gate 4 ────────────────────────────────────────────────────────────────────
gate_typecheck() {
  pnpm typecheck
}

# ── Gate 5 ────────────────────────────────────────────────────────────────────
gate_unit() {
  pnpm test
}

# ── Gate 6 (optional) ─────────────────────────────────────────────────────────
# TESTING §5.6: "Local database migration/RLS tests, where configured."
# Configured means both a local Supabase project config and the CLI are present;
# neither exists yet (their wiring lands with T-012/T-013), so this skips today.
supabase_configured() {
  [ -f "supabase/config.toml" ] && command -v supabase >/dev/null 2>&1
}

gate_db_rls() {
  if ! supabase_configured; then
    printf 'SKIP: DB/RLS tests are not configured in this repository.\n'
    printf '      Required: supabase/config.toml and the supabase CLI on PATH.\n'
    printf '      The CI skeleton for this gate is .github/workflows/ci.yml (Gate 6).\n'
    skip_gate
    return 0
  fi
  # Supabase CLI convention: RLS/pgTAP assertions live in supabase/tests.
  supabase test db
}

# ── Gate 7 ────────────────────────────────────────────────────────────────────
# Browser download is part of this gate because the suite cannot run without it;
# in CI the browser cache step makes it a no-op. `test:e2e` starts and stops its
# own production server (playwright.config.ts webServer, 127.0.0.1:4173).
gate_e2e() {
  pnpm test:e2e:install &&
    pnpm test:e2e
}

# ── Gate 8 ────────────────────────────────────────────────────────────────────
gate_build() {
  pnpm build
}

printf 'ci-local: repo %s\n' "$REPO_ROOT"
printf 'ci-local: node %s | pnpm %s\n' "$(node -v)" "$(pnpm -v)"

run_gate "Install dependencies (frozen lockfile)" gate_install
run_gate "Formatting check (oxfmt)" gate_format
run_gate "Lint (oxlint + oxfmt)" gate_lint
run_gate "Type check (vue-tsc)" gate_typecheck
run_gate "Unit/component tests (vitest)" gate_unit
run_gate "DB/RLS tests (optional; skipped unless Supabase is configured)" gate_db_rls
run_gate "Playwright E2E tests (install browsers + run suite)" gate_e2e
run_gate "Production build (quasar build)" gate_build

banner "ci-local: all $GATES_RUN gates passed"
printf 'Gate order and names mirror .github/workflows/ci.yml (docs/TESTING.md §5).\n'
