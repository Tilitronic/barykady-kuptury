-- T-042 re-gate — atomic OAuth state consumption.
--
-- The previous JS flow was SELECT (validate/expiry) then DELETE. Two concurrent
-- callbacks could both observe the row before either deleted it. A single
-- `DELETE ... RETURNING` closes the replay window: PostgreSQL serialises the
-- delete and only one statement can return the owner row.

begin;

create or replace function public.consume_google_oauth_state_v1(p_state text)
returns uuid
language sql
security definer
set search_path = public
as $$
  delete from public.google_oauth_states
   where state = p_state
     and expires_at > now()
  returning user_id;
$$;

comment on function public.consume_google_oauth_state_v1(text) is
  'T-042/D-41: atomically consumes a one-time OAuth state. A replay or expired state returns no row. Service-role only.';

revoke all on function public.consume_google_oauth_state_v1(text)
  from public, anon, authenticated;
grant execute on function public.consume_google_oauth_state_v1(text)
  to service_role;

commit;
