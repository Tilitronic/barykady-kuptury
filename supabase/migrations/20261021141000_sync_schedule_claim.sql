-- T-042 S9 — scheduled single-flight claim.
--
-- The public/manual enqueue returns the existing active job so callers can
-- coalesce. The scheduled runner must instead SKIP when any job is already
-- queued/running, otherwise it would execute the same document concurrently
-- with a manual/public trigger.

begin;

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
    (kind, entity_id, locale, status, request)
  values
    (p_kind, p_entity_id, p_locale, 'queued', p_request)
  returning id into v_job_id;

  return v_job_id;
end;
$$;

comment on function public.claim_scheduled_content_sync_job_v1(
  text, uuid, public.content_locale, jsonb
) is
  'S9: scheduled single-flight claim; returns NULL when a job is already queued/running. Service-role only.';

revoke all on function public.claim_scheduled_content_sync_job_v1(
  text, uuid, public.content_locale, jsonb
) from public;

grant execute on function public.claim_scheduled_content_sync_job_v1(
  text, uuid, public.content_locale, jsonb
) to service_role;

commit;
