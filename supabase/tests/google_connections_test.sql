-- D-41 — per-admin Google connection vault (pgTAP).
--
-- Design authority:
--   * docs/tickets/DECISIONS.md D-41 — per-admin OAuth constrained to the one
--     shared NGO Drive folder; tokens never reach the browser.
--   * knowledge/ana002-admin-access-model-report.md §7 ADR-A — refresh tokens
--     live in a service-role-only vault, encrypted at rest.
--   * docs/architecture.md §6 — server-only secrets, deny-by-default.
--
-- The vault row is readable by its own admin (metadata only) under RLS. The
-- ciphertext column is service-role-only. No authenticated insert/update/delete
-- path exists: connect/disconnect/consent changes are server functions.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

insert into auth.users (id, instance_id, aud, role, email)
values
  ('b0410000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'vault-owner@example.org'),
  ('b0410000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'vault-other@example.org');

insert into public.google_connections
  (user_id, google_email, refresh_token_ciphertext, scope, consent_status)
values
  ('b0410000-0000-4000-8000-000000000001', 'vault-owner@example.org',
   'v1.ciphertext', 'https://www.googleapis.com/auth/drive.file', 'connected');

insert into public.google_oauth_states (state, user_id, expires_at)
values
  ('state-fixture-0123456789abcdef', 'b0410000-0000-4000-8000-000000000001', now() + interval '10 minutes');

select plan(11);

-- The raw vault is invisible to anonymous callers.
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok(
  $sql$ select count(*) from public.google_connections $sql$,
  '42501', null, 'anon has no access to the token vault');
reset role;

-- An admin sees only their own connection, and never the ciphertext column.
select set_config(
  'request.jwt.claims',
  '{"sub":"b0410000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"admin"}}',
  true);
set local role authenticated;
select is(
  (select count(*) from public.google_connections
    where user_id = 'b0410000-0000-4000-8000-000000000001'),
  1::bigint, 'admin reads own connection row');
select is(
  (select google_email from public.google_connections
    where user_id = 'b0410000-0000-4000-8000-000000000001'),
  'vault-owner@example.org', 'admin reads own connection metadata');
select is(
  (select count(*) from public.google_connections
    where user_id = 'b0410000-0000-4000-8000-000000000002'),
  0::bigint, 'admin cannot read another admin connection');
select throws_ok(
  $sql$ select refresh_token_ciphertext from public.google_connections $sql$,
  '42501', null, 'the ciphertext column is service-role-only');
select throws_ok(
  $sql$ insert into public.google_connections
         (user_id, refresh_token_ciphertext) values
         ('b0410000-0000-4000-8000-000000000001', 'client-supplied') $sql$,
  '42501', null, 'clients cannot insert a token');
select throws_ok(
  $sql$ update public.google_connections set consent_status = 'connected' $sql$,
  '42501', null, 'clients cannot update a token row');
select throws_ok(
  $sql$ delete from public.google_connections $sql$,
  '42501', null, 'clients cannot delete a token row');
reset role;

-- The service role is the only reader of the encrypted column.
set local role service_role;
select is(
  (select refresh_token_ciphertext from public.google_connections
    where user_id = 'b0410000-0000-4000-8000-000000000001'),
  'v1.ciphertext', 'service role reads the encrypted envelope');
reset role;

-- OAuth state rows are opaque server-only handshakes.
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok(
  $sql$ select count(*) from public.google_oauth_states $sql$,
  '42501', null, 'anon cannot read oauth state rows');
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"b0410000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"admin"}}',
  true);
set local role authenticated;
select throws_ok(
  $sql$ select count(*) from public.google_oauth_states $sql$,
  '42501', null, 'admins cannot read oauth state rows');
reset role;

select * from finish();
rollback;
