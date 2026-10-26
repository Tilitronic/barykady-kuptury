-- T-048 — organization settings store, visibility rule and scoped writes.
--
-- Design authority:
--   * docs/architecture.md §6.1 — new fixed scope `settings:write`; anonymous
--     reads may select ONLY rows with `visible = true`; root and settings
--     editors see every row; values are validated by kind; no credential keys.
--   * docs/architecture.md §6 — authorization lives at the data boundary. Read
--     policies use `is_admin()`/`has_capability('settings:write')`; no write
--     policy exists because the definer RPC is the sole write path.
--   * docs/tickets/T-048-org-settings-visibility.md — one row per fact
--     (`key`, per-locale value JSONB where textual, global `visible`,
--     `updated_by` + timestamp); one transactional save RPC; hidden values
--     must not leak through anonymous payloads.
--   * T-045/T-046 — transactional RPC pattern with a pinned empty search_path
--     and a capability re-check inside the function. Gate fix FIX-1: table
--     INSERT/UPDATE grants are revoked from client roles, so this function is
--     SECURITY DEFINER and is the SOLE write path (invoker rights could not
--     write without the revoked grants).
--
-- Why a global `visible` flag (not per-locale): the ticket explicitly defers
-- per-locale visibility until a product requirement proves it is needed.
--
-- Why the RPC validates keys, locale names and kinds:
--   The table CHECK can only enforce JSONB object shape (PostgreSQL CHECK
--   constraints cannot run subqueries over jsonb_each), so the authoritative
--   guard lives in the function: fixed key vocabulary, en/pl/uk string values,
--   and email/URL/NIP/REGON semantics. This also keeps the store free of
--   credential-like keys.
--
-- Expected RED before this migration: supabase/tests/organization_settings_test.sql
-- fails every assertion (table/function missing).

begin;

-- ---------------------------------------------------------------------------
-- Store
-- ---------------------------------------------------------------------------

create table public.organization_settings (
  key text primary key,
  -- Per-locale textual facts use {"en": "...", "pl": "...", "uk": "..."}.
  -- Scalars (NIP, REGON, emails, URLs, phone) carry the canonical "en" entry.
  value jsonb not null,
  -- Global visibility: hidden rows are invisible to anonymous readers and
  -- render nothing publicly, but remain editable/auditable for admins.
  visible boolean not null default true,
  -- Audit surface (who/when). No FK on purpose: the uuid must survive
  -- administrator removal, and the RPC only ever writes auth.uid().
  updated_by uuid,
  -- Snapshot of the acting administrator's email from the verified JWT, so
  -- the UI can name the actor without a join to auth.users (not exposed via
  -- PostgREST and not readable by client roles).
  updated_by_email text,
  updated_at timestamptz not null default now(),
  constraint organization_settings_value_object_check
    check (jsonb_typeof(value) = 'object'),
  constraint organization_settings_value_not_empty_check
    check (value <> '{}'::jsonb)
);

comment on table public.organization_settings is
  'T-048: one row per organization fact (key), per-locale JSONB value, one '
  'global visible flag, and who/when audit columns. No credentials belong here.';

comment on column public.organization_settings.visible is
  'T-048: anonymous readers may select only visible rows (RLS + explicit '
  'client filter); a hidden fact renders nothing at the public boundary.';

create index organization_settings_visible_idx
  on public.organization_settings (key)
  where visible;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.organization_settings enable row level security;

-- Public projection: only visible rows, for anonymous and authenticated
-- readers. Permissive policies OR together, so an authenticated settings
-- editor also gets the broader admin read below.
create policy organization_settings_select_visible
  on public.organization_settings
  for select to anon, authenticated
  using (visible);

-- Admin/scoped read: all rows, including hidden ones and audit fields.
create policy organization_settings_select_admin
  on public.organization_settings
  for select to authenticated
  using (
    public.is_admin() or public.has_capability('settings:write')
  );

-- Gate fix FIX-1: no INSERT/UPDATE/DELETE policy exists. Client roles have no
-- direct write privilege either; `save_settings_v1` (SECURITY DEFINER) is the
-- sole write path. This is deliberate defence in depth: re-granting a table
-- privilege by mistake would still hit deny-by-default RLS.

revoke all on public.organization_settings from anon, authenticated;
grant select on public.organization_settings to anon, authenticated;
-- service_role keeps its platform-level bypass for server maintenance; no
-- browser role can write or delete audit history directly.

-- ---------------------------------------------------------------------------
-- Gate fix FIX-2 — key-aware kind validation helpers
-- ---------------------------------------------------------------------------
-- The client mirrors these rules to render localized field errors, but a
-- direct RPC caller must not be able to store a malformed fact. Empty is valid
-- for every kind: it is the explicit "not configured" state, and visibility is
-- the separate hide control.
--
-- These helpers are pure and have EXECUTE revoked from client roles; the
-- definer RPC calls them internally.

create or replace function public.is_valid_email_v1(p_value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_value is null or btrim(p_value) = '' then true
    else btrim(p_value) ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  end;
$$;

comment on function public.is_valid_email_v1(text) is
  'T-048 FIX-2: empty or a single @-address with a dotted domain.';

create or replace function public.is_valid_public_url_v1(p_value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_value is null or btrim(p_value) = '' then true
    else length(btrim(p_value)) <= 2048
      and btrim(p_value) ~* '^https?://[^[:space:]/?#]+[^[:space:]]*$'
  end;
$$;

comment on function public.is_valid_public_url_v1(text) is
  'T-048 FIX-2: empty or an absolute http(s) URL (never javascript:/data:/relative).';

create or replace function public.is_valid_nip_v1(p_value text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_digits text := btrim(coalesce(p_value, ''));
  v_sum integer;
  v_checksum integer;
begin
  if v_digits = '' then
    return true;
  end if;
  if v_digits !~ '^[0-9]{10}$' then
    return false;
  end if;

  v_sum :=
      6 * substr(v_digits, 1, 1)::integer
    + 5 * substr(v_digits, 2, 1)::integer
    + 7 * substr(v_digits, 3, 1)::integer
    + 2 * substr(v_digits, 4, 1)::integer
    + 3 * substr(v_digits, 5, 1)::integer
    + 4 * substr(v_digits, 6, 1)::integer
    + 5 * substr(v_digits, 7, 1)::integer
    + 6 * substr(v_digits, 8, 1)::integer
    + 7 * substr(v_digits, 9, 1)::integer;
  v_checksum := v_sum % 11;

  return v_checksum <> 10
    and v_checksum = substr(v_digits, 10, 1)::integer;
end;
$$;

comment on function public.is_valid_nip_v1(text) is
  'T-048 FIX-2: empty or a 10-digit NIP with the Polish checksum.';

create or replace function public.is_valid_regon_v1(p_value text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_digits text := btrim(coalesce(p_value, ''));
  v_sum integer;
  v_checksum integer;
begin
  if v_digits = '' then
    return true;
  end if;

  if v_digits ~ '^[0-9]{9}$' then
    v_sum :=
        8 * substr(v_digits, 1, 1)::integer
      + 9 * substr(v_digits, 2, 1)::integer
      + 2 * substr(v_digits, 3, 1)::integer
      + 3 * substr(v_digits, 4, 1)::integer
      + 4 * substr(v_digits, 5, 1)::integer
      + 5 * substr(v_digits, 6, 1)::integer
      + 6 * substr(v_digits, 7, 1)::integer
      + 7 * substr(v_digits, 8, 1)::integer;
    v_checksum := v_sum % 11;
    if v_checksum = 10 then
      v_checksum := 0;
    end if;
    return v_checksum = substr(v_digits, 9, 1)::integer;
  end if;

  if v_digits ~ '^[0-9]{14}$' then
    v_sum :=
        2 * substr(v_digits, 1, 1)::integer
      + 4 * substr(v_digits, 2, 1)::integer
      + 8 * substr(v_digits, 3, 1)::integer
      + 5 * substr(v_digits, 4, 1)::integer
      + 0 * substr(v_digits, 5, 1)::integer
      + 9 * substr(v_digits, 6, 1)::integer
      + 7 * substr(v_digits, 7, 1)::integer
      + 3 * substr(v_digits, 8, 1)::integer
      + 6 * substr(v_digits, 9, 1)::integer
      + 1 * substr(v_digits, 10, 1)::integer
      + 2 * substr(v_digits, 11, 1)::integer
      + 4 * substr(v_digits, 12, 1)::integer
      + 8 * substr(v_digits, 13, 1)::integer;
    v_checksum := v_sum % 11;
    if v_checksum = 10 then
      v_checksum := 0;
    end if;
    return v_checksum = substr(v_digits, 14, 1)::integer;
  end if;

  return false;
end;
$$;

comment on function public.is_valid_regon_v1(text) is
  'T-048 FIX-2: empty or a 9/14-digit REGON with the Polish checksum.';

create or replace function public.validate_organization_setting_v1(
  p_key text,
  p_value jsonb
)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_entry record;
begin
  if p_value is null
     or jsonb_typeof(p_value) <> 'object'
     or p_value = '{}'::jsonb then
    raise exception 'value for % must be a non-empty JSON object', p_key
      using errcode = '22023';
  end if;

  if exists (
    select 1
      from jsonb_each(p_value) as entry(locale, text_value)
     where entry.locale not in ('en', 'pl', 'uk')
        or jsonb_typeof(entry.text_value) <> 'string'
  ) then
    raise exception 'value for % may only contain en/pl/uk string entries', p_key
      using errcode = '22023';
  end if;

  for v_entry in
    select value from jsonb_each_text(p_value)
  loop
    if v_entry.value = '' then
      continue;
    end if;

    case p_key
      when 'org.nip' then
        if not public.is_valid_nip_v1(v_entry.value) then
          raise exception 'invalid NIP for %', p_key
            using errcode = '22023';
        end if;
      when 'org.regon' then
        if not public.is_valid_regon_v1(v_entry.value) then
          raise exception 'invalid REGON for %', p_key
            using errcode = '22023';
        end if;
      when 'contact.email' then
        if not public.is_valid_email_v1(v_entry.value) then
          raise exception 'invalid email address for %', p_key
            using errcode = '22023';
        end if;
      when 'org.privacy_url' then
        if not public.is_valid_public_url_v1(v_entry.value) then
          raise exception 'invalid URL for %', p_key
            using errcode = '22023';
        end if;
      else
        if p_key like 'social.%'
           and not public.is_valid_public_url_v1(v_entry.value) then
          raise exception 'invalid social URL for %', p_key
            using errcode = '22023';
        end if;
    end case;
  end loop;
end;
$$;

comment on function public.validate_organization_setting_v1(text, jsonb) is
  'T-048 FIX-2: key-aware kind validation for one settings value; raises 22023 '
  'for malformed email/URL/NIP/REGON and invalid locale shapes.';

revoke all on function public.is_valid_email_v1(text) from public;
revoke all on function public.is_valid_public_url_v1(text) from public;
revoke all on function public.is_valid_nip_v1(text) from public;
revoke all on function public.is_valid_regon_v1(text) from public;
revoke all on function public.validate_organization_setting_v1(text, jsonb)
  from public;

-- ---------------------------------------------------------------------------
-- save_settings_v1 — one transactional change set
-- ---------------------------------------------------------------------------
-- p_changes shape (the admin always sends the complete definition set for the
-- edited tab):
--   [{"key":"contact.email","value":{"en":"…"},"visible":true}, …]
--
-- All-or-nothing: any invalid entry raises, and because the whole function is
-- one statement the earlier upserts roll back with it.

create or replace function public.save_settings_v1(p_changes jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry jsonb;
  v_key text;
  v_value jsonb;
  v_visible boolean;
  v_actor uuid := auth.uid();
  v_actor_email text := nullif(auth.jwt() ->> 'email', '');
begin
  if not (
    public.is_admin() or public.has_capability('settings:write')
  ) then
    raise exception 'settings:write capability required'
      using errcode = '42501',
            hint = 'Caller must be root or carry app_metadata.scopes with settings:write.';
  end if;

  if p_changes is null or jsonb_typeof(p_changes) <> 'array' then
    raise exception 'p_changes must be a JSON array'
      using errcode = '22023';
  end if;

  if jsonb_array_length(p_changes) = 0 then
    raise exception 'p_changes must not be empty'
      using errcode = '22023';
  end if;

  for v_entry in
    select value from jsonb_array_elements(p_changes)
  loop
    if jsonb_typeof(v_entry) <> 'object' then
      raise exception 'each change must be a JSON object'
        using errcode = '22023';
    end if;

    v_key := v_entry ->> 'key';
    v_value := v_entry -> 'value';

    if v_key is null
       or v_key not in (
         'org.name',
         'org.seat',
         'org.nip',
         'org.regon',
         'org.privacy_url',
         'contact.email',
         'contact.phone',
         'contact.address',
         'contact.office_hours',
         'contact.paper_mail_address',
         'social.facebook',
         'social.instagram',
         'social.telegram',
         'social.youtube',
         'social.twitter',
         'social.linkedin'
       ) then
      raise exception 'unknown organization setting key: %', coalesce(v_key, '<null>')
        using errcode = '22023';
    end if;

    -- Shape + key-aware kind validation (FIX-2) live in one reusable
    -- function so the invariants cannot drift between the RPC and its tests.
    perform public.validate_organization_setting_v1(v_key, v_value);

    if v_entry ? 'visible'
       and jsonb_typeof(v_entry -> 'visible') <> 'boolean' then
      raise exception 'visible for % must be a JSON boolean', v_key
        using errcode = '22023';
    end if;

    v_visible := coalesce((v_entry ->> 'visible')::boolean, true);

    insert into public.organization_settings (
      key, value, visible, updated_by, updated_by_email, updated_at
    )
    values (
      v_key, v_value, v_visible, v_actor, v_actor_email, now()
    )
    on conflict (key) do update
      set value = excluded.value,
          visible = excluded.visible,
          updated_by = excluded.updated_by,
          updated_by_email = excluded.updated_by_email,
          updated_at = excluded.updated_at;
  end loop;

  -- Provisioning marker: presence means the table is authoritative even when
  -- every editable fact is hidden. It is never rendered and never editable.
  insert into public.organization_settings (
    key, value, visible, updated_by, updated_by_email, updated_at
  )
  values (
    'org.settings_initialized', '{"en":"1"}'::jsonb, true,
    v_actor, v_actor_email, now()
  )
  on conflict (key) do nothing;
end;
$$;

comment on function public.save_settings_v1(jsonb) is
  'T-048: the SOLE organization-settings write path. SECURITY DEFINER (client '
  'table write grants are revoked), pinned search_path, re-checks is_admin() '
  'OR has_capability(''settings:write''), validates the fixed key vocabulary, '
  'en/pl/uk string values and key-aware email/URL/NIP/REGON kinds, stamps '
  'updated_by + updated_at, and provisions the sentinel marker.';

revoke all on function public.save_settings_v1(jsonb) from public;
grant execute on function public.save_settings_v1(jsonb) to authenticated;

commit;
