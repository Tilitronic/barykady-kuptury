-- T-046 — public.has_capability(text) contract (pgTAP).
--
-- Design authority:
--   * docs/architecture.md §6.1 — app_metadata.scopes is the only scope source;
--     user_metadata is never read; malformed/missing scopes fail closed.
--   * D-17 — is_admin() remains the root claim and is unchanged; the two
--     helpers are the only authorization predicates policies may call.
--   * D-21 — deny-by-default: a zero-scope account is a non-admin.
--
-- Expected RED before 20261022130000_capability_scope_helper.sql: every
-- assertion errors with "function public.has_capability(text) does not exist".
-- This file runs in one transaction and rolls back.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(23);

-- ---------------------------------------------------------------------------
-- Fail-closed inputs
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims', '', true);
select is(public.has_capability('projects:write'), false,
  'empty claims grant no capability');

select set_config('request.jwt.claims', '{}', true);
select is(public.has_capability('projects:write'), false,
  'an empty claims object grants no capability');

select set_config('request.jwt.claims',
  $json${"sub":"b0000000-0000-4000-8000-000000000001","role":"authenticated"}$json$,
  true);
select is(public.has_capability('projects:write'), false,
  'an authenticated identity without app_metadata grants no capability');

select set_config('request.jwt.claims',
  $json${"sub":"b0000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"editor"}}$json$,
  true);
select is(public.has_capability('projects:write'), false,
  'app_metadata without scopes grants no capability');

select set_config('request.jwt.claims',
  $json${"sub":"b0000000-0000-4000-8000-000000000001","role":"authenticated","user_metadata":{"scopes":["projects:write"]}}$json$,
  true);
select is(public.has_capability('projects:write'), false,
  'user_metadata.scopes is user-editable and never grants a capability');

select set_config('request.jwt.claims',
  $json${"sub":"b0000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"scopes":"projects:write"}}$json$,
  true);
select is(public.has_capability('projects:write'), false,
  'a string scopes value (not an array) fails closed');

select set_config('request.jwt.claims',
  $json${"sub":"b0000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"scopes":[]}}$json$,
  true);
select is(public.has_capability('projects:write'), false,
  'an empty scopes array grants no capability');

select set_config('request.jwt.claims',
  $json${"sub":"b0000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"scopes":["projects:write"]}}$json$,
  true);
select is(public.has_capability(null), false,
  'null scope names are denied');
select is(public.has_capability(''), false,
  'empty scope names are denied');

-- ---------------------------------------------------------------------------
-- Exact-match vocabulary behaviour
-- ---------------------------------------------------------------------------

select is(public.has_capability('projects:write'), true,
  'the exact granted scope is true');

select is(public.has_capability('publications:write'), false,
  'a different scope is false');

select is(public.has_capability('projects'), false,
  'a scope prefix is not a match');

select is(public.has_capability('PROJECTS:WRITE'), false,
  'scope matching is case-sensitive');

select set_config('request.jwt.claims',
  $json${"sub":"b0000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"scopes":["projects:write","not-a-scope","projects:write"]}}$json$,
  true);
select is(public.has_capability('projects:write'), true,
  'duplicate and unknown scope strings do not break an exact match');
select is(public.has_capability('not-a-scope'), true,
  'has_capability is vocabulary-agnostic; inert strings are filtered by policies, not this helper');

-- ---------------------------------------------------------------------------
-- Root stays unchanged: is_admin() is the bypass, not a synthesized scope
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  $json${"sub":"b0000000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{"role":"admin"}}$json$,
  true);
select is(public.is_admin(), true,
  'is_admin() still recognizes the canonical root claim');
select is(public.has_capability('projects:write'), false,
  'root has no synthesized scope; policies use is_admin() as the bypass');

-- ---------------------------------------------------------------------------
-- Helper hardening and grants
-- ---------------------------------------------------------------------------

select is(
  (select prosecdef from pg_proc
    where oid = 'public.has_capability(text)'::regprocedure),
  false,
  'has_capability() is SECURITY INVOKER (no definer privilege escalation)'
);
select is(
  (select provolatile from pg_proc
    where oid = 'public.has_capability(text)'::regprocedure),
  's',
  'has_capability() is STABLE (same claims, same answer within a statement)'
);
select ok(
  (select proconfig from pg_proc
    where oid = 'public.has_capability(text)'::regprocedure)
  @> array['search_path=""'],
  'has_capability() pins search_path to the empty path'
);

select ok(has_function_privilege('anon', 'public.has_capability(text)', 'execute'),
  'anon may execute has_capability() (needed by shared policy expressions)');
select ok(has_function_privilege('authenticated', 'public.has_capability(text)', 'execute'),
  'authenticated may execute has_capability()');
select ok(has_function_privilege('service_role', 'public.has_capability(text)', 'execute'),
  'service_role may execute has_capability()');

select * from finish();
rollback;
