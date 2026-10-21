-- T-042 S9 — stale-while-revalidate + scheduled freshness.
--
-- Design authority (user-approved S9 contract):
--   * the reader renders the stored copy immediately; a lightweight check runs
--     after mount and never blocks the text;
--   * checks are throttled per document (default 15 minutes) and back off after
--     a failed Drive check (exponential, capped);
--   * a changed document starts the SAME S7 pipeline through a single-flight
--     job; a failed sync leaves the published copy untouched;
--   * the nightly scheduled function is the primary freshness mechanism; the
--     manual admin button is only an override.
--
-- SECURITY: the check/job RPCs are SECURITY DEFINER and granted only to
-- service_role. The public `/api/content-check` Netlify binding holds that key
-- server-side; the browser never sees it. No source path or credential is
-- returned by the check RPC.

begin;

alter table public.organization_documents
  add column source_checked_at timestamptz,
  add column source_check_failures integer not null default 0;

alter table public.publications
  add column source_checked_at timestamptz,
  add column source_check_failures integer not null default 0;

alter table public.organization_documents
  add constraint organization_documents_source_check_failures_check
    check (source_check_failures between 0 and 6);

alter table public.publications
  add constraint publications_source_check_failures_check
    check (source_check_failures between 0 and 6);

comment on column public.organization_documents.source_checked_at is
  'Last Drive metadata check (S9). Drives the 15-minute throttle and failure backoff.';
comment on column public.organization_documents.source_check_failures is
  'Consecutive failed Drive checks (0–6); reset on success, used for backoff.';
comment on column public.publications.source_checked_at is
  'Last Drive metadata check (S9); mirrors organization_documents.source_checked_at.';
comment on column public.publications.source_check_failures is
  'Consecutive failed Drive checks (0–6); mirrors organization_documents.source_check_failures.';

-- ---------------------------------------------------------------------------
-- Scheduled run report (admin aggregate)
-- ---------------------------------------------------------------------------

create table public.content_sync_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null,
  finished_at timestamptz,
  checked integer not null default 0,
  updated integer not null default 0,
  failed integer not null default 0,
  skipped integer not null default 0,
  created_at timestamptz not null default now(),
  constraint content_sync_runs_counts_check check (
    checked >= 0 and updated >= 0 and failed >= 0 and skipped >= 0
  )
);

comment on table public.content_sync_runs is
  'T-042 S9 aggregate report for the scheduled Google freshness run.';

alter table public.content_sync_runs enable row level security;

create policy content_sync_runs_select_admin on public.content_sync_runs
  for select to authenticated
  using (public.is_admin());

revoke insert, update, delete, truncate, references, trigger
  on public.content_sync_runs from anon;

-- ---------------------------------------------------------------------------
-- Atomic throttle claim
-- ---------------------------------------------------------------------------

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

  if not found then
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

comment on function public.claim_content_check_v1(text, text, integer) is
  'S9: atomically throttles a public Drive metadata check and returns only safe target metadata. Service-role only.';

create or replace function public.record_content_check_result_v1(
  p_kind text,
  p_entity_id uuid,
  p_success boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table text;
begin
  if p_kind not in ('document', 'publication') then
    raise exception 'invalid content kind' using errcode = '22023';
  end if;
  v_table := case p_kind
    when 'document' then 'organization_documents'
    else 'publications'
  end;

  execute format(
    'update public.%I
        set source_checked_at = now(),
            source_check_failures = case
              when $2 then 0
              else least(source_check_failures + 1, 6)
            end
      where id = $1',
    v_table
  ) using p_entity_id, p_success;
end;
$$;

comment on function public.record_content_check_result_v1(text, uuid, boolean) is
  'S9: resets the failure backoff on a successful check, otherwise increments it. Service-role only.';

-- ---------------------------------------------------------------------------
-- Single-flight enqueue
-- ---------------------------------------------------------------------------

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

  -- The lock is transaction-scoped and only serialises the check+insert; the
  -- long-running export/conversion still runs in a separate background job.
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
    (kind, entity_id, locale, status, request)
  values
    (p_kind, p_entity_id, p_locale, 'queued', p_request)
  returning id into v_job_id;

  return v_job_id;
end;
$$;

comment on function public.enqueue_content_sync_job_v1(text, uuid, public.content_locale, jsonb) is
  'S9: single-flight job enqueue per document; concurrent triggers for the same entity coalesce onto one queued/running job. Service-role only.';

revoke all on function public.claim_content_check_v1(text, text, integer) from public;
revoke all on function public.record_content_check_result_v1(text, uuid, boolean) from public;
revoke all on function public.enqueue_content_sync_job_v1(text, uuid, public.content_locale, jsonb) from public;

grant execute on function public.claim_content_check_v1(text, text, integer)
  to service_role;
grant execute on function public.record_content_check_result_v1(text, uuid, boolean)
  to service_role;
grant execute on function public.enqueue_content_sync_job_v1(
  text, uuid, public.content_locale, jsonb
) to service_role;

commit;
