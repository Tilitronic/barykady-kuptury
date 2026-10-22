-- T-028 — transactional site-page and team mutations (pgTAP).
--
-- Design authority:
--   * docs/tickets/T-028-admin-site-team.md — per-locale editing without
--     cross-locale loss, publish gating (client), collision-free keyboard
--     reorder, portrait reference removal.
--   * docs/architecture.md §4 — root lifecycle/order + normalized translations.
--   * docs/architecture.md §6.1 — `pages:write` / `team:write` re-checked
--     inside the T-045-style RPCs; RLS remains the second boundary.
--   * T-045 — the paired transactional RPC pattern copied per entity.
--
-- Expected RED before the T-028 migration exists: every signature/security/
-- privilege assertion fails (to_regprocedure is null) and every RPC call errors
-- with "function ... does not exist".
--
-- Identity simulation follows TESTING §3 (SET LOCAL ROLE + request.jwt.claims).
-- The whole file runs in one transaction and rolls back, so fixtures never
-- leak into the seeded database.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(84);

-- ---------------------------------------------------------------------------
-- Signatures, security and privileges
-- ---------------------------------------------------------------------------

select ok(
  to_regprocedure(
    'public.save_site_page_v1(uuid,public.content_status,timestamptz,jsonb)'
  ) is not null,
  'save_site_page_v1 exists with the transactional save signature'
);

select is(
  (
    select prosecdef
      from pg_proc
     where oid = to_regprocedure(
       'public.save_site_page_v1(uuid,public.content_status,timestamptz,jsonb)'
     )
  ),
  false,
  'save_site_page_v1 is SECURITY INVOKER (RLS still applies)'
);

select ok(
  (
    select proconfig
      from pg_proc
     where oid = to_regprocedure(
       'public.save_site_page_v1(uuid,public.content_status,timestamptz,jsonb)'
     )
  ) @> array['search_path=""'],
  'save_site_page_v1 pins search_path to the empty path'
);

select ok(
  exists (
    select 1 from pg_proc
     where oid = to_regprocedure(
         'public.save_site_page_v1(uuid,public.content_status,timestamptz,jsonb)'
       )
       and has_function_privilege('authenticated', oid, 'EXECUTE')
  ),
  'authenticated may execute save_site_page_v1'
);

select ok(
  not exists (
    select 1 from pg_proc
     where oid = to_regprocedure(
         'public.save_site_page_v1(uuid,public.content_status,timestamptz,jsonb)'
       )
       and has_function_privilege('anon', oid, 'EXECUTE')
  ),
  'anon may not execute save_site_page_v1'
);

select ok(
  not exists (
    select 1 from pg_proc
     where oid = to_regprocedure(
         'public.save_site_page_v1(uuid,public.content_status,timestamptz,jsonb)'
       )
       and has_function_privilege('service_role', oid, 'EXECUTE')
  ),
  'service_role may not execute save_site_page_v1'
);

select ok(
  to_regprocedure(
    'public.transition_site_page_v1(uuid,public.content_status,timestamptz)'
  ) is not null,
  'transition_site_page_v1 exists with the lifecycle signature'
);

select is(
  (
    select prosecdef
      from pg_proc
     where oid = to_regprocedure(
       'public.transition_site_page_v1(uuid,public.content_status,timestamptz)'
     )
  ),
  false,
  'transition_site_page_v1 is SECURITY INVOKER'
);

select ok(
  (
    select proconfig
      from pg_proc
     where oid = to_regprocedure(
       'public.transition_site_page_v1(uuid,public.content_status,timestamptz)'
     )
  ) @> array['search_path=""'],
  'transition_site_page_v1 pins search_path'
);

select ok(
  exists (
    select 1 from pg_proc
     where oid = to_regprocedure(
         'public.transition_site_page_v1(uuid,public.content_status,timestamptz)'
       )
       and has_function_privilege('authenticated', oid, 'EXECUTE')
  ),
  'authenticated may execute transition_site_page_v1'
);

select ok(
  not exists (
    select 1 from pg_proc
     where oid = to_regprocedure(
         'public.transition_site_page_v1(uuid,public.content_status,timestamptz)'
       )
       and has_function_privilege('anon', oid, 'EXECUTE')
  ),
  'anon may not execute transition_site_page_v1'
);

select ok(
  not exists (
    select 1 from pg_proc
     where oid = to_regprocedure(
         'public.transition_site_page_v1(uuid,public.content_status,timestamptz)'
       )
       and has_function_privilege('service_role', oid, 'EXECUTE')
  ),
  'service_role may not execute transition_site_page_v1'
);

select ok(
  to_regprocedure(
    'public.save_team_member_v1(uuid,text,public.content_status,integer,text,timestamptz,jsonb)'
  ) is not null,
  'save_team_member_v1 exists with the transactional save signature'
);

select is(
  (
    select prosecdef
      from pg_proc
     where oid = to_regprocedure(
       'public.save_team_member_v1(uuid,text,public.content_status,integer,text,timestamptz,jsonb)'
     )
  ),
  false,
  'save_team_member_v1 is SECURITY INVOKER'
);

select ok(
  (
    select proconfig
      from pg_proc
     where oid = to_regprocedure(
       'public.save_team_member_v1(uuid,text,public.content_status,integer,text,timestamptz,jsonb)'
     )
  ) @> array['search_path=""'],
  'save_team_member_v1 pins search_path'
);

select ok(
  exists (
    select 1 from pg_proc
     where oid = to_regprocedure(
         'public.save_team_member_v1(uuid,text,public.content_status,integer,text,timestamptz,jsonb)'
       )
       and has_function_privilege('authenticated', oid, 'EXECUTE')
  ),
  'authenticated may execute save_team_member_v1'
);

select ok(
  not exists (
    select 1 from pg_proc
     where oid = to_regprocedure(
         'public.save_team_member_v1(uuid,text,public.content_status,integer,text,timestamptz,jsonb)'
       )
       and has_function_privilege('anon', oid, 'EXECUTE')
  ),
  'anon may not execute save_team_member_v1'
);

select ok(
  not exists (
    select 1 from pg_proc
     where oid = to_regprocedure(
         'public.save_team_member_v1(uuid,text,public.content_status,integer,text,timestamptz,jsonb)'
       )
       and has_function_privilege('service_role', oid, 'EXECUTE')
  ),
  'service_role may not execute save_team_member_v1'
);

select ok(
  to_regprocedure(
    'public.transition_team_member_v1(uuid,public.content_status,timestamptz)'
  ) is not null,
  'transition_team_member_v1 exists'
);

select is(
  (
    select prosecdef
      from pg_proc
     where oid = to_regprocedure(
       'public.transition_team_member_v1(uuid,public.content_status,timestamptz)'
     )
  ),
  false,
  'transition_team_member_v1 is SECURITY INVOKER'
);

select ok(
  (
    select proconfig
      from pg_proc
     where oid = to_regprocedure(
       'public.transition_team_member_v1(uuid,public.content_status,timestamptz)'
     )
  ) @> array['search_path=""'],
  'transition_team_member_v1 pins search_path'
);

select ok(
  exists (
    select 1 from pg_proc
     where oid = to_regprocedure(
         'public.transition_team_member_v1(uuid,public.content_status,timestamptz)'
       )
       and has_function_privilege('authenticated', oid, 'EXECUTE')
  ),
  'authenticated may execute transition_team_member_v1'
);

select ok(
  not exists (
    select 1 from pg_proc
     where oid = to_regprocedure(
         'public.transition_team_member_v1(uuid,public.content_status,timestamptz)'
       )
       and has_function_privilege('anon', oid, 'EXECUTE')
  ),
  'anon may not execute transition_team_member_v1'
);

select ok(
  not exists (
    select 1 from pg_proc
     where oid = to_regprocedure(
         'public.transition_team_member_v1(uuid,public.content_status,timestamptz)'
       )
       and has_function_privilege('service_role', oid, 'EXECUTE')
  ),
  'service_role may not execute transition_team_member_v1'
);

select ok(
  to_regprocedure('public.reorder_team_members_v1(uuid[])') is not null,
  'reorder_team_members_v1 exists'
);

select is(
  (
    select prosecdef
      from pg_proc
     where oid = to_regprocedure('public.reorder_team_members_v1(uuid[])')
  ),
  false,
  'reorder_team_members_v1 is SECURITY INVOKER'
);

select ok(
  (
    select proconfig
      from pg_proc
     where oid = to_regprocedure('public.reorder_team_members_v1(uuid[])')
  ) @> array['search_path=""'],
  'reorder_team_members_v1 pins search_path'
);

select ok(
  exists (
    select 1 from pg_proc
     where oid = to_regprocedure('public.reorder_team_members_v1(uuid[])')
       and has_function_privilege('authenticated', oid, 'EXECUTE')
  ),
  'authenticated may execute reorder_team_members_v1'
);

select ok(
  not exists (
    select 1 from pg_proc
     where oid = to_regprocedure('public.reorder_team_members_v1(uuid[])')
       and has_function_privilege('anon', oid, 'EXECUTE')
  ),
  'anon may not execute reorder_team_members_v1'
);

select ok(
  not exists (
    select 1 from pg_proc
     where oid = to_regprocedure('public.reorder_team_members_v1(uuid[])')
       and has_function_privilege('service_role', oid, 'EXECUTE')
  ),
  'service_role may not execute reorder_team_members_v1'
);

-- ---------------------------------------------------------------------------
-- Declarative invariants
-- ---------------------------------------------------------------------------

select ok(
  exists (
    select 1 from pg_constraint
     where conrelid = 'public.site_pages'::regclass
       and conname = 'site_pages_published_at_check'
       and contype = 'c'
  ),
  'site pages enforce published ⇒ published_at'
);

select ok(
  exists (
    select 1 from pg_constraint
     where conrelid = 'public.team_members'::regclass
       and conname = 'team_members_published_at_check'
       and contype = 'c'
  ),
  'team members enforce published ⇒ published_at'
);

select ok(
  exists (
    select 1 from pg_constraint
     where conrelid = 'public.team_members'::regclass
       and conname = 'team_members_sort_order_key'
       and contype = 'u'
  ),
  'team members have a unique sort_order constraint'
);

select is(
  (
    select condeferrable
      from pg_constraint
     where conrelid = 'public.team_members'::regclass
       and conname = 'team_members_sort_order_key'
  ),
  true,
  'the sort_order constraint is deferrable'
);

select is(
  (
    select condeferred
      from pg_constraint
     where conrelid = 'public.team_members'::regclass
       and conname = 'team_members_sort_order_key'
  ),
  true,
  'the sort_order constraint is initially deferred'
);

-- ---------------------------------------------------------------------------
-- Fixtures (inserted as superuser; RLS bypassed here)
-- ---------------------------------------------------------------------------

insert into public.site_pages (
  id, page_key, status, sort_order, published_at
) values
  ('d2000000-0000-4000-8000-000000000001', 'about-t028', 'published', 1,
   '2026-01-01T00:00:00Z'),
  ('d2000000-0000-4000-8000-000000000002', 'mission-t028', 'draft', 2, null);

insert into public.site_page_translations (
  id, page_id, locale, title, body, meta_description
) values
  ('d2100000-0000-4000-8000-000000000001',
   'd2000000-0000-4000-8000-000000000001', 'en',
   'Original EN', 'Original body', 'Original meta'),
  ('d2100000-0000-4000-8000-000000000002',
   'd2000000-0000-4000-8000-000000000001', 'pl',
   'Oryginalny PL', 'PL body', 'PL meta'),
  ('d2100000-0000-4000-8000-000000000003',
   'd2000000-0000-4000-8000-000000000002', 'en',
   'Mission EN', 'Mission body', null);

insert into public.team_members (
  id, name, status, sort_order, portrait_path, published_at
) values
  ('d3000000-0000-4000-8000-000000000001', 'Alpha', 'published', 10,
   'team/alpha.png', '2026-01-01T00:00:00Z'),
  ('d3000000-0000-4000-8000-000000000002', 'Beta', 'draft', 11, null, null),
  ('d3000000-0000-4000-8000-000000000003', 'Gamma', 'draft', 12, null, null);

insert into public.team_member_translations (
  id, member_id, locale, role, bio
) values
  ('d3100000-0000-4000-8000-000000000001',
   'd3000000-0000-4000-8000-000000000001', 'en', 'Original role', 'Original bio');

-- ---------------------------------------------------------------------------
-- Admin site-page save: root + complete set, no cross-locale loss
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  $json${"sub":"d0000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"admin"}}$json$,
  true
);
set local role authenticated;

select is(
  public.save_site_page_v1(
    'd2000000-0000-4000-8000-000000000001',
    'draft',
    null,
    $json$[
      {"locale":"en","title":"Updated EN","body":"Updated body","metaDescription":"Updated meta"},
      {"locale":"pl","title":"Oryginalny PL","body":"PL body","metaDescription":"PL meta"}
    ]$json$::jsonb
  ),
  'd2000000-0000-4000-8000-000000000001'::uuid,
  'save_site_page_v1 returns the persisted page id'
);

select is(
  (
    select status from public.site_pages
     where id = 'd2000000-0000-4000-8000-000000000001'
  ),
  'draft'::public.content_status,
  'save_site_page_v1 writes the requested lifecycle status'
);

select is(
  (
    select title from public.site_page_translations
     where page_id = 'd2000000-0000-4000-8000-000000000001' and locale = 'en'
  ),
  'Updated EN',
  'save_site_page_v1 upserts the edited English title'
);

select is(
  (
    select body from public.site_page_translations
     where page_id = 'd2000000-0000-4000-8000-000000000001' and locale = 'en'
  ),
  'Updated body',
  'save_site_page_v1 upserts the edited English body'
);

select is(
  (
    select meta_description from public.site_page_translations
     where page_id = 'd2000000-0000-4000-8000-000000000001' and locale = 'en'
  ),
  'Updated meta',
  'save_site_page_v1 preserves the supplied meta description'
);

select is(
  (
    select title from public.site_page_translations
     where page_id = 'd2000000-0000-4000-8000-000000000001' and locale = 'pl'
  ),
  'Oryginalny PL',
  'editing English never overwrites the Polish title'
);

select is(
  (
    select body from public.site_page_translations
     where page_id = 'd2000000-0000-4000-8000-000000000001' and locale = 'pl'
  ),
  'PL body',
  'editing English never overwrites the Polish body'
);

select is(
  (
    select count(*) from public.site_page_translations
     where page_id = 'd2000000-0000-4000-8000-000000000001'
  ),
  2::bigint,
  'save_site_page_v1 leaves exactly the supplied locale rows'
);

-- Fault injection: the root update and the delete statement run before the
-- blank English title raises. Everything must roll back.
select throws_ok(
  $sql$
    select public.save_site_page_v1(
      'd2000000-0000-4000-8000-000000000001',
      'published',
      '2026-07-01T00:00:00Z',
      '[{"locale":"en","title":"   ","body":"x"},
        {"locale":"pl","title":"Oryginalny PL","body":"PL body"}]'::jsonb
    )
  $sql$,
  '23514',
  null,
  'a blank page title aborts the whole save'
);

select is(
  (
    select status from public.site_pages
     where id = 'd2000000-0000-4000-8000-000000000001'
  ),
  'draft'::public.content_status,
  'mid-flight failure rolls back the page lifecycle update'
);

select is(
  (
    select title from public.site_page_translations
     where page_id = 'd2000000-0000-4000-8000-000000000001' and locale = 'en'
  ),
  'Updated EN',
  'mid-flight failure rolls back the translation upsert'
);

-- ---------------------------------------------------------------------------
-- Site-page lifecycle
-- ---------------------------------------------------------------------------

select lives_ok(
  $sql$
    select public.transition_site_page_v1(
      'd2000000-0000-4000-8000-000000000001',
      'published',
      '2026-07-01T00:00:00Z'
    )
  $sql$,
  'publish through transition_site_page_v1 succeeds'
);

select is(
  (
    select status from public.site_pages
     where id = 'd2000000-0000-4000-8000-000000000001'
  ),
  'published'::public.content_status,
  'publish sets the page to published'
);

select is(
  (
    select published_at from public.site_pages
     where id = 'd2000000-0000-4000-8000-000000000001'
  ),
  '2026-07-01T00:00:00Z'::timestamptz,
  'publish stores the supplied publication timestamp'
);

select lives_ok(
  $sql$
    select public.transition_site_page_v1(
      'd2000000-0000-4000-8000-000000000001',
      'draft',
      null
    )
  $sql$,
  'unpublish through transition_site_page_v1 succeeds'
);

select is(
  (
    select status from public.site_pages
     where id = 'd2000000-0000-4000-8000-000000000001'
  ),
  'draft'::public.content_status,
  'unpublish returns the page to draft'
);

select is(
  (
    select published_at from public.site_pages
     where id = 'd2000000-0000-4000-8000-000000000001'
  ),
  null::timestamptz,
  'unpublish clears published_at'
);

-- ---------------------------------------------------------------------------
-- Scope matrix: pages:write allowed, team:write refused, non-admin refused
-- ---------------------------------------------------------------------------

reset role;
select set_config(
  'request.jwt.claims',
  $json${"sub":"d0000000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{"role":"editor","scopes":["pages:write"]}}$json$,
  true
);
set local role authenticated;

select lives_ok(
  $sql$
    select public.save_site_page_v1(
      'd2000000-0000-4000-8000-000000000002',
      'draft',
      null,
      '[{"locale":"en","title":"Mission updated","body":"Mission body"}]'::jsonb
    )
  $sql$,
  'a pages:write editor may save a site page'
);

reset role;
select set_config(
  'request.jwt.claims',
  $json${"sub":"d0000000-0000-4000-8000-000000000003","role":"authenticated","app_metadata":{"role":"editor","scopes":["team:write"]}}$json$,
  true
);
set local role authenticated;

select throws_ok(
  $sql$
    select public.save_site_page_v1(
      'd2000000-0000-4000-8000-000000000002',
      'draft',
      null,
      '[{"locale":"en","title":"Nope","body":"Nope"}]'::jsonb
    )
  $sql$,
  '42501',
  null,
  'a team:write editor cannot save a site page'
);

reset role;
select set_config(
  'request.jwt.claims',
  $json${"sub":"d0000000-0000-4000-8000-000000000004","role":"authenticated"}$json$,
  true
);
set local role authenticated;

select throws_ok(
  $sql$
    select public.save_site_page_v1(
      'd2000000-0000-4000-8000-000000000001',
      'draft',
      null,
      '[]'::jsonb
    )
  $sql$,
  '42501',
  null,
  'an authenticated non-admin cannot save a site page'
);

-- T-028 scope is enforced in the database: no id means no page creation.
reset role;
select set_config(
  'request.jwt.claims',
  $json${"sub":"d0000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"admin"}}$json$,
  true
);
set local role authenticated;

select throws_ok(
  $sql$
    select public.save_site_page_v1(
      null,
      'draft',
      null,
      '[{"locale":"en","title":"Created?","body":"No"}]'::jsonb
    )
  $sql$,
  '22023',
  null,
  'save_site_page_v1 refuses to create a new page'
);

-- ---------------------------------------------------------------------------
-- Team save: computed position, translations, portrait reference removal
-- ---------------------------------------------------------------------------

select ok(
  public.save_team_member_v1(
    null,
    'Delta',
    'draft',
    null,
    null,
    null,
    '[{"locale":"en","role":"New role","bio":"New bio"}]'::jsonb
  ) is not null,
  'save_team_member_v1 returns the created member id'
);

select is(
  (select name from public.team_members where name = 'Delta'),
  'Delta',
  'save_team_member_v1 writes the locale-independent name'
);

select is(
  (select sort_order from public.team_members where name = 'Delta'),
  13,
  'a new member is appended at max(sort_order)+1'
);

select is(
  (
    select role from public.team_member_translations
     where member_id = (select id from public.team_members where name = 'Delta')
       and locale = 'en'
  ),
  'New role',
  'save_team_member_v1 writes the localized role'
);

select is(
  public.save_team_member_v1(
    'd3000000-0000-4000-8000-000000000001',
    'Alpha',
    'published',
    10,
    null,
    '2026-01-01T00:00:00Z',
    '[{"locale":"en","role":"Original role","bio":"Original bio"}]'::jsonb
  ),
  'd3000000-0000-4000-8000-000000000001'::uuid,
  'save_team_member_v1 updates an existing member'
);

select is(
  (
    select portrait_path from public.team_members
     where id = 'd3000000-0000-4000-8000-000000000001'
  ),
  null::text,
  'saving a null portrait path clears the reference'
);

-- Fault injection: a blank name must abort the translation write too.
select throws_ok(
  $sql$
    select public.save_team_member_v1(
      null,
      '   ',
      'draft',
      null,
      null,
      null,
      '[{"locale":"en","role":"Should not stick","bio":null}]'::jsonb
    )
  $sql$,
  '23514',
  null,
  'a blank member name aborts the whole save'
);

select is(
  (
    select count(*) from public.team_member_translations
     where role = 'Should not stick'
  ),
  0::bigint,
  'the aborted save wrote no translation row'
);

-- ---------------------------------------------------------------------------
-- Reorder: dense, collision-free and deterministic
-- ---------------------------------------------------------------------------

select lives_ok(
  $sql$
    select public.reorder_team_members_v1(array[
      'd3000000-0000-4000-8000-000000000003'::uuid,
      'd3000000-0000-4000-8000-000000000001'::uuid,
      'd3000000-0000-4000-8000-000000000002'::uuid,
      (select id from public.team_members where name = 'Delta')
    ])
  $sql$,
  'reorder_team_members_v1 persists a complete order'
);

select is(
  (
    select sort_order from public.team_members
     where id = 'd3000000-0000-4000-8000-000000000003'
  ),
  1,
  'the first supplied member gets position 1'
);

select is(
  (
    select sort_order from public.team_members
     where id = 'd3000000-0000-4000-8000-000000000001'
  ),
  2,
  'the second supplied member gets position 2'
);

select is(
  (
    select sort_order from public.team_members
     where id = 'd3000000-0000-4000-8000-000000000002'
  ),
  3,
  'the third supplied member gets position 3'
);

select is(
  (
    select array_agg(sort_order order by sort_order)
      from public.team_members
     where id in (
       'd3000000-0000-4000-8000-000000000001'::uuid,
       'd3000000-0000-4000-8000-000000000002'::uuid,
       'd3000000-0000-4000-8000-000000000003'::uuid
     )
  ),
  array[1, 2, 3],
  'the reordered positions are dense and collision-free'
);

select lives_ok(
  $sql$
    select public.reorder_team_members_v1(array[
      'd3000000-0000-4000-8000-000000000002'::uuid
    ])
  $sql$,
  'a partial reorder still succeeds'
);

select is(
  (
    select sort_order from public.team_members
     where id = 'd3000000-0000-4000-8000-000000000002'
  ),
  1,
  'the supplied member is placed at position 1'
);

select is(
  (
    select array_agg(sort_order order by sort_order)
      from public.team_members
     where id in (
       'd3000000-0000-4000-8000-000000000001'::uuid,
       'd3000000-0000-4000-8000-000000000002'::uuid,
       'd3000000-0000-4000-8000-000000000003'::uuid
     )
  ),
  array[1, 2, 3],
  'unlisted members are appended without colliding'
);

select throws_ok(
  $sql$
    select public.reorder_team_members_v1(array[
      'd3000000-0000-4000-8000-000000000002'::uuid,
      'd3000000-0000-4000-8000-000000000002'::uuid
    ])
  $sql$,
  '22023',
  null,
  'duplicate ids are rejected'
);

select throws_ok(
  $sql$
    select public.reorder_team_members_v1(array[
      'e3000000-0000-4000-8000-000000000999'::uuid
    ])
  $sql$,
  'P0002',
  null,
  'an unknown member id fails loudly'
);

-- ---------------------------------------------------------------------------
-- Team scope matrix and lifecycle
-- ---------------------------------------------------------------------------

reset role;
select set_config(
  'request.jwt.claims',
  $json${"sub":"d0000000-0000-4000-8000-000000000003","role":"authenticated","app_metadata":{"role":"editor","scopes":["team:write"]}}$json$,
  true
);
set local role authenticated;

select lives_ok(
  $sql$
    select public.save_team_member_v1(
      null,
      'Scoped Editor Member',
      'draft',
      null,
      null,
      null,
      '[{"locale":"en","role":null,"bio":null}]'::jsonb
    )
  $sql$,
  'a team:write editor may create a team member'
);

reset role;
select set_config(
  'request.jwt.claims',
  $json${"sub":"d0000000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{"role":"editor","scopes":["pages:write"]}}$json$,
  true
);
set local role authenticated;

select throws_ok(
  $sql$
    select public.save_team_member_v1(
      null,
      'Wrong Scope Member',
      'draft',
      null,
      null,
      null,
      '[{"locale":"en","role":null,"bio":null}]'::jsonb
    )
  $sql$,
  '42501',
  null,
  'a pages:write editor cannot create a team member'
);

reset role;
select set_config(
  'request.jwt.claims',
  $json${"sub":"d0000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"admin"}}$json$,
  true
);
set local role authenticated;

select lives_ok(
  $sql$
    select public.transition_team_member_v1(
      'd3000000-0000-4000-8000-000000000002',
      'published',
      '2026-08-01T00:00:00Z'
    )
  $sql$,
  'publish through transition_team_member_v1 succeeds'
);

select is(
  (
    select status from public.team_members
     where id = 'd3000000-0000-4000-8000-000000000002'
  ),
  'published'::public.content_status,
  'the member publish toggle sets published'
);

select is(
  (
    select published_at from public.team_members
     where id = 'd3000000-0000-4000-8000-000000000002'
  ),
  '2026-08-01T00:00:00Z'::timestamptz,
  'the member publish toggle stamps published_at'
);

select lives_ok(
  $sql$
    select public.transition_team_member_v1(
      'd3000000-0000-4000-8000-000000000002',
      'draft',
      null
    )
  $sql$,
  'unpublish through transition_team_member_v1 succeeds'
);

select is(
  (
    select status from public.team_members
     where id = 'd3000000-0000-4000-8000-000000000002'
  ),
  'draft'::public.content_status,
  'the member unpublish toggle returns to draft'
);

select is(
  (
    select published_at from public.team_members
     where id = 'd3000000-0000-4000-8000-000000000002'
  ),
  null::timestamptz,
  'the member unpublish toggle clears published_at'
);

-- ---------------------------------------------------------------------------
-- Delete cascade and non-admin reorder denial
-- ---------------------------------------------------------------------------

delete from public.team_members
 where id = 'd3000000-0000-4000-8000-000000000002';

select is(
  (
    select count(*) from public.team_member_translations
     where member_id = 'd3000000-0000-4000-8000-000000000002'
  ),
  0::bigint,
  'deleting a member cascades its translations'
);

reset role;
select set_config(
  'request.jwt.claims',
  $json${"sub":"d0000000-0000-4000-8000-000000000004","role":"authenticated"}$json$,
  true
);
set local role authenticated;

select throws_ok(
  $sql$
    select public.reorder_team_members_v1(array[
      'd3000000-0000-4000-8000-000000000001'::uuid
    ])
  $sql$,
  '42501',
  null,
  'an authenticated non-admin cannot reorder the team'
);

select * from finish();
rollback;
