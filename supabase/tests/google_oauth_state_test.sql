-- T-042 re-gate — atomic OAuth state consumption (pgTAP).
--
-- Proof obligations:
--   * a valid state returns its owner exactly once;
--   * a replay of the same state returns no row;
--   * an expired state returns no row and is deleted/ignored;
--   * anonymous/authenticated roles cannot execute the service-role RPC.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

insert into auth.users (id, instance_id, aud, role, email)
values
  ('b0430000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'oauth-state@example.org');

insert into public.google_oauth_states (state, user_id, created_at, expires_at)
values
  ('state-valid-0123456789abcdef', 'b0430000-0000-4000-8000-000000000001',
   now(), now() + interval '10 minutes'),
  -- Legacy expired row: created in the past so the table's expires_at >
  -- created_at invariant still holds.
  ('state-expired-0123456789abcdef', 'b0430000-0000-4000-8000-000000000001',
   now() - interval '2 hours', now() - interval '1 hour');

select plan(6);

select is(
  public.consume_google_oauth_state_v1('state-valid-0123456789abcdef'),
  'b0430000-0000-4000-8000-000000000001'::uuid,
  'valid state returns its owner once');

select is(
  public.consume_google_oauth_state_v1('state-valid-0123456789abcdef'),
  null::uuid,
  'replaying the same state returns no row');

select is(
  public.consume_google_oauth_state_v1('state-expired-0123456789abcdef'),
  null::uuid,
  'expired state returns no row');

select is(
  (select count(*) from public.google_oauth_states
    where state = 'state-valid-0123456789abcdef'),
  0::bigint,
  'the consumed state row is gone');

select ok(
  not has_function_privilege(
    'anon',
    'public.consume_google_oauth_state_v1(text)',
    'EXECUTE'
  ),
  'anon has no execute privilege on the state RPC');

select set_config(
  'request.jwt.claims',
  '{"sub":"b0430000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"admin"}}',
  true);
set local role authenticated;
select throws_ok(
  $sql$ select public.consume_google_oauth_state_v1('state-valid-0123456789abcdef') $sql$,
  '42501', null, 'even an admin JWT cannot consume server-only OAuth state');
reset role;

select * from finish();
rollback;
