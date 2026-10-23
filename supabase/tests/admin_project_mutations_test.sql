-- T-045 — transactional admin project mutations (pgTAP).
--
-- Design authority:
--   * docs/tickets/T-045-admin-mutation-hardening.md — one transaction for the
--     root write, translation upserts and per-locale deletes; a lifecycle
--     transition is atomic too; non-admins must not effect a write; the
--     status='published' ↔ published_at invariant is enforced at the DB.
--   * docs/architecture.md §3 — mutations live behind a feature seam, here a
--     single PostgreSQL RPC instead of four independent PostgREST requests.
--   * docs/architecture.md §4 — the lifecycle is draft/published/archived and
--     a published row always carries a publication timestamp.
--   * docs/architecture.md §6 — authorization is enforced in PostgreSQL. The
--     functions are SECURITY INVOKER and re-check public.is_admin() inside;
--     RLS remains the second, independent boundary.
--   * docs/tickets/DECISIONS.md D-17 — app_metadata.role='admin' is the only
--     trusted admin claim.
--
-- Expected RED before the T-045 migration exists: the signature/security
-- assertions fail (to_regprocedure is null) and every RPC call errors with
-- "function public.save_project_v1(...) does not exist".
--
-- Identity simulation follows TESTING §3 (SET LOCAL ROLE + request.jwt.claims).
-- The whole file runs in one transaction and rolls back, so fixtures never
-- leak into the seeded database.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(56);

-- ---------------------------------------------------------------------------
-- Signature, privilege and hardening checks
-- ---------------------------------------------------------------------------

select ok(
  to_regprocedure(
    'public.save_project_v1(uuid,text,public.content_status,integer,text,date,date,timestamptz,jsonb)'
  ) is not null,
  'save_project_v1 exists with the transactional save signature'
);

select is(
  (
    select prosecdef
      from pg_proc
     where oid = to_regprocedure(
       'public.save_project_v1(uuid,text,public.content_status,integer,text,date,date,timestamptz,jsonb)'
     )
  ),
  false,
  'save_project_v1 is SECURITY INVOKER (RLS still applies)'
);

select ok(
  (
    select proconfig
      from pg_proc
     where oid = to_regprocedure(
       'public.save_project_v1(uuid,text,public.content_status,integer,text,date,date,timestamptz,jsonb)'
     )
  ) @> array['search_path=""'],
  'save_project_v1 pins search_path to the empty path'
);

select ok(
  exists (
    select 1
      from pg_proc
     where oid = to_regprocedure(
         'public.save_project_v1(uuid,text,public.content_status,integer,text,date,date,timestamptz,jsonb)'
       )
       and has_function_privilege('authenticated', oid, 'EXECUTE')
  ),
  'authenticated may execute save_project_v1'
);

select ok(
  not exists (
    select 1
      from pg_proc
     where oid = to_regprocedure(
         'public.save_project_v1(uuid,text,public.content_status,integer,text,date,date,timestamptz,jsonb)'
       )
       and has_function_privilege('anon', oid, 'EXECUTE')
  ),
  'anon may not execute save_project_v1'
);

-- The migration deliberately withholds service_role: this is a caller-rights
-- admin operation, not a server integration. Prove the grant was not inherited
-- through PUBLIC or an environment default.
select ok(
  not exists (
    select 1
      from pg_proc
     where oid = to_regprocedure(
         'public.save_project_v1(uuid,text,public.content_status,integer,text,date,date,timestamptz,jsonb)'
       )
       and has_function_privilege('service_role', oid, 'EXECUTE')
  ),
  'service_role may not execute save_project_v1'
);

select ok(
  to_regprocedure(
    'public.transition_project_v1(uuid,public.content_status,timestamptz)'
  ) is not null,
  'transition_project_v1 exists with the lifecycle signature'
);

select is(
  (
    select prosecdef
      from pg_proc
     where oid = to_regprocedure(
       'public.transition_project_v1(uuid,public.content_status,timestamptz)'
     )
  ),
  false,
  'transition_project_v1 is SECURITY INVOKER'
);

select ok(
  (
    select proconfig
      from pg_proc
     where oid = to_regprocedure(
       'public.transition_project_v1(uuid,public.content_status,timestamptz)'
     )
  ) @> array['search_path=""'],
  'transition_project_v1 pins search_path to the empty path'
);

select ok(
  exists (
    select 1
      from pg_proc
     where oid = to_regprocedure(
         'public.transition_project_v1(uuid,public.content_status,timestamptz)'
       )
       and has_function_privilege('authenticated', oid, 'EXECUTE')
  ),
  'authenticated may execute transition_project_v1'
);

select ok(
  not exists (
    select 1
      from pg_proc
     where oid = to_regprocedure(
         'public.transition_project_v1(uuid,public.content_status,timestamptz)'
       )
       and has_function_privilege('anon', oid, 'EXECUTE')
  ),
  'anon may not execute transition_project_v1'
);

select ok(
  not exists (
    select 1
      from pg_proc
     where oid = to_regprocedure(
         'public.transition_project_v1(uuid,public.content_status,timestamptz)'
       )
       and has_function_privilege('service_role', oid, 'EXECUTE')
  ),
  'service_role may not execute transition_project_v1'
);

select ok(
  exists (
    select 1
      from pg_constraint
     where conrelid = 'public.projects'::regclass
       and conname = 'projects_published_at_check'
       and contype = 'c'
  ),
  'projects enforces status=published ⇒ published_at is not null'
);

-- ---------------------------------------------------------------------------
-- Fictional fixtures (inserted as superuser; RLS bypassed here)
-- ---------------------------------------------------------------------------

-- Featured ranks are globally unique (T-030), and this test transaction must
-- not depend on which ranks the seeded/local database happened to leave
-- behind. 424242 is outside any realistic fixture range; clearing it first is
-- safe because this whole file rolls back.
update public.projects set featured_rank = null where featured_rank = 424242;

insert into public.projects (id, slug, status, featured_rank) values
  ('c2000000-0000-4000-8000-000000000001', 't045-save-target', 'draft', null),
  ('c2000000-0000-4000-8000-000000000002', 't045-lifecycle', 'draft', null),
  ('c2000000-0000-4000-8000-000000000003', 't045-taken-slug', 'draft', null),
  ('c2000000-0000-4000-8000-000000000004', 't045-clear-target', 'draft', null);

insert into public.project_translations (id, project_id, locale, title, summary, body) values
  ('c2100000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000001', 'en',
   'Original EN', null, null),
  ('c2100000-0000-4000-8000-000000000002', 'c2000000-0000-4000-8000-000000000001', 'pl',
   'Original PL', null, null),
  ('c2100000-0000-4000-8000-000000000003', 'c2000000-0000-4000-8000-000000000002', 'en',
   'Lifecycle EN', null, null),
  ('c2100000-0000-4000-8000-000000000004', 'c2000000-0000-4000-8000-000000000003', 'en',
   'Taken slug EN', null, null),
  ('c2100000-0000-4000-8000-000000000005', 'c2000000-0000-4000-8000-000000000004', 'en',
   'Clear EN', null, null),
  ('c2100000-0000-4000-8000-000000000006', 'c2000000-0000-4000-8000-000000000004', 'pl',
   'Clear PL', null, null);

-- ---------------------------------------------------------------------------
-- Admin save: root + translation upsert + per-locale delete in one call
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  $json${"sub":"c0000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"admin"}}$json$,
  true
);
set local role authenticated;

select is(
  public.save_project_v1(
    'c2000000-0000-4000-8000-000000000001',
    't045-save-renamed',
    'published',
    424242,
    null,
    '2026-01-01',
    '2026-02-01',
    '2026-06-01T12:00:00Z',
    $json$[
      {"locale":"en","title":"Updated EN","summary":"S","body":"B"},
      {"locale":"uk","title":"Оновлено"}
    ]$json$::jsonb
  ),
  'c2000000-0000-4000-8000-000000000001'::uuid,
  'save_project_v1 returns the persisted project id'
);

select is(
  (select slug from public.projects where id = 'c2000000-0000-4000-8000-000000000001'),
  't045-save-renamed',
  'save_project_v1 writes the canonical slug'
);

select is(
  (select status from public.projects where id = 'c2000000-0000-4000-8000-000000000001'),
  'published'::public.content_status,
  'save_project_v1 writes the requested lifecycle status'
);

-- T-030 changed this contract: the project editor's checkbox may request a
-- feature, but the database owns the slot. A newly featured row appends
-- max(rank)+1 (the seed already holds rank 1); an already-featured row keeps
-- its rank. This keeps the homepage order collision-free without a second
-- write path.
select is(
  (select featured_rank from public.projects where id = 'c2000000-0000-4000-8000-000000000001'),
  2,
  'save_project_v1 appends the next dense featured slot (T-030)'
);

select is(
  (select start_date from public.projects where id = 'c2000000-0000-4000-8000-000000000001'),
  '2026-01-01'::date,
  'save_project_v1 writes the start date'
);

select is(
  (select end_date from public.projects where id = 'c2000000-0000-4000-8000-000000000001'),
  '2026-02-01'::date,
  'save_project_v1 writes the end date'
);

select is(
  (select published_at from public.projects where id = 'c2000000-0000-4000-8000-000000000001'),
  '2026-06-01T12:00:00Z'::timestamptz,
  'save_project_v1 writes published_at for a published row'
);

select is(
  (select count(*) from public.project_translations
    where project_id = 'c2000000-0000-4000-8000-000000000001'),
  2::bigint,
  'save_project_v1 leaves exactly the supplied translation locales'
);

select is(
  (select count(*) from public.project_translations
    where project_id = 'c2000000-0000-4000-8000-000000000001'
      and locale = 'pl'),
  0::bigint,
  'save_project_v1 removes a locale the editor cleared'
);

select is(
  (select title from public.project_translations
    where project_id = 'c2000000-0000-4000-8000-000000000001' and locale = 'en'),
  'Updated EN',
  'save_project_v1 upserts the supplied English translation'
);

select is(
  (select summary from public.project_translations
    where project_id = 'c2000000-0000-4000-8000-000000000001' and locale = 'en'),
  'S',
  'save_project_v1 writes the supplied summary'
);

select is(
  (select body from public.project_translations
    where project_id = 'c2000000-0000-4000-8000-000000000001' and locale = 'en'),
  'B',
  'save_project_v1 writes the supplied body'
);

select is(
  (select title from public.project_translations
    where project_id = 'c2000000-0000-4000-8000-000000000001' and locale = 'uk'),
  'Оновлено',
  'save_project_v1 inserts a new locale in the same transaction'
);

-- Fault injection: the root update and the uk deletion happen before the
-- invalid translation row raises. All of it must roll back.
select throws_ok(
  $sql$
    select public.save_project_v1(
      'c2000000-0000-4000-8000-000000000001',
      't045-should-not-stick',
      'draft',
      null,
      null,
      null,
      null,
      null,
      '[{"locale":"en","title":"Should not stick"},{"locale":"pl","title":"   "}]'::jsonb
    )
  $sql$,
  '23514',
  null,
  'a blank translation title aborts the whole save'
);

select is(
  (select slug from public.projects where id = 'c2000000-0000-4000-8000-000000000001'),
  't045-save-renamed',
  'mid-flight failure rolls back the root update'
);

select is(
  (select title from public.project_translations
    where project_id = 'c2000000-0000-4000-8000-000000000001' and locale = 'en'),
  'Updated EN',
  'mid-flight failure rolls back the translation upsert'
);

select is(
  (select count(*) from public.project_translations
    where project_id = 'c2000000-0000-4000-8000-000000000001' and locale = 'uk'),
  1::bigint,
  'mid-flight failure rolls back the per-locale delete'
);

reset role;

-- ---------------------------------------------------------------------------
-- Non-admin callers cannot execute the RPC to effect
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  $json${"sub":"c0000000-0000-4000-8000-000000000002","role":"authenticated"}$json$,
  true
);
set local role authenticated;

select throws_ok(
  $sql$
    select public.save_project_v1(
      null,
      't045-nonadmin-attempt',
      'draft',
      null,
      null,
      null,
      null,
      null,
      '[{"locale":"en","title":"Nope"}]'::jsonb
    )
  $sql$,
  '42501',
  null,
  'an authenticated non-admin cannot effect a save through save_project_v1'
);

select is(
  (select count(*) from public.projects where slug = 't045-nonadmin-attempt'),
  0::bigint,
  'the denied non-admin save wrote no root row'
);

reset role;

select set_config('request.jwt.claims', $json${"role":"anon"}$json$, true);
set local role anon;

select throws_ok(
  $sql$
    select public.save_project_v1(
      null,
      't045-anon-attempt',
      'draft',
      null,
      null,
      null,
      null,
      null,
      '[]'::jsonb
    )
  $sql$,
  '42501',
  null,
  'anon cannot execute save_project_v1'
);

reset role;

select set_config(
  'request.jwt.claims',
  $json${"sub":"c0000000-0000-4000-8000-000000000003","role":"authenticated"}$json$,
  true
);
set local role authenticated;

select throws_ok(
  $sql$
    select public.transition_project_v1(
      'c2000000-0000-4000-8000-000000000002',
      'published',
      '2026-07-01T00:00:00Z'
    )
  $sql$,
  '42501',
  null,
  'an authenticated non-admin cannot effect a lifecycle transition'
);

-- Read back as the migration role: RLS correctly hides a draft from the
-- non-admin, so the "nothing changed" proof must not run under that identity.
reset role;

select is(
  (select status from public.projects where id = 'c2000000-0000-4000-8000-000000000002'),
  'draft'::public.content_status,
  'the denied non-admin transition left the lifecycle untouched'
);

-- ---------------------------------------------------------------------------
-- Admin lifecycle transitions are atomic and maintain the invariant
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  $json${"sub":"c0000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"admin"}}$json$,
  true
);
set local role authenticated;

select lives_ok(
  $sql$
    select public.transition_project_v1(
      'c2000000-0000-4000-8000-000000000002',
      'published',
      '2026-07-01T00:00:00Z'
    )
  $sql$,
  'admin publish through transition_project_v1 succeeds'
);

select is(
  (select status from public.projects where id = 'c2000000-0000-4000-8000-000000000002'),
  'published'::public.content_status,
  'publish sets status to published'
);

select is(
  (select published_at from public.projects where id = 'c2000000-0000-4000-8000-000000000002'),
  '2026-07-01T00:00:00Z'::timestamptz,
  'publish stores the supplied publication timestamp'
);

select lives_ok(
  $sql$
    select public.transition_project_v1(
      'c2000000-0000-4000-8000-000000000002',
      'draft',
      null
    )
  $sql$,
  'admin unpublish through transition_project_v1 succeeds'
);

select is(
  (select status from public.projects where id = 'c2000000-0000-4000-8000-000000000002'),
  'draft'::public.content_status,
  'unpublish returns the row to draft'
);

select is(
  (select published_at from public.projects where id = 'c2000000-0000-4000-8000-000000000002'),
  null::timestamptz,
  'unpublish clears published_at'
);

select lives_ok(
  $sql$
    select public.transition_project_v1(
      'c2000000-0000-4000-8000-000000000002',
      'archived',
      null
    )
  $sql$,
  'admin archive through transition_project_v1 succeeds'
);

select is(
  (select status from public.projects where id = 'c2000000-0000-4000-8000-000000000002'),
  'archived'::public.content_status,
  'archive sets status to archived'
);

select is(
  (select published_at from public.projects where id = 'c2000000-0000-4000-8000-000000000002'),
  null::timestamptz,
  'archive clears published_at'
);

reset role;

-- ---------------------------------------------------------------------------
-- The status ↔ published_at invariant is enforced for every write path
-- ---------------------------------------------------------------------------

select throws_ok(
  $sql$
    insert into public.projects (id, slug, status, published_at)
    values ('c2000000-0000-4000-8000-0000000000f1', 't045-invalid-published', 'published', null)
  $sql$,
  '23514',
  null,
  'a direct insert cannot publish without published_at'
);

select throws_ok(
  $sql$
    update public.projects
       set status = 'published'
     where id = 'c2000000-0000-4000-8000-000000000002'
  $sql$,
  '23514',
  null,
  'a direct update cannot publish without published_at'
);

select is(
  (select status from public.projects where id = 'c2000000-0000-4000-8000-000000000002'),
  'archived'::public.content_status,
  'the rejected direct update left the row untouched'
);

select set_config(
  'request.jwt.claims',
  $json${"sub":"c0000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"admin"}}$json$,
  true
);
set local role authenticated;

select throws_ok(
  $sql$
    select public.save_project_v1(
      'c2000000-0000-4000-8000-000000000002',
      't045-lifecycle',
      'published',
      null,
      null,
      null,
      null,
      null,
      '[]'::jsonb
    )
  $sql$,
  '23514',
  null,
  'save_project_v1 cannot publish without a publication timestamp'
);

select is(
  (select status from public.projects where id = 'c2000000-0000-4000-8000-000000000002'),
  'archived'::public.content_status,
  'the rejected RPC save left the row untouched'
);

reset role;

select lives_ok(
  $sql$
    insert into public.projects (id, slug, status, published_at)
    values (
      'c2000000-0000-4000-8000-0000000000f2',
      't045-valid-published',
      'published',
      '2026-08-01T00:00:00Z'
    )
  $sql$,
  'a published row with published_at is still accepted'
);

-- ---------------------------------------------------------------------------
-- Slug conflicts still surface as the 23505 the client maps to a field error
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  $json${"sub":"c0000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"admin"}}$json$,
  true
);
set local role authenticated;

select throws_ok(
  $sql$
    select public.save_project_v1(
      'c2000000-0000-4000-8000-000000000001',
      't045-taken-slug',
      'draft',
      null,
      null,
      null,
      null,
      null,
      '[]'::jsonb
    )
  $sql$,
  '23505',
  null,
  'an update to an existing canonical slug raises the unique violation'
);

select is(
  (select slug from public.projects where id = 'c2000000-0000-4000-8000-000000000001'),
  't045-save-renamed',
  'the slug conflict rolled back the root update'
);

select throws_ok(
  $sql$
    select public.save_project_v1(
      null,
      't045-taken-slug',
      'draft',
      null,
      null,
      null,
      null,
      null,
      '[]'::jsonb
    )
  $sql$,
  '23505',
  null,
  'an insert with an existing canonical slug raises the unique violation'
);

select is(
  (select count(*) from public.projects where slug = 't045-taken-slug'),
  1::bigint,
  'the failed insert added no duplicate slug row'
);

-- ---------------------------------------------------------------------------
-- An empty translation payload clears every locale in one statement
-- ---------------------------------------------------------------------------

select is(
  public.save_project_v1(
    'c2000000-0000-4000-8000-000000000004',
    't045-clear-target',
    'draft',
    null,
    null,
    null,
    null,
    null,
    '[]'::jsonb
  ),
  'c2000000-0000-4000-8000-000000000004'::uuid,
  'save_project_v1 accepts an empty translation payload'
);

select is(
  (select count(*) from public.project_translations
    where project_id = 'c2000000-0000-4000-8000-000000000004'),
  0::bigint,
  'an empty payload removes every translation row for the project'
);

reset role;

select * from finish();
rollback;
