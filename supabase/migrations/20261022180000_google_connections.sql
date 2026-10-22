-- D-41 — per-admin Google connection vault.
--
-- Design authority:
--   * docs/tickets/DECISIONS.md D-41 — admins connect with their own Google
--     profiles; imports are constrained to the single shared NGO Drive folder.
--   * knowledge/ana002-admin-access-model-report.md §7 ADR-A — refresh tokens
--     live in a service-role-only table, encrypted at rest.
--   * docs/architecture.md §6 — secrets stay server-side; deny-by-default.
--
-- The admin can read their own connection *metadata* through RLS. The encrypted
-- refresh-token column is deliberately not granted to `authenticated`: only the
-- service role (Netlify functions) can decrypt a token. There is no client
-- insert/update/delete path; connect/re-consent/disconnect are server actions.

begin;

create table public.google_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  google_email text,
  refresh_token_ciphertext text not null,
  token_format text not null default 'aes-256-gcm-v1',
  scope text not null default 'https://www.googleapis.com/auth/drive.file',
  consent_status text not null default 'connected',
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  constraint google_connections_ciphertext_check check (
    length(btrim(refresh_token_ciphertext)) > 0
  ),
  constraint google_connections_consent_status_check check (
    consent_status in ('connected', 'reconsent_required')
  )
);

comment on table public.google_connections is
  'D-41 per-admin Google OAuth vault. One row per admin; tokens are AES-GCM encrypted and service-role-only.';
comment on column public.google_connections.refresh_token_ciphertext is
  'Opaque v1 envelope (AES-256-GCM). The data key lives in the Netlify env and never reaches the browser.';
comment on column public.google_connections.consent_status is
  'A revoked/invalid grant flips to reconsent_required; the sync pipeline keeps the last published copy.';
comment on column public.google_connections.scope is
  'Least-privilege drive.file only; restricted Drive scopes are never requested (D-41).';

create trigger google_connections_set_updated_at
  before update on public.google_connections
  for each row execute function public.set_updated_at();

create table public.google_oauth_states (
  state text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint google_oauth_states_state_check check (length(state) >= 20),
  constraint google_oauth_states_expiry_check check (expires_at > created_at)
);

comment on table public.google_oauth_states is
  'D-41 short-lived OAuth CSRF state. Service-role-only; consumed exactly once by the callback.';

create index google_oauth_states_expires_at_idx
  on public.google_oauth_states (expires_at);

alter table public.google_connections enable row level security;
alter table public.google_oauth_states enable row level security;

-- An admin may read only their own connection metadata. No write policies:
-- self-granting or self-revoking a token is unrepresentable.
create policy google_connections_select_own on public.google_connections
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Column-level grant: the ciphertext is never part of an authenticated SELECT.
revoke all on public.google_connections from anon, authenticated;
grant select (
  user_id,
  google_email,
  token_format,
  scope,
  consent_status,
  connected_at,
  updated_at,
  last_used_at,
  revoked_at
) on public.google_connections to authenticated;

-- OAuth states have no authenticated policy at all.
revoke all on public.google_oauth_states from anon, authenticated;

-- Explicit so the vault works regardless of project default privileges.
grant select, insert, update, delete on public.google_connections to service_role;
grant select, insert, update, delete on public.google_oauth_states to service_role;

commit;
