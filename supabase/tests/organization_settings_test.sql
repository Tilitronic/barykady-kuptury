-- T-048 — organization settings store, visibility rule and scoped writes.
--
-- Design authority:
--   * docs/architecture.md §6.1 — `settings:write` is the new fixed scope; the
--     visibility rule says anonymous reads may select ONLY rows with
--     `visible = true`, while root and `settings:write` see every row.
--   * docs/architecture.md §6 — authorization lives at the data boundary.
--     `save_settings_v1` is SECURITY DEFINER with a pinned search_path and an
--     explicit capability re-check; direct client INSERT/UPDATE grants are
--     revoked so the RPC is the SOLE write path (gate fix FIX-1).
--   * docs/tickets/T-048-org-settings-visibility.md — denied settings writes
--     rejected at DB (pgTAP), audit records who/when.
--   * D-21 — deny-by-default; a zero-scope account sees public rows only and
--     cannot write.
--
-- Expected RED before the gate-fix migration edits: direct table writes are
-- still granted, save_settings_v1 is SECURITY INVOKER, and malformed
-- email/URL/NIP/REGON values are accepted. This file runs in one transaction
-- and rolls back.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(51);

-- ---------------------------------------------------------------------------
-- Shape, security and privileges
-- ---------------------------------------------------------------------------

select ok(
  to_regclass('public.organization_settings') is not null,
  'organization_settings table exists'
);

select ok(
  to_regprocedure('public.save_settings_v1(jsonb)') is not null,
  'save_settings_v1(jsonb) exists'
);

select is(
  (
    select prosecdef
      from pg_proc
     where oid = to_regprocedure('public.save_settings_v1(jsonb)')
  ),
  true,
  'save_settings_v1 is SECURITY DEFINER (sole write path; capability re-checked inside)'
);

select ok(
  (
    select proconfig
      from pg_proc
     where oid = to_regprocedure('public.save_settings_v1(jsonb)')
  ) @> array['search_path=""'],
  'save_settings_v1 pins search_path to the empty path'
);

select ok(
  exists (
    select 1 from pg_proc
     where oid = to_regprocedure('public.save_settings_v1(jsonb)')
       and has_function_privilege('authenticated', oid, 'EXECUTE')
  ),
  'authenticated may execute save_settings_v1'
);

select ok(
  not exists (
    select 1 from pg_proc
     where oid = to_regprocedure('public.save_settings_v1(jsonb)')
       and has_function_privilege('anon', oid, 'EXECUTE')
  ),
  'anon may not execute save_settings_v1'
);

select ok(
  not exists (
    select 1 from pg_proc
     where oid = to_regprocedure('public.save_settings_v1(jsonb)')
       and has_function_privilege('service_role', oid, 'EXECUTE')
  ),
  'service_role may not execute save_settings_v1'
);

select ok(
  (
    select relrowsecurity
      from pg_class
     where oid = 'public.organization_settings'::regclass
  ),
  'organization_settings has RLS enabled'
);

-- Gate fix FIX-1: only SELECT is granted to client roles. Writes must go
-- through save_settings_v1; a future accidental grant still cannot write
-- because no INSERT/UPDATE policy exists.
select is(
  has_table_privilege(
    'authenticated', 'public.organization_settings', 'SELECT'
  ),
  true,
  'authenticated may read settings (RLS narrows rows)'
);

select is(
  has_table_privilege(
    'authenticated', 'public.organization_settings', 'INSERT'
  ),
  false,
  'authenticated has no direct INSERT grant on organization_settings'
);

select is(
  has_table_privilege(
    'authenticated', 'public.organization_settings', 'UPDATE'
  ),
  false,
  'authenticated has no direct UPDATE grant on organization_settings'
);

select ok(
  exists (
    select 1 from pg_constraint
     where conrelid = 'public.organization_settings'::regclass
       and contype = 'p'
       and conkey = array[
         (select attnum from pg_attribute
           where attrelid = 'public.organization_settings'::regclass
             and attname = 'key')
       ]
  ),
  'key is the primary key (one row per fact)'
);

select is(
  (
    select column_default
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'organization_settings'
       and column_name = 'visible'
  ),
  'true',
  'visible defaults to true'
);

select ok(
  not exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'organization_settings'
       and column_name in (
         'secret', 'token', 'password', 'credential', 'api_key'
       )
  ),
  'the settings store carries no credential column'
);

-- ---------------------------------------------------------------------------
-- Fixtures (inserted as superuser; RLS bypassed)
-- ---------------------------------------------------------------------------

insert into public.organization_settings (key, value, visible) values
  ('contact.email', '{"en":"kontakt@example.test"}'::jsonb, true),
  ('org.nip', '{"en":"7831961912"}'::jsonb, false),
  ('org.regon', '{"en":"545503070"}'::jsonb, true),
  ('social.facebook', '{"en":"https://example.test/fb"}'::jsonb, true);

-- ---------------------------------------------------------------------------
-- Anonymous reads: visible rows only, never the hidden value
-- ---------------------------------------------------------------------------

set local role anon;

select is(
  (select count(*)::integer from public.organization_settings),
  3,
  'anon sees only the three visible rows'
);

select is(
  (
    select count(*)::integer
      from public.organization_settings
     where key = 'org.nip'
  ),
  0,
  'anon cannot select the hidden NIP row'
);

select throws_ok(
  $sql$
    insert into public.organization_settings (key, value)
    values ('org.name', '{"en":"Anon"}'::jsonb)
  $sql$,
  '42501',
  null,
  'anon has no direct INSERT grant (the RPC is the sole writer)'
);

reset role;

-- ---------------------------------------------------------------------------
-- Authenticated non-admin: public rows only; no writes
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  $json${"sub":"e0000000-0000-4000-8000-000000000001","role":"authenticated"}$json$,
  true
);
set local role authenticated;

select is(
  (select count(*)::integer from public.organization_settings),
  3,
  'an authenticated zero-scope account sees only visible rows'
);

select throws_ok(
  $sql$
    insert into public.organization_settings (key, value)
    values ('org.name', '{"en":"Nope"}'::jsonb)
  $sql$,
  '42501',
  null,
  'authenticated has no direct INSERT grant (the RPC is the sole writer)'
);

reset role;

-- ---------------------------------------------------------------------------
-- Scoped editor: settings:write reads all rows and may call the RPC
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  $json${"sub":"e0000000-0000-4000-8000-000000000002","role":"authenticated","email":"settings@demo.local","app_metadata":{"role":"editor","scopes":["settings:write"]}}$json$,
  true
);
set local role authenticated;

select is(
  (select count(*)::integer from public.organization_settings),
  4,
  'a settings:write editor sees hidden rows too'
);

select lives_ok(
  $sql$
    select public.save_settings_v1(
      '[{"key":"contact.email","value":{"en":"neu@example.test","pl":"nowy@example.test"},"visible":true}]'::jsonb
    )
  $sql$,
  'a settings:write editor may save settings'
);

select is(
  (
    select value ->> 'pl'
      from public.organization_settings
     where key = 'contact.email'
  ),
  'nowy@example.test',
  'save_settings_v1 upserts the per-locale value'
);

select is(
  (
    select updated_by
      from public.organization_settings
     where key = 'contact.email'
  ),
  'e0000000-0000-4000-8000-000000000002'::uuid,
  'save_settings_v1 records the acting user id'
);

select is(
  (
    select updated_by_email
      from public.organization_settings
     where key = 'contact.email'
  ),
  'settings@demo.local',
  'save_settings_v1 snapshots the acting user email for the audit surface'
);

select is(
  (
    select count(*)::integer
      from public.organization_settings
     where key = 'org.settings_initialized'
       and visible
  ),
  1,
  'save_settings_v1 provisions the non-editable sentinel marker'
);

select throws_ok(
  $sql$
    insert into public.organization_settings (key, value)
    values ('org.name', '{"en":"Direct"}'::jsonb)
  $sql$,
  '42501',
  null,
  'settings:write cannot bypass the RPC with a direct INSERT'
);

select throws_ok(
  $sql$
    update public.organization_settings
       set visible = false
     where key = 'contact.email'
  $sql$,
  '42501',
  null,
  'settings:write cannot bypass the RPC with a direct UPDATE'
);

reset role;

-- ---------------------------------------------------------------------------
-- Scoped editor without settings:write: RPC denied, no partial write
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  $json${"sub":"e0000000-0000-4000-8000-000000000003","role":"authenticated","app_metadata":{"role":"editor","scopes":["projects:write"]}}$json$,
  true
);
set local role authenticated;

select throws_ok(
  $sql$
    select public.save_settings_v1(
      '[{"key":"org.nip","value":{"en":"0000000000"},"visible":true}]'::jsonb
    )
  $sql$,
  '42501',
  null,
  'a projects:write editor cannot save settings'
);

reset role;

-- ---------------------------------------------------------------------------
-- Root: allowed; hidden flag removes the row from the anonymous payload
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  $json${"sub":"e0000000-0000-4000-8000-000000000004","role":"authenticated","email":"root@demo.local","app_metadata":{"role":"admin"}}$json$,
  true
);
set local role authenticated;

select lives_ok(
  $sql$
    select public.save_settings_v1(
      '[{"key":"org.regon","value":{"en":"545503070"},"visible":false}]'::jsonb
    )
  $sql$,
  'a root administrator may save settings'
);

select is(
  (
    select visible
      from public.organization_settings
     where key = 'org.regon'
  ),
  false,
  'save_settings_v1 persists the visibility flag'
);

select throws_ok(
  $sql$
    update public.organization_settings
       set visible = true
     where key = 'org.regon'
  $sql$,
  '42501',
  null,
  'even a root administrator cannot bypass the sole RPC write path'
);

reset role;
set local role anon;

select is(
  (
    select count(*)::integer
      from public.organization_settings
     where key = 'org.regon'
  ),
  0,
  'a newly hidden row disappears from the anonymous payload'
);

reset role;

-- ---------------------------------------------------------------------------
-- Payload guards + atomicity
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  $json${"sub":"e0000000-0000-4000-8000-000000000004","role":"authenticated","email":"root@demo.local","app_metadata":{"role":"admin"}}$json$,
  true
);
set local role authenticated;

select throws_ok(
  $sql$select public.save_settings_v1('{"key":"x"}'::jsonb)$sql$,
  '22023',
  null,
  'the change set must be a JSON array'
);

select throws_ok(
  $sql$select public.save_settings_v1('[]'::jsonb)$sql$,
  '22023',
  null,
  'an empty change set is rejected'
);

select throws_ok(
  $sql$
    select public.save_settings_v1(
      '[{"key":"org.regon","value":"not-an-object","visible":true}]'::jsonb
    )
  $sql$,
  '22023',
  null,
  'a non-object value is rejected'
);

select throws_ok(
  $sql$
    select public.save_settings_v1(
      '[{"key":"org.regon","value":{"de":"x"},"visible":true}]'::jsonb
    )
  $sql$,
  '22023',
  null,
  'unknown locale keys are rejected'
);

select throws_ok(
  $sql$
    select public.save_settings_v1(
      '[
        {"key":"org.regon","value":{"en":"545503070"},"visible":true},
        {"key":"contact.email","value":{"en":"kontakt@example.test"},"visible":"yes"}
      ]'::jsonb
    )
  $sql$,
  '22023',
  null,
  'a malformed second entry rejects the whole change set'
);

select is(
  (
    select visible
      from public.organization_settings
     where key = 'org.regon'
  ),
  false,
  'the failed multi-row save rolled back the first entry (atomic)'
);

-- ---------------------------------------------------------------------------
-- Gate fix FIX-2: key-aware kind validation at the DB boundary
-- ---------------------------------------------------------------------------
-- The client mirrors these rules for localized field errors, but a direct RPC
-- caller must not be able to store a malformed fact.

select lives_ok(
  $sql$
    select public.save_settings_v1(
      '[{"key":"contact.email","value":{"en":"valid@example.test"},"visible":true}]'::jsonb
    )
  $sql$,
  'a valid email is accepted at the DB boundary'
);

select throws_ok(
  $sql$
    select public.save_settings_v1(
      '[{"key":"contact.email","value":{"en":"not-an-email"},"visible":true}]'::jsonb
    )
  $sql$,
  '22023',
  null,
  'a malformed email is rejected at the DB boundary'
);

select throws_ok(
  $sql$
    select public.save_settings_v1(
      '[{"key":"contact.email","value":{"en":"valid@example.test","pl":"bad"},"visible":true}]'::jsonb
    )
  $sql$,
  '22023',
  null,
  'every locale value is kind-checked, not only the canonical one'
);

select lives_ok(
  $sql$
    select public.save_settings_v1(
      '[{"key":"org.privacy_url","value":{"en":"https://example.test/privacy"},"visible":true}]'::jsonb
    )
  $sql$,
  'an absolute http(s) URL is accepted at the DB boundary'
);

select throws_ok(
  $sql$
    select public.save_settings_v1(
      '[{"key":"org.privacy_url","value":{"en":"javascript:alert(1)"},"visible":true}]'::jsonb
    )
  $sql$,
  '22023',
  null,
  'a non-http(s) URL is rejected at the DB boundary'
);

select throws_ok(
  $sql$
    select public.save_settings_v1(
      '[{"key":"social.facebook","value":{"en":"/relative"},"visible":true}]'::jsonb
    )
  $sql$,
  '22023',
  null,
  'a relative social URL is rejected at the DB boundary'
);

select lives_ok(
  $sql$
    select public.save_settings_v1(
      '[{"key":"org.nip","value":{"en":"7831961912"},"visible":true}]'::jsonb
    )
  $sql$,
  'a NIP with a valid checksum is accepted at the DB boundary'
);

select throws_ok(
  $sql$
    select public.save_settings_v1(
      '[{"key":"org.nip","value":{"en":"1234567890"},"visible":true}]'::jsonb
    )
  $sql$,
  '22023',
  null,
  'a NIP with a bad checksum is rejected at the DB boundary'
);

select throws_ok(
  $sql$
    select public.save_settings_v1(
      '[{"key":"org.nip","value":{"en":"783196191"},"visible":true}]'::jsonb
    )
  $sql$,
  '22023',
  null,
  'a NIP with the wrong length is rejected at the DB boundary'
);

select lives_ok(
  $sql$
    select public.save_settings_v1(
      '[{"key":"org.regon","value":{"en":"545503070"},"visible":true}]'::jsonb
    )
  $sql$,
  'a 9-digit REGON with a valid checksum is accepted at the DB boundary'
);

select throws_ok(
  $sql$
    select public.save_settings_v1(
      '[{"key":"org.regon","value":{"en":"123456789"},"visible":true}]'::jsonb
    )
  $sql$,
  '22023',
  null,
  'a REGON with a bad checksum is rejected at the DB boundary'
);

select throws_ok(
  $sql$
    select public.save_settings_v1(
      '[{"key":"org.regon","value":{"en":"54550307"},"visible":true}]'::jsonb
    )
  $sql$,
  '22023',
  null,
  'a REGON with the wrong length is rejected at the DB boundary'
);

select lives_ok(
  $sql$
    select public.save_settings_v1(
      '[{"key":"org.nip","value":{"en":""},"visible":false}]'::jsonb
    )
  $sql$,
  'an empty value remains valid (the explicit "not configured" state)'
);

reset role;

select * from finish();

rollback;
