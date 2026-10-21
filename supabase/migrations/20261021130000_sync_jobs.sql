-- T-042 S8 — Google sync job status.
--
-- The admin starts a background sync and needs a durable status to poll:
-- queued → running → succeeded | unchanged | blocked | failed. The job stores
-- only non-secret request metadata (Drive file id, target entity/locale, title
-- fields) and a small diff summary. Tokens and private keys never enter this
-- table.

begin;

create table public.content_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  entity_id uuid,
  locale public.content_locale not null,
  status text not null default 'queued',
  error_code text,
  summary jsonb,
  request jsonb not null,
  requested_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  constraint content_sync_jobs_kind_check check (kind in ('document', 'publication')),
  constraint content_sync_jobs_status_check check (
    status in ('queued', 'running', 'succeeded', 'unchanged', 'blocked', 'failed')
  ),
  constraint content_sync_jobs_error_code_check check (
    error_code is null or length(btrim(error_code)) > 0
  )
);

comment on table public.content_sync_jobs is
  'T-042 S8 background sync status; admins poll this row while the Netlify background function runs.';
comment on column public.content_sync_jobs.request is
  'Non-secret sync request payload (Drive file id, target entity/locale/title). Never credentials.';
comment on column public.content_sync_jobs.summary is
  'Reader AST diff summary shown before applying a replacement.';

create index content_sync_jobs_created_at_idx
  on public.content_sync_jobs (created_at desc);

create trigger content_sync_jobs_set_updated_at
  before update on public.content_sync_jobs
  for each row execute function public.set_updated_at();

alter table public.content_sync_jobs enable row level security;

create policy content_sync_jobs_select_admin on public.content_sync_jobs
  for select to authenticated
  using (public.is_admin());

create policy content_sync_jobs_insert_admin on public.content_sync_jobs
  for insert to authenticated
  with check (public.is_admin());

create policy content_sync_jobs_update_admin on public.content_sync_jobs
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke insert, update, delete, truncate, references, trigger
  on public.content_sync_jobs from anon;

commit;
