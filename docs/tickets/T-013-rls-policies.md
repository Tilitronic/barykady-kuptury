# T-013 — RLS policies & admin claim

**Session:** 3 · **Lane:** data/security · **Owner:** @coder · **Status:** todo
**Reviewers:** @architector + @reviewer
**Depends on:** T-012 · **Blocks:** T-015, T-019, T-020, T-026…T-031, T-035

## Outcome
Deny-by-default authorization enforced in PostgreSQL: anonymous visitors read published public content only, administrators mutate content through a trusted claim, and every rule is proven by tests.

## Scope
In:
- `is_admin()` SQL function reading the trusted claim (`app_metadata.role = 'admin'` or `app_metadata.is_admin = true` — pick one and document it).
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
- [ ] Every content table has explicit policies for select/insert/update/delete (no implicit allow).
- [ ] Anonymous draft access returns zero rows for every translation and file table.
- [ ] Anonymous insert/update/delete rejected on every table.
- [ ] Authenticated non-admin rejected on every mutation.
- [ ] Admin CRUD succeeds for each entity.
- [ ] `is_admin()` cannot be influenced by user-editable metadata.
- [ ] Tests prove denial by result and by error, not by route/UI behaviour.

## Verification
```
supabase db reset
supabase test db    # all rls_*.sql
```

## Review gate
- @architector: claim source is server-controlled; helper functions are safe (`search_path`, no definer abuse).
- @reviewer: matrix completeness, no policy that accidentally widens access through a join, tests can fail.

## Log
- (author) start:
