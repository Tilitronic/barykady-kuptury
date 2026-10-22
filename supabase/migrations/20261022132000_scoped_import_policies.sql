-- T-046 — scoped import/sync policies (D-42).
--
-- Design authority:
--   * docs/architecture.md §6.1 — the `importer` capability is the eighth V1
--     scope. It gates the import/sync status surface (the background function's
--     DB-side gate is T-042's lane; this migration owns RLS only).
--   * D-21 / D-42 — root keeps bypass; a zero-scope account sees nothing.
--
-- Why `importer` has no `:write` suffix:
--   It is an action-scope (performing an import), not a content table. This
--   matches the ana002 recommended-flow diagram (`['publications:write',
--   'importer']`). The report's `{...}:write` shorthand is descriptive for the
--   seven table scopes; forcing `importer:write` would create a second name for
--   the same grant and a runbook trap.

begin;

drop policy content_sync_jobs_select_admin on public.content_sync_jobs;
drop policy content_sync_jobs_insert_admin on public.content_sync_jobs;
drop policy content_sync_jobs_update_admin on public.content_sync_jobs;

create policy content_sync_jobs_select_admin on public.content_sync_jobs
  for select to authenticated
  using (public.is_admin() or public.has_capability('importer'));
create policy content_sync_jobs_insert_admin on public.content_sync_jobs
  for insert to authenticated
  with check (public.is_admin() or public.has_capability('importer'));
create policy content_sync_jobs_update_admin on public.content_sync_jobs
  for update to authenticated
  using (public.is_admin() or public.has_capability('importer'))
  with check (public.is_admin() or public.has_capability('importer'));

drop policy content_sync_runs_select_admin on public.content_sync_runs;

create policy content_sync_runs_select_admin on public.content_sync_runs
  for select to authenticated
  using (public.is_admin() or public.has_capability('importer'));

commit;
