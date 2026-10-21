-- T-042 S9 hotfix — EXECUTE does not set PL/pgSQL FOUND, so the original
-- claim function always reported not-found. Check the selected record instead.
begin;

create or replace function public.claim_content_check_v1(
  p_kind text,
  p_slug text,
  p_base_interval_minutes integer default 15
)
returns table (
  outcome text,
  entity_id uuid,
  file_id text,
  locale public.content_locale,
  source_synced_at timestamptz,
  source_modified_at timestamptz,
  source_url text,
  allow_original_download boolean,
  status public.content_status,
  check_failures integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table text;
  v_row record;
  v_interval interval;
begin
  if p_kind not in ('document', 'publication') then
    raise exception 'invalid content kind' using errcode = '22023';
  end if;
  if p_base_interval_minutes < 1 then
    raise exception 'interval must be positive' using errcode = '22023';
  end if;

  v_table := case p_kind
    when 'document' then 'organization_documents'
    else 'publications'
  end;

  execute format(
    'select id, status, source_provider, source_external_id, source_synced_at,
            source_modified_at, source_url, allow_original_download, language,
            source_checked_at, source_check_failures
       from public.%I
      where slug = $1
      limit 1',
    v_table
  ) into v_row using p_slug;

  if v_row.id is null then
    return query select 'not-found'::text, null::uuid, null::text,
      null::public.content_locale, null::timestamptz, null::timestamptz,
      null::text, null::boolean, null::public.content_status, null::integer;
    return;
  end if;

  if v_row.source_provider <> 'google_doc'
     or nullif(btrim(coalesce(v_row.source_external_id, '')), '') is null
     or v_row.status <> 'published' then
    return query select 'not-google'::text, null::uuid, null::text,
      null::public.content_locale, null::timestamptz, null::timestamptz,
      null::text, null::boolean, null::public.content_status, null::integer;
    return;
  end if;

  v_interval := make_interval(
    mins => p_base_interval_minutes * (2 ^ least(v_row.source_check_failures, 6))::integer
  );

  if v_row.source_checked_at is not null
     and v_row.source_checked_at > now() - v_interval then
    return query select 'throttled'::text, v_row.id, v_row.source_external_id,
      v_row.language, v_row.source_synced_at, v_row.source_modified_at,
      v_row.source_url, v_row.allow_original_download, v_row.status,
      v_row.source_check_failures;
    return;
  end if;

  execute format(
    'update public.%I set source_checked_at = now() where id = $1',
    v_table
  ) using v_row.id;

  return query select 'checked'::text, v_row.id, v_row.source_external_id,
    v_row.language, v_row.source_synced_at, v_row.source_modified_at,
    v_row.source_url, v_row.allow_original_download, v_row.status,
    v_row.source_check_failures;
end;
$$;


revoke all on function public.claim_content_check_v1(text, text, integer) from public;
grant execute on function public.claim_content_check_v1(text, text, integer)
  to service_role;

commit;
