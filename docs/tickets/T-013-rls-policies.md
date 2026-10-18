# T-013 — RLS policies & admin claim

**Session:** 3 · **Lane:** data/security · **Owner:** @coder · **Status:** done
**Reviewers:** @architector (arc-1: PASS) + @reviewer (rev-1: 0 findings, close verdict YES)
**Depends on:** T-012 · **Blocks:** T-015, T-019, T-020, T-026…T-031, T-035

## Outcome
Deny-by-default authorization enforced in PostgreSQL: anonymous visitors read published public content only, administrators mutate content through a trusted claim, and every rule is proven by tests.

## Scope
In:
- `is_admin()` SQL function reading the canonical trusted claim: **`app_metadata.role = 'admin'`** (decision D-17). `app_metadata` is server-controlled; do not read a user-editable profile field. This function is the single enforcement point for admin authorization — policies call it rather than repeating the claim expression.
- Policies per table: anonymous `select` only when `status = 'published'` (or `is_published`), joined translations only for published rows; insert/update/delete admin-only; `publication_files` and `organization_documents` metadata follow their parent's publish state.
- `calendar_event_links`: public read allowed (it contains only IDs and a nullable project reference), admin write.
- Explicit `revoke`/`grant` where defaults are too broad; no `security definer` without a documented reason and a pinned `search_path`.
- Tests in `supabase/tests/rls_*.sql` covering the matrix from `docs/TESTING.md` §3 for each protected table: anon published read allowed, anon draft read denied, anon write denied, authenticated non-admin write denied, admin CRUD allowed.
- Test harness uses JWT claims via `request.jwt.claims` — never the service-role key to simulate an ordinary user.

Out: Storage policies (T-014), app-side guards (T-026).

## Design constraints
- `AGENTS.md` rule 4 (security at the data boundary; UI guards are not authorization).
- `docs/architecture.md` §6 (deny-by-default, admin via `app_metadata`, no service-role in client).
- `docs/TESTING.md` §3 (per-table proof matrix).
- `docs/PRODUCT_REQUIREMENTS.md` §8 (anonymous cannot read drafts or write).

## TDD plan
1. RED: write `rls_projects.sql` first — `anon cannot select a draft` and `anon cannot insert` fail because tables are closed/no policies.
2. GREEN: add policies until the matrix passes.
3. RED: `non-admin authenticated cannot update` — fails if `is_admin()` is too permissive; fix the claim check.
4. REFACTOR: shared SQL helper for the "published visible" predicate to avoid drift between tables.

## Acceptance criteria
- [x] Every content table has explicit policies for select/insert/update/delete (no implicit allow).
- [x] Anonymous draft access returns zero rows for every translation and file table.
- [x] Anonymous insert/update/delete rejected on every table.
- [x] Authenticated non-admin rejected on every mutation.
- [x] Admin CRUD succeeds for each entity.
- [x] `is_admin()` cannot be influenced by user-editable metadata.
- [x] Tests prove denial by result and by error, not by route/UI behaviour.

## Verification
```
supabase db reset
supabase test db    # all rls_*.sql
```

## Review gate
- @architector: claim source is server-controlled; helper functions are safe (`search_path`, no definer abuse).
- @reviewer: matrix completeness, no policy that accidentally widens access through a join, tests can fail.

## Log
- (author) start: 2026-10-18 — implemented by @coder.

### RED (new tests, before the policies migration existed)
`pnpm dlx supabase@2.121.0 test db` → exit 1:
```
rls_content_matrix_test.sql:141: ERROR:  new row violates row-level security policy for table "site_pages"
# Failed test 1: "anon reads a published site_page"        have: 0  want: 1
# Failed test 4: "anon update denied on site_pages"     caught: no exception  wanted: 42501
# Failed test 5: "anon delete denied on site_pages"     caught: no exception  wanted: 42501
# Failed test 9: "admin reads a draft site_page"           have: 0  want: 1
rls_helpers_test.sql:28: ERROR:  function public.is_admin() does not exist
Failed 16/16 subtests
schema_test.sql .............. ok
Result: FAIL
```
The negative assertions (anon cannot read a draft / anon cannot insert) already passed because
T-012 left RLS enabled with zero policies (D-21), so the honest RED is the **positive** path:
anonymous published reads returned 0 rows, admin draft reads returned 0 rows, and the admin insert
raised `42501`. `is_admin()` / `is_published()` did not exist yet, so the helper file failed 16/16.
(Anon UPDATE/DELETE were silently filtered to 0 rows before the explicit privilege revoke; after the
revoke they are rejected with `42501`.)

### GREEN
- `pnpm dlx supabase@2.121.0 db reset` → exit 0:
```
Applying migration 20261018091038_content_model.sql...
Applying migration 20261018120000_rls_policies.sql...
Seeding data from supabase/seed.sql...
Finished supabase db reset on branch main.
```
- `pnpm dlx supabase@2.121.0 test db` → exit 0:
```
rls_content_matrix_test.sql .. ok
rls_helpers_test.sql ......... ok
schema_test.sql .............. ok
All tests successful.
Files=3, Tests=202, ... Result: PASS
```
- `pnpm typecheck` → exit 0 (`vue-tsc --noEmit`).
- `pnpm lint:check` → exit 0; `pnpm format:check` → exit 0.

### Policy matrix implemented
Five explicit policies per content table (12 tables → 60 policies; verified in `pg_policies`):

| Table group | SELECT | INSERT / UPDATE / DELETE |
|---|---|---|
| `site_pages`, `projects`, `team_members`, `publications`, `organization_documents` | `anon, authenticated`: `is_published(status)`; `authenticated`: `is_admin()` (admin sees drafts) | `authenticated`: `is_admin()` (`UPDATE` has `USING` + `WITH CHECK`) |
| `site_page_translations`, `project_translations`, `team_member_translations`, `publication_translations`, `publication_files`, `organization_document_translations` | `anon, authenticated`: parent row exists and `is_published(parent.status)`; `authenticated`: `is_admin()` | `authenticated`: `is_admin()` |
| `calendar_event_links` | `anon, authenticated`: `project_id is null or linked project is_published`; `authenticated`: `is_admin()` | `authenticated`: `is_admin()` |

Security posture after reset: RLS enabled on all 12 tables (0 disabled); `anon` retains `SELECT`
but **no** INSERT/UPDATE/DELETE (explicit revoke, defence in depth); `authenticated` keeps its grants
because admin writes are expressed by `is_admin()` policies; `service_role` unchanged (bypasses RLS,
server-side only).

End-to-end seed probe (anon, seeded data): 1 published project visible (draft hidden), 3 published
project translations, 2 published publication files, 2 event mappings (unlinked + published link;
the draft-linked mapping is hidden). An `authenticated` identity carrying
`user_metadata.role = "admin"` but no `app_metadata.role` still reads 0 draft rows.

### Notes / uncertainty for @architector
- **(a) Default grants.** Supabase's `pg_default_acl` grants `anon`/`authenticated` the full
  INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER set on new public tables. RLS already denies anon
  writes (no write policy is granted to `anon`), but the migration also revokes those table
  privileges from `anon` as defence in depth. `authenticated` was deliberately not narrowed because
  the admin path needs the privileges and RLS is the authorization boundary. Flag if you prefer to
  keep privileges exactly at Supabase defaults and rely on RLS alone.
- **(b) `calendar_event_links` public read.** The ticket says "public read allowed", but architecture
  §4 and TESTING §3 forbid revealing an unpublished project through a mapping. The public policy
  therefore exposes only unlinked rows and rows linked to a **published** project. A mapping to a
  draft project stays admin/service-role-only and the public event still renders without a project
  link. This is stricter than "read every mapping row"; confirm this is the intended reading.
- **(c) `is_admin()` definer rights.** Not used. The helper only reads `request.jwt.claims` (a GUC)
  and `is_published()` only compares an enum value; neither touches a table, so invoker rights are
  sufficient and avoid privilege-escalation surface. Both pin `search_path = ''` and schema-qualify
  what they call. Confirm no Auth-hook / PostgREST deployment detail requires a definer wrapper.
- The actual admin *provisioning* (setting `app_metadata.role` for a real account) remains out of
  scope (D-08); this ticket only defines the enforcement contract and proves it with simulated
  claims.

### Review verdicts (2026-10-18) — @architector (arc-1) + @reviewer (rev-1)

Implementation `ac64b04`; hardening `85c4d8e`. Fixed point for review: `8d4c81d`.

- **@reviewer (two-axis): 0 findings on both axes.** All seven acceptance criteria verified individually — explicit policies per table × operation; anon draft reads = 0 across every translation/file table; anon writes rejected with `42501`; non-admin mutations denied by result **and** error; admin CRUD per entity; `user_metadata.role='admin'` does not grant admin; tests are SQL, not route/UI. Explicit checks passed: no join-widening, no anon write access (policies **and** grants), shared `is_published()` predicate (no drift), tests use `set local role` + `request.jwt.claims` and never the service-role key, tests are fail-able. **Close verdict: YES.**
- **@architector: PASS.** `is_admin()` is the single D-17 enforcement point (invoker rights, pinned `search_path`); `is_published()` sound and drift-free; the stricter `calendar_event_links` public read is **required** by architecture §4 (the ticket wording was imprecise) and a public event still renders when its link is hidden; the grants posture (revoke writes from `anon`, leave `authenticated` at defaults because admin writes need the privileges and RLS is the authorization boundary) is correct. **No new decision records needed.**

#### Applied hardening (reviewer's non-blocking suggestion)
Added five "authenticated non-admin reads a published row" assertions (`rls_content_matrix_test.sql`, one per table family) so a future narrowing of a public `SELECT` policy to `to anon` only cannot regress silently.

#### Final verification (orchestrator, on the closed tree)
- `pnpm dlx supabase@2.121.0 db reset` → exit 0.
- `pnpm dlx supabase@2.121.0 test db` → exit 0: `Files=3, Tests=207 / Result: PASS` (schema 41 + helpers 16 + matrix 150).
- `pnpm typecheck` → exit 0.
- `git diff ac64b04..85c4d8e` touches only the matrix test file — no policy/migration drift.
