-- T-030 — featured ordering invariants (pgTAP).
--
-- Design authority:
--   * docs/tickets/T-030-admin-featured-ordering.md — ranks are dense, unique
--     and deterministic; only published projects may be featured; unpublishing
--     or deleting a featured project removes it without leaving a hole; the
--     homepage fallback therefore only has to handle an empty featured set.
--   * docs/PRODUCT_REQUIREMENTS.md §5/§6 — an administrator chooses the
--     featured set AND its order.
--   * docs/architecture.md §4 — `projects.featured_rank` is the single
--     locale-independent order on the root row.
--   * docs/architecture.md §6.1 / T-046 — the RPCs re-check
--     `is_admin() OR has_capability('projects:write')`; RLS stays the second
--     boundary because they are SECURITY INVOKER.
--
-- Expected RED before the T-030 migration exists: the two new functions are
-- missing (to_regprocedure is null), the rank constraint is not deferrable,
-- and unpublishing/deleting a featured row leaves its rank behind.
--
-- Identity simulation follows TESTING §3 (SET LOCAL ROLE + request.jwt.claims).
-- The whole file runs in one transaction and rolls back, so fixtures never leak.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(46);

-- ---------------------------------------------------------------------------
-- Signatures, security and privileges
-- ---------------------------------------------------------------------------

select ok(
  to_regprocedure('public.set_project_featured_v1(uuid,boolean)') is not null,
  'set_project_featured_v1 exists with the add/remove signature'
);

select is(
  (
    select prosecdef
      from pg_proc
     where oid = to_regprocedure('public.set_project_featured_v1(uuid,boolean)')
  ),
  false,
  'set_project_featured_v1 is SECURITY INVOKER (RLS still applies)'
);

select ok(
  (
    select proconfig
      from pg_proc
     where oid = to_regprocedure('public.set_project_featured_v1(uuid,boolean)')
  ) @> array['search_path=""'],
  'set_project_featured_v1 pins search_path'
);

select ok(
  exists (
    select 1
      from pg_proc
     where oid = to_regprocedure('public.set_project_featured_v1(uuid,boolean)')
       and has_function_privilege('authenticated', oid, 'EXECUTE')
  ),
  'authenticated may execute set_project_featured_v1'
);

select ok(
  not exists (
    select 1
      from pg_proc
     where oid = to_regprocedure('public.set_project_featured_v1(uuid,boolean)')
       and has_function_privilege('anon', oid, 'EXECUTE')
  ),
  'anon may not execute set_project_featured_v1'
);

select ok(
  not exists (
    select 1
      from pg_proc
     where oid = to_regprocedure('public.set_project_featured_v1(uuid,boolean)')
       and has_function_privilege('service_role', oid, 'EXECUTE')
  ),
  'service_role may not execute set_project_featured_v1'
);

select ok(
  to_regprocedure('public.reorder_featured_projects_v1(uuid[])') is not null,
  'reorder_featured_projects_v1 exists'
);

select is(
  (
    select prosecdef
      from pg_proc
     where oid = to_regprocedure('public.reorder_featured_projects_v1(uuid[])')
  ),
  false,
  'reorder_featured_projects_v1 is SECURITY INVOKER'
);

select ok(
  (
    select proconfig
      from pg_proc
     where oid = to_regprocedure('public.reorder_featured_projects_v1(uuid[])')
  ) @> array['search_path=""'],
  'reorder_featured_projects_v1 pins search_path'
);

select ok(
  exists (
    select 1
      from pg_proc
     where oid = to_regprocedure('public.reorder_featured_projects_v1(uuid[])')
       and has_function_privilege('authenticated', oid, 'EXECUTE')
  ),
  'authenticated may execute reorder_featured_projects_v1'
);

select ok(
  not exists (
    select 1
      from pg_proc
     where oid = to_regprocedure('public.reorder_featured_projects_v1(uuid[])')
       and has_function_privilege('anon', oid, 'EXECUTE')
  ),
  'anon may not execute reorder_featured_projects_v1'
);

select ok(
  not exists (
    select 1
      from pg_proc
     where oid = to_regprocedure('public.reorder_featured_projects_v1(uuid[])')
       and has_function_privilege('service_role', oid, 'EXECUTE')
  ),
  'service_role may not execute reorder_featured_projects_v1'
);

-- ---------------------------------------------------------------------------
-- Deferrable uniqueness and the published-only guard
-- ---------------------------------------------------------------------------

select is(
  (
    select condeferrable
      from pg_constraint
     where conrelid = 'public.projects'::regclass
       and conname = 'projects_featured_rank_key'
  ),
  true,
  'the featured rank constraint is deferrable'
);

select is(
  (
    select condeferred
      from pg_constraint
     where conrelid = 'public.projects'::regclass
       and conname = 'projects_featured_rank_key'
  ),
  true,
  'the featured rank constraint is initially deferred'
);

select ok(
  not exists (
    select 1
      from pg_indexes
     where schemaname = 'public'
       and indexname = 'projects_featured_rank_unique_idx'
  ),
  'the old row-by-row unique index is gone (would block an atomic reorder)'
);

select ok(
  exists (
    select 1
      from pg_trigger
     where tgrelid = 'public.projects'::regclass
       and tgname = 'projects_featured_rank_published_guard'
       and not tgisinternal
  ),
  'the published-only rank guard trigger exists'
);

-- ---------------------------------------------------------------------------
-- Fixtures (inserted as superuser; RLS bypassed here)
-- ---------------------------------------------------------------------------
-- Clear every rank first: this transaction must not depend on the seed's
-- featured row. The whole file rolls back.

update public.projects set featured_rank = null;

insert into public.projects (
  id, slug, status, featured_rank, published_at
) values
  ('e3000000-0000-4000-8000-000000000001', 't030-featured-one', 'published', null,
   '2026-01-01T00:00:00Z'),
  ('e3000000-0000-4000-8000-000000000002', 't030-featured-two', 'published', null,
   '2026-01-02T00:00:00Z'),
  ('e3000000-0000-4000-8000-000000000003', 't030-featured-three', 'published', null,
   '2026-01-03T00:00:00Z'),
  ('e3000000-0000-4000-8000-000000000004', 't030-draft', 'draft', null, null),
  ('e3000000-0000-4000-8000-000000000005', 't030-featured-five', 'published', null,
   '2026-01-05T00:00:00Z');

-- A direct insert cannot smuggle a rank onto a draft.
insert into public.projects (
  id, slug, status, featured_rank, published_at
) values (
  'e3000000-0000-4000-8000-000000000006', 't030-draft-with-rank', 'draft',
  424242, null
);

select is(
  (
    select featured_rank
      from public.projects
     where id = 'e3000000-0000-4000-8000-000000000006'
  ),
  null,
  'a direct draft insert with a featured rank is cleared by the guard trigger'
);

-- ---------------------------------------------------------------------------
-- Admin add / reorder: dense, gap-free, deterministic
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  $json${"sub":"e0000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"admin"}}$json$,
  true
);
set local role authenticated;

select lives_ok(
  $sql$select public.set_project_featured_v1(
    'e3000000-0000-4000-8000-000000000001', true)$sql$,
  'an admin can feature a published project'
);

select lives_ok(
  $sql$select public.set_project_featured_v1(
    'e3000000-0000-4000-8000-000000000002', true)$sql$,
  'a second project appends to the featured set'
);

select is(
  (
    select featured_rank from public.projects
     where id = 'e3000000-0000-4000-8000-000000000001'
  ),
  1,
  'the first featured project receives rank 1'
);

select is(
  (
    select featured_rank from public.projects
     where id = 'e3000000-0000-4000-8000-000000000002'
  ),
  2,
  'the second featured project receives rank 2'
);

select lives_ok(
  $sql$select public.set_project_featured_v1(
    'e3000000-0000-4000-8000-000000000001', true)$sql$,
  'featuring an already-featured project is a no-op'
);

select is(
  (
    select featured_rank from public.projects
     where id = 'e3000000-0000-4000-8000-000000000001'
  ),
  1,
  're-adding does not duplicate or shift the first slot'
);

select lives_ok(
  $sql$select public.set_project_featured_v1(
    'e3000000-0000-4000-8000-000000000003', true)$sql$,
  'a third project appends'
);

select lives_ok(
  $sql$select public.reorder_featured_projects_v1(
    array[
      'e3000000-0000-4000-8000-000000000003',
      'e3000000-0000-4000-8000-000000000001',
      'e3000000-0000-4000-8000-000000000002'
    ]::uuid[])$sql$,
  'an admin can persist a complete featured order'
);

select is(
  (
    select featured_rank from public.projects
     where id = 'e3000000-0000-4000-8000-000000000003'
  ),
  1,
  'the reordered first id receives rank 1'
);

select is(
  (
    select featured_rank from public.projects
     where id = 'e3000000-0000-4000-8000-000000000001'
  ),
  2,
  'the reordered second id receives rank 2'
);

select is(
  (
    select featured_rank from public.projects
     where id = 'e3000000-0000-4000-8000-000000000002'
  ),
  3,
  'the reordered third id receives rank 3'
);

select is(
  (
    select count(*)
      from public.projects
     where featured_rank is not null
  ),
  3::bigint,
  'exactly the featured rows carry a rank'
);

select is(
  (
    select max(featured_rank)
      from public.projects
     where featured_rank is not null
  ),
  3,
  'the sequence is dense: max(rank) equals the featured count'
);

select throws_ok(
  $sql$select public.reorder_featured_projects_v1(
    array[
      'e3000000-0000-4000-8000-000000000001',
      'e3000000-0000-4000-8000-000000000001'
    ]::uuid[])$sql$,
  '22023',
  null,
  'duplicate ids are rejected'
);

select throws_ok(
  $sql$select public.reorder_featured_projects_v1(
    array['f0000000-0000-4000-8000-000000000000']::uuid[])$sql$,
  'P0002',
  null,
  'an unknown id is rejected as not found'
);

select throws_ok(
  $sql$select public.reorder_featured_projects_v1(
    array['e3000000-0000-4000-8000-000000000004']::uuid[])$sql$,
  '23514',
  null,
  'a draft cannot be part of the featured order'
);

select throws_ok(
  $sql$select public.set_project_featured_v1(
    'e3000000-0000-4000-8000-000000000004', true)$sql$,
  '23514',
  null,
  'featuring a draft is rejected with the published-only constraint'
);

-- ---------------------------------------------------------------------------
-- Unpublish / delete remove the row and close the gap
-- ---------------------------------------------------------------------------

select lives_ok(
  $sql$select public.transition_project_v1(
    'e3000000-0000-4000-8000-000000000001', 'draft', null)$sql$,
  'unpublishing a featured project succeeds'
);

select is(
  (
    select featured_rank from public.projects
     where id = 'e3000000-0000-4000-8000-000000000001'
  ),
  null,
  'unpublishing clears the featured rank'
);

select is(
  (
    select featured_rank from public.projects
     where id = 'e3000000-0000-4000-8000-000000000003'
  ),
  1,
  'the project before the removed slot keeps rank 1'
);

select is(
  (
    select featured_rank from public.projects
     where id = 'e3000000-0000-4000-8000-000000000002'
  ),
  2,
  'the project after the removed slot closes the gap'
);

reset role;

delete from public.projects
 where id = 'e3000000-0000-4000-8000-000000000003';

select is(
  (
    select featured_rank from public.projects
     where id = 'e3000000-0000-4000-8000-000000000002'
  ),
  1,
  'deleting a featured project renumbers the remaining row to 1'
);

-- ---------------------------------------------------------------------------
-- save_project_v1 keeps the legacy project-editor checkbox rank-safe
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  $json${"sub":"e0000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"admin"}}$json$,
  true
);
set local role authenticated;

select is(
  public.save_project_v1(
    null,
    't030-saved-featured',
    'published',
    999999,
    null,
    null,
    null,
    '2026-02-01T00:00:00Z',
    '[]'::jsonb
  ) is not null,
  true,
  'save_project_v1 can create a published project'
);

select is(
  (
    select featured_rank
      from public.projects
     where slug = 't030-saved-featured'
  ),
  2,
  'a newly featured save appends max(rank)+1 instead of inventing a colliding rank'
);

select is(
  (
    select featured_rank
      from public.projects
     where id = (
       select public.save_project_v1(
         null,
         't030-saved-draft',
         'draft',
         999999,
         null,
         null,
         null,
         null,
         '[]'::jsonb
       )
     )
  ),
  null,
  'saving a draft with the featured flag clears the rank'
);

-- ---------------------------------------------------------------------------
-- T-046 scope: projects:write succeeds, an unrelated scope fails
-- ---------------------------------------------------------------------------

reset role;
select set_config(
  'request.jwt.claims',
  $json${"sub":"e0000000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{"role":"editor","scopes":["projects:write"]}}$json$,
  true
);
set local role authenticated;

select lives_ok(
  $sql$select public.set_project_featured_v1(
    'e3000000-0000-4000-8000-000000000005', true)$sql$,
  'a projects:write editor may feature a project'
);

select is(
  (
    select featured_rank from public.projects
     where id = 'e3000000-0000-4000-8000-000000000005'
  ),
  3,
  'the scoped add appends rank 3 after the two remaining rows'
);

reset role;
select set_config(
  'request.jwt.claims',
  $json${"sub":"e0000000-0000-4000-8000-000000000003","role":"authenticated","app_metadata":{"role":"editor","scopes":["publications:write"]}}$json$,
  true
);
set local role authenticated;

select throws_ok(
  $sql$select public.set_project_featured_v1(
    'e3000000-0000-4000-8000-000000000005', false)$sql$,
  '42501',
  null,
  'an unrelated scope cannot change the featured order'
);

select throws_ok(
  $sql$select public.reorder_featured_projects_v1(
    array['e3000000-0000-4000-8000-000000000002']::uuid[])$sql$,
  '42501',
  null,
  'an unrelated scope cannot reorder the featured list'
);

reset role;

select * from finish();
rollback;
