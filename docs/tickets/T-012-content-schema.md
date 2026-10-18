# T-012 — Content schema migrations

**Session:** 3 · **Lane:** data/architecture · **Owner:** @coder · **Status:** done
**Reviewers:** @architector (arc-1: PASS-WITH-FINDINGS r1 → PASS r2) + @reviewer (rev-1: 2S+2Sp r1 → close verdict r3)
**Depends on:** T-001, D-08 · **Blocks:** T-013…T-031

## Outcome
Versioned Supabase migrations define the whole V1 content model with constraints, lifecycle fields, and translation tables — committed as the single source of schema truth.

## Scope
In:
- `supabase/config.toml`, `supabase/migrations/<timestamp>_content_model.sql`, `supabase/seed.sql`.
- Tables (with translation siblings): `site_pages`, `site_page_translations`, `projects`, `project_translations`, `team_members`, `team_member_translations`, `publications`, `publication_translations`, `publication_files`, `organization_documents`, `organization_document_translations`, `calendar_event_links`.
- Lifecycle enum `content_status ('draft','published','archived')`, `created_at/updated_at` + trigger, `published_at`, ordering columns (`sort_order`), slug uniqueness **per locale**, locale enum `('en','pl','uk')`.
- **Reviewed scope amendment (review round 1):** every translation table carries a `needs_review` flag as a D-16 (admin locale workflow) pre-load. Endorsed by @architector; the @reviewer scope-creep dissent is recorded in the Log.
- `projects.featured_rank` (nullable, ordered), `projects.cover_path` (Storage path, not URL).
- `calendar_event_links`: `calendar_id`, `google_event_id`, nullable `project_id` FK `ON DELETE SET NULL`, unique `(calendar_id, google_event_id)`, timestamps.
- Indexes for published listing, featured ordering, event lookup.
- Seed data: clearly fictional fixtures per `docs/TESTING.md` §6 (published + draft project, complete + incomplete translation, publication with/without file, team member, event link rows).

Out: RLS policies (T-013), Storage buckets (T-014), app queries (T-015).

## Design constraints
- `docs/architecture.md` §4 (entities, event-project relation, stable Google event ID identity, no title/date identity).
- `AGENTS.md` rule 5 (migrations, generated types).
- `docs/TESTING.md` §6 (fixture set).

## TDD plan
1. RED: `supabase/tests/schema_test.sql` assertions (tables exist, unique per-locale slug rejects duplicates, `ON DELETE SET NULL` unlinks an event) fail before migrations run.
2. GREEN: write migrations + seed until `supabase db reset` and the schema test pass.
3. REFACTOR: split migrations by concern only if a single file becomes unreadable; keep one migration per logical change after V1.

## Acceptance criteria
- [x] `supabase db reset` succeeds from scratch and applies seed idempotently. *(proven by `scripts/verify-seed-idempotency.mjs` — full-row digests identical after a second application)*
- [x] Duplicate `(project_id, locale)` slug insert is rejected. *(pgTAP `schema_test.sql`)*
- [x] Deleting a project sets `calendar_event_links.project_id` to NULL and keeps the row. *(pgTAP `schema_test.sql`)*
- [x] Cannot associate one Google event twice (unique constraint proven). *(pgTAP `schema_test.sql`)*
- [x] All translation tables cascade on parent delete; no orphan rows possible. *(pgTAP `schema_test.sql`)*
- [x] `updated_at` advances on update (trigger proven by test). *(pgTAP `schema_test.sql`)*
- [x] Fixtures contain only fictional content and no personal data. *(@reviewer verified)*
- [x] No RLS is disabled anywhere (policies land in T-013, tables start closed). *(RLS enabled on all 12 tables with zero policies; D-21)*

## Verification
```
supabase db reset
supabase test db   # schema assertions
pnpm typecheck
```

## Review gate
- @architector: model matches §4, event identity rules respected, no premature generalisation.
- @reviewer: constraints are declarative (not app-enforced), naming consistent, seed data obviously fake.

## Log
- (author) start: 2026-10-18 — implemented by @coder.

### RED (final `schema_test.sql` before the migration existed)
`pnpm dlx supabase@2.121.0 test db` → exit 1:
```
psql:.../schema_test.sql:29: ERROR:  type "public.content_status" does not exist
Dubious, test returned 3
Failed 41/41 subtests
Test Summary Report
  Parse errors: Bad plan.  You planned 41 tests but ran 0.
Result: FAIL
```

### GREEN
- `pnpm dlx supabase@2.121.0 db reset` → exit 0:
```
Applying migration 20261018091038_content_model.sql...
Seeding data from supabase/seed.sql...
Finished supabase db reset on branch main.
```
- `pnpm dlx supabase@2.121.0 test db` → exit 0:
```
schema_test.sql .. ok
All tests successful.
Files=1, Tests=41, ... Result: PASS
```
- `pnpm typecheck` → exit 0.
- Seed idempotency: re-ran `supabase/seed.sql` twice through `psql`; counts unchanged
  (2 projects, 4 project_translations, 2 publications, 2 publication_files, 3 calendar_event_links, 1 site_page).

### Security posture applied
RLS `enable` on all 12 content tables with **zero policies** (deny-by-default); no RLS
disabled anywhere. Policies land in T-013; seed runs as the migration superuser and bypasses RLS.

### Notes / uncertainty for @architector
- `projects` intentionally has no `sort_order`: featured order uses `featured_rank` (unique
  partial index, T-030) and the public listing uses `published_at`/`updated_at`. Flag if a
  manual editorial project order is expected and should be added before T-019/T-030.
- "RLS enabled with zero policies" in T-012 vs deferring enablement to T-013 — see handoff note.
- CLI provisioning (`pnpm dlx supabase@2.121.0` vs a committed dependency) for the future
  `pnpm types:db` script (T-015) — see handoff note.

### Review round 1 (2026-10-18) — @architector + @reviewer

Verdicts: **@architector PASS-WITH-FINDINGS** (0 blockers, 0 majors, 2 observations + 1 nit + 2 decision-record gaps); **@reviewer** 2 Standards + 2 Spec findings. Fixed point `9940c90`; implementation under review `a2218e6`.

| Finding | Axis | Disposition |
|---|---|---|
| `auth.enable_signup = true` contradicts architecture §6 / D-08 "no public registration" | Standards (Major) | **Fixed** — `[auth].enable_signup=false`, `[auth.email].enable_signup=false` |
| `storage.s3_protocol` + `storage.vector` enabled with no requirement | Standards (Suggestion) | **Fixed** — both `enabled=false` (AGENTS.md rule 7) |
| Seed-idempotency AC had no automated gate | Spec (Major) | **Fixed** — see "Idempotency gate" below |
| `needs_review` columns are scope creep | Spec (Minor) | **Documented amendment** — kept (see below) |
| F-01 `publication_files` unique key `(publication_id, locale)` possibly too restrictive | Arch observation | **Forward flag for T-029** |
| F-03 `projects` has no `sort_order` | Arch observation | **Confirmed correct** for now; forward flag for T-030 |
| F-02 `set_updated_at()` comment omits precondition | Arch nit | **Fixed** — comment now states the non-null `updated_at` precondition |

Decision records added: **D-21** (RLS enablement point — tables closed at creation in T-012, policies authored in T-013; @architector verdict: correct posture) and **D-22** (Supabase CLI provisioning for the local stack + `pnpm types:db`; provisional, finalised in T-015).

#### `needs_review` — reviewed scope amendment
The migration adds `needs_review` to every translation table, which the ticket's in-scope list did not name. @reviewer flagged it as scope creep; @architector explicitly endorsed it as a reasonable pre-load for D-16 (admin locale workflow). Reconciliation: **kept and recorded here as a reviewed T-012 scope amendment** so it is not a silent expansion. The @reviewer dissent stands on record.

#### Idempotency gate — why it is a host script, not a pgTAP test
The first attempt added `supabase/tests/seed_idempotency_test.sql` re-applying the seed via `\ir ../seed.sql`. That cannot work: `supabase test db` runs psql inside the `pg_prove` container, which mounts **only** `supabase/tests` — probing the container shows `ls supabase` ⇒ `tests` alone, and the include fails with
`error: /…/supabase/seed.sql: No such file or directory`. `docs/architecture.md` §2 fixes the seed at `supabase/seed.sql`, so the file is unreachable from pgTAP; relocating or duplicating it was rejected (drift / contradiction of the documented layout).
The gate therefore runs on the host and drives psql inside the database container:
```
pnpm dlx supabase@2.121.0 db reset        # application #1 (migration + seed)
pnpm test:db:idempotency                  # applies supabase/seed.sql again; asserts no change
```
`scripts/verify-seed-idempotency.mjs` digests every content table (row count + md5 over ordered primary keys) before and after the second application and fails on any difference; it refuses to pass on an empty database (vacuous-pass guard).

#### Review-round verification (re-run by the orchestrator on the reworked tree)
- `pnpm dlx supabase@2.121.0 db reset` → exit 0.
- `pnpm test:db:idempotency` → exit 0: `PASS — re-applying supabase/seed.sql changed nothing (12 tables, 24 rows verified)`.
- `pnpm dlx supabase@2.121.0 test db` → exit 0: `schema_test.sql .. ok / Files=1, Tests=41 / Result: PASS`.
- `pnpm typecheck` → exit 0.

#### Follow-ups for later tickets
- **T-029**: revisit the `publication_files` unique key if a real "two files per locale" need appears (architector F-01).
- **T-030**: add `projects.sort_order` only if a manual editorial order is actually required (architector F-03).
- **D-22**: finalise CLI provisioning; once the CLI is on `PATH`, wire `pnpm test:db:idempotency` into `scripts/ci-local.sh` Gate 6 (T-005's DB gate currently SKIPs without a CLI on PATH).

### Review round 2 (2026-10-18) — re-check of the rework

Verdicts: **@architector PASS** — all round-1 items resolved, model unchanged, no new decision record required. **@reviewer** — prior Standards findings **RESOLVED**; two items **PARTIALLY RESOLVED** (fixes below); one new Suggestion.

| Round-1 item | Re-check result | Fix applied in round 2 |
|---|---|---|
| Standards Major — open signup | RESOLVED | — |
| Standards Suggestion — `storage.s3_protocol` / `storage.vector` | RESOLVED | — |
| Spec Major — seed-idempotency gate | PARTIALLY RESOLVED: proved only PK/row-count identity, so a non-key column change could still pass | **Digest upgraded to full row state** — md5 over `row_to_json` ordered by primary key, covering every column |
| Spec Minor — `needs_review` scope creep | PARTIALLY RESOLVED: amendment lived only in the Log | **Added to the canonical `## Scope` section** (above) |
| New Suggestion — container target ambiguous with multiple local stacks | — | **Container resolved by exact name `supabase_db_<project_id>`** read from `supabase/config.toml`; the gate now refuses to run rather than guess another stack |

Also applied: `--reset` makes the gate one deterministic command, addressing the reviewer's "single gate command" preference.

#### Review round 2 verification (orchestrator, on the final tree)
- `node scripts/verify-seed-idempotency.mjs --reset` → exit 0: `PASS — re-applying supabase/seed.sql changed nothing (12 tables, 24 rows, full-row digests identical)`.
- `pnpm dlx supabase@2.121.0 test db` → exit 0: `Files=1, Tests=41 / Result: PASS`.
- `pnpm typecheck` → exit 0.
