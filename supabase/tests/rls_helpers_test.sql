-- T-013 — admin claim and published-predicate helpers (pgTAP).
--
-- Design authority:
--   * docs/tickets/DECISIONS.md D-17 — the canonical admin claim is
--     app_metadata.role = 'admin', evaluated only by public.is_admin().
--     app_metadata is server-controlled; user_metadata is user-editable and
--     must never grant admin.
--   * docs/architecture.md §6 — authorization is enforced in PostgreSQL.
--   * docs/tickets/T-013-rls-policies.md — helper functions pin search_path;
--     no SECURITY DEFINER without a documented reason.
--
-- Expected RED before the T-013 migration exists: every assertion errors with
-- "function public.is_admin() does not exist" (or is_published). The matrix
-- file carries the positive-policy RED evidence.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(16);

-- ---------------------------------------------------------------------------
-- is_admin(): only app_metadata.role = 'admin' grants admin
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims', '', true);
select is(public.is_admin(), false, 'is_admin() is false when the claims setting is empty');

select set_config('request.jwt.claims', '{}', true);
select is(public.is_admin(), false, 'is_admin() is false when the claims object is empty');

select set_config('request.jwt.claims',
  $json${"sub":"b0000000-0000-4000-8000-000000000001","role":"authenticated"}$json$, true);
select is(public.is_admin(), false, 'is_admin() is false for an authenticated identity without app_metadata');

select set_config('request.jwt.claims',
  $json${"sub":"b0000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"editor"}}$json$, true);
select is(public.is_admin(), false, 'is_admin() requires app_metadata.role to be exactly "admin"');

select set_config('request.jwt.claims',
  $json${"sub":"b0000000-0000-4000-8000-000000000001","role":"authenticated","user_metadata":{"role":"admin"}}$json$, true);
select is(public.is_admin(), false, 'is_admin() ignores user_metadata.role (user-editable)');

select set_config('request.jwt.claims',
  $json${"sub":"b0000000-0000-4000-8000-000000000001","role":"authenticated","user_metadata":{"role":"admin"},"app_metadata":{}}$json$, true);
select is(public.is_admin(), false, 'is_admin() ignores user_metadata even when app_metadata exists without a role');

select set_config('request.jwt.claims',
  $json${"sub":"b0000000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{"role":"admin"}}$json$, true);
select is(public.is_admin(), true, 'is_admin() is true when app_metadata.role is "admin"');

-- ---------------------------------------------------------------------------
-- is_published(): the single shared published-visibility predicate
-- ---------------------------------------------------------------------------

select is(public.is_published('published'::public.content_status), true,
  'is_published() is true only for status "published"');
select is(public.is_published('draft'::public.content_status), false,
  'is_published() is false for status "draft"');
select is(public.is_published('archived'::public.content_status), false,
  'is_published() is false for status "archived"');

-- ---------------------------------------------------------------------------
-- Helper hardening: invoker rights + a pinned search_path
-- ---------------------------------------------------------------------------

select is((select prosecdef from pg_proc where oid = 'public.is_admin()'::regprocedure), false,
  'is_admin() is SECURITY INVOKER (no definer privilege escalation)');
select ok((select proconfig from pg_proc where oid = 'public.is_admin()'::regprocedure)
  @> array['search_path=""'],
  'is_admin() pins search_path to the empty path');

select is((select prosecdef from pg_proc
             where oid = 'public.is_published(public.content_status)'::regprocedure), false,
  'is_published() is SECURITY INVOKER');
select ok((select proconfig from pg_proc
             where oid = 'public.is_published(public.content_status)'::regprocedure)
  @> array['search_path=""'],
  'is_published() pins search_path to the empty path');

select ok(has_function_privilege('anon', 'public.is_admin()', 'execute'),
  'anon may execute is_admin() (needed by every select policy)');
select ok(has_function_privilege('authenticated', 'public.is_admin()', 'execute'),
  'authenticated may execute is_admin()');

select * from finish();
rollback;
