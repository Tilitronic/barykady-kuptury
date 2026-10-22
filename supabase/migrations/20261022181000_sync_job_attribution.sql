-- T-042 review fix — content_sync_jobs.requested_by on every sync path.
--
-- D-41 makes the acting admin the token owner. Paths:
--   * manual admin insert — the browser sets requested_by from its session;
--   * public content-check enqueue — inherits the link owner from the latest
--     attributed job for the same entity;
--   * scheduled claim — inherits the same link owner.
--
-- The column already existed but was dead. This migration makes the two SECURITY
-- DEFINER enqueue paths carry attribution without changing their signatures, so
-- existing callers keep working.

begin;

create index if not exists content_sync_jobs_entity_created_idx
  on public.content_sync_jobs (kind, entity_id, created_at desc);

create or replace function public.enqueue_content_sync_job_v1(
  p_kind text,
  p_entity_id uuid,
  p_locale public.content_locale,
  p_request jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_id uuid;
begin
  if p_kind not in ('document', 'publication') then
    raise exception 'invalid content kind' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_entity_id::text, 0));

  select id into v_job_id
    from public.content_sync_jobs
   where kind = p_kind
     and entity_id = p_entity_id
     and status in ('queued', 'running')
   limit 1;

  if v_job_id is not null then
    return v_job_id;
  end if;

  insert into public.content_sync_jobs
    (kind, entity_id, locale, status, request, requested_by)
  values
    (p_kind, p_entity_id, p_locale, 'queued', p_request,
     (select requested_by
        from public.content_sync_jobs
       where kind = p_kind
         and entity_id = p_entity_id
         and requested_by is not null
       order by created_at desc
       limit 1))
  returning id into v_job_id;

  return v_job_id;
end;
$$;

create or replace function public.claim_scheduled_content_sync_job_v1(
  p_kind text,
  p_entity_id uuid,
  p_locale public.content_locale,
  p_request jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_id uuid;
begin
  if p_kind not in ('document', 'publication') then
    raise exception 'invalid content kind' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_entity_id::text, 0));

  if exists (
    select 1
      from public.content_sync_jobs
     where kind = p_kind
       and entity_id = p_entity_id
       and status in ('queued', 'running')
  ) then
    return null;
  end if;

  insert into public.content_sync_jobs
    (kind, entity_id, locale, status, request, requested_by)
  values
    (p_kind, p_entity_id, p_locale, 'queued', p_request,
     (select requested_by
        from public.content_sync_jobs
       where kind = p_kind
         and entity_id = p_entity_id
         and requested_by is not null
       order by created_at desc
       limit 1))
  returning id into v_job_id;

  return v_job_id;
end;
$$;

comment on function public.enqueue_content_sync_job_v1(
  text, uuid, public.content_locale, jsonb
) is
  'S9: single-flight job enqueue per document; inherits the link-owner requested_by. Service-role only.';

comment on function public.claim_scheduled_content_sync_job_v1(
  text, uuid, public.content_locale, jsonb
) is
  'S9: scheduled single-flight claim; inherits the link-owner requested_by. Service-role only.';

revoke all on function public.enqueue_content_sync_job_v1(
  text, uuid, public.content_locale, jsonb
) from public;
revoke all on function public.claim_scheduled_content_sync_job_v1(
  text, uuid, public.content_locale, jsonb
) from public;

grant execute on function public.enqueue_content_sync_job_v1(
  text, uuid, public.content_locale, jsonb
) to service_role;
grant execute on function public.claim_scheduled_content_sync_job_v1(
  text, uuid, public.content_locale, jsonb
) to service_role;

commit;
