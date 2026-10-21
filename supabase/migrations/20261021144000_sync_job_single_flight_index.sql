-- T-042 S9 — database-enforced single-flight for direct (admin) job inserts.
-- The RPCs already serialise enqueue/claim; this partial unique index closes the
-- remaining race when the admin page inserts a job directly.
begin;

create unique index content_sync_jobs_active_entity_idx
  on public.content_sync_jobs (kind, entity_id)
  where entity_id is not null
    and status in ('queued', 'running');

commit;
