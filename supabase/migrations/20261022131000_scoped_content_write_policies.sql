-- T-046 — scoped content-table policies (D-42).
--
-- Design authority:
--   * docs/architecture.md §6.1 — every scoped table's admin opening becomes
--     `public.is_admin() OR public.has_capability('<feature>:write')`. Root
--     (`role='admin'`) keeps full bypass; a scoped editor gets exactly their
--     feature. The matching SELECT policy uses the same predicate so an editor
--     can read their own drafts without gaining another area's drafts.
--   * docs/architecture.md §6 — RLS is the authorization boundary; grants are
--     server-side only. No policy reads user_metadata.
--   * D-21 — deny-by-default: no scopes means no write, and no draft read
--     beyond the public published policy.
--   * ana002 ADR-B — delete is intentionally the same capability as write in
--     V1; a finer `:delete` split can be added later because every predicate
--     is one greppable helper call.
--
-- Why the policy NAMES are unchanged (`*_admin`):
--   They remain the "admin opening" (root or scoped), not a public opening.
--   Renaming them would churn every pgTAP assertion without changing the
--   contract; the comment above each block records the exact scope.
--
-- Read changes are deliberate, not a widening of public access: the existing
-- `*_select_published` policies still gate anonymous reads. Only authenticated
-- holders of the matching scope gain the draft-read branch that their editor
-- needs. Out-of-scope scopes cannot read another table's drafts.

begin;

-- ---------------------------------------------------------------------------
-- pages:write — site pages and their translations
-- ---------------------------------------------------------------------------

drop policy site_pages_select_admin on public.site_pages;
drop policy site_pages_insert_admin on public.site_pages;
drop policy site_pages_update_admin on public.site_pages;
drop policy site_pages_delete_admin on public.site_pages;

create policy site_pages_select_admin on public.site_pages
  for select to authenticated
  using (public.is_admin() or public.has_capability('pages:write'));
create policy site_pages_insert_admin on public.site_pages
  for insert to authenticated
  with check (public.is_admin() or public.has_capability('pages:write'));
create policy site_pages_update_admin on public.site_pages
  for update to authenticated
  using (public.is_admin() or public.has_capability('pages:write'))
  with check (public.is_admin() or public.has_capability('pages:write'));
create policy site_pages_delete_admin on public.site_pages
  for delete to authenticated
  using (public.is_admin() or public.has_capability('pages:write'));

drop policy site_page_translations_select_admin on public.site_page_translations;
drop policy site_page_translations_insert_admin on public.site_page_translations;
drop policy site_page_translations_update_admin on public.site_page_translations;
drop policy site_page_translations_delete_admin on public.site_page_translations;

create policy site_page_translations_select_admin on public.site_page_translations
  for select to authenticated
  using (public.is_admin() or public.has_capability('pages:write'));
create policy site_page_translations_insert_admin on public.site_page_translations
  for insert to authenticated
  with check (public.is_admin() or public.has_capability('pages:write'));
create policy site_page_translations_update_admin on public.site_page_translations
  for update to authenticated
  using (public.is_admin() or public.has_capability('pages:write'))
  with check (public.is_admin() or public.has_capability('pages:write'));
create policy site_page_translations_delete_admin on public.site_page_translations
  for delete to authenticated
  using (public.is_admin() or public.has_capability('pages:write'));

-- ---------------------------------------------------------------------------
-- projects:write — projects and their translations (T-045 RPCs re-check too)
-- ---------------------------------------------------------------------------

drop policy projects_select_admin on public.projects;
drop policy projects_insert_admin on public.projects;
drop policy projects_update_admin on public.projects;
drop policy projects_delete_admin on public.projects;

create policy projects_select_admin on public.projects
  for select to authenticated
  using (public.is_admin() or public.has_capability('projects:write'));
create policy projects_insert_admin on public.projects
  for insert to authenticated
  with check (public.is_admin() or public.has_capability('projects:write'));
create policy projects_update_admin on public.projects
  for update to authenticated
  using (public.is_admin() or public.has_capability('projects:write'))
  with check (public.is_admin() or public.has_capability('projects:write'));
create policy projects_delete_admin on public.projects
  for delete to authenticated
  using (public.is_admin() or public.has_capability('projects:write'));

drop policy project_translations_select_admin on public.project_translations;
drop policy project_translations_insert_admin on public.project_translations;
drop policy project_translations_update_admin on public.project_translations;
drop policy project_translations_delete_admin on public.project_translations;

create policy project_translations_select_admin on public.project_translations
  for select to authenticated
  using (public.is_admin() or public.has_capability('projects:write'));
create policy project_translations_insert_admin on public.project_translations
  for insert to authenticated
  with check (public.is_admin() or public.has_capability('projects:write'));
create policy project_translations_update_admin on public.project_translations
  for update to authenticated
  using (public.is_admin() or public.has_capability('projects:write'))
  with check (public.is_admin() or public.has_capability('projects:write'));
create policy project_translations_delete_admin on public.project_translations
  for delete to authenticated
  using (public.is_admin() or public.has_capability('projects:write'));

-- ---------------------------------------------------------------------------
-- team:write — team members and their translations
-- ---------------------------------------------------------------------------

drop policy team_members_select_admin on public.team_members;
drop policy team_members_insert_admin on public.team_members;
drop policy team_members_update_admin on public.team_members;
drop policy team_members_delete_admin on public.team_members;

create policy team_members_select_admin on public.team_members
  for select to authenticated
  using (public.is_admin() or public.has_capability('team:write'));
create policy team_members_insert_admin on public.team_members
  for insert to authenticated
  with check (public.is_admin() or public.has_capability('team:write'));
create policy team_members_update_admin on public.team_members
  for update to authenticated
  using (public.is_admin() or public.has_capability('team:write'))
  with check (public.is_admin() or public.has_capability('team:write'));
create policy team_members_delete_admin on public.team_members
  for delete to authenticated
  using (public.is_admin() or public.has_capability('team:write'));

drop policy team_member_translations_select_admin on public.team_member_translations;
drop policy team_member_translations_insert_admin on public.team_member_translations;
drop policy team_member_translations_update_admin on public.team_member_translations;
drop policy team_member_translations_delete_admin on public.team_member_translations;

create policy team_member_translations_select_admin on public.team_member_translations
  for select to authenticated
  using (public.is_admin() or public.has_capability('team:write'));
create policy team_member_translations_insert_admin on public.team_member_translations
  for insert to authenticated
  with check (public.is_admin() or public.has_capability('team:write'));
create policy team_member_translations_update_admin on public.team_member_translations
  for update to authenticated
  using (public.is_admin() or public.has_capability('team:write'))
  with check (public.is_admin() or public.has_capability('team:write'));
create policy team_member_translations_delete_admin on public.team_member_translations
  for delete to authenticated
  using (public.is_admin() or public.has_capability('team:write'));

-- ---------------------------------------------------------------------------
-- publications:write — publications, translations and files
-- ---------------------------------------------------------------------------

drop policy publications_select_admin on public.publications;
drop policy publications_insert_admin on public.publications;
drop policy publications_update_admin on public.publications;
drop policy publications_delete_admin on public.publications;

create policy publications_select_admin on public.publications
  for select to authenticated
  using (public.is_admin() or public.has_capability('publications:write'));
create policy publications_insert_admin on public.publications
  for insert to authenticated
  with check (public.is_admin() or public.has_capability('publications:write'));
create policy publications_update_admin on public.publications
  for update to authenticated
  using (public.is_admin() or public.has_capability('publications:write'))
  with check (public.is_admin() or public.has_capability('publications:write'));
create policy publications_delete_admin on public.publications
  for delete to authenticated
  using (public.is_admin() or public.has_capability('publications:write'));

drop policy publication_translations_select_admin on public.publication_translations;
drop policy publication_translations_insert_admin on public.publication_translations;
drop policy publication_translations_update_admin on public.publication_translations;
drop policy publication_translations_delete_admin on public.publication_translations;

create policy publication_translations_select_admin on public.publication_translations
  for select to authenticated
  using (public.is_admin() or public.has_capability('publications:write'));
create policy publication_translations_insert_admin on public.publication_translations
  for insert to authenticated
  with check (public.is_admin() or public.has_capability('publications:write'));
create policy publication_translations_update_admin on public.publication_translations
  for update to authenticated
  using (public.is_admin() or public.has_capability('publications:write'))
  with check (public.is_admin() or public.has_capability('publications:write'));
create policy publication_translations_delete_admin on public.publication_translations
  for delete to authenticated
  using (public.is_admin() or public.has_capability('publications:write'));

drop policy publication_files_select_admin on public.publication_files;
drop policy publication_files_insert_admin on public.publication_files;
drop policy publication_files_update_admin on public.publication_files;
drop policy publication_files_delete_admin on public.publication_files;

create policy publication_files_select_admin on public.publication_files
  for select to authenticated
  using (public.is_admin() or public.has_capability('publications:write'));
create policy publication_files_insert_admin on public.publication_files
  for insert to authenticated
  with check (public.is_admin() or public.has_capability('publications:write'));
create policy publication_files_update_admin on public.publication_files
  for update to authenticated
  using (public.is_admin() or public.has_capability('publications:write'))
  with check (public.is_admin() or public.has_capability('publications:write'));
create policy publication_files_delete_admin on public.publication_files
  for delete to authenticated
  using (public.is_admin() or public.has_capability('publications:write'));

-- ---------------------------------------------------------------------------
-- documents:write — organization documents and their translations
-- ---------------------------------------------------------------------------

drop policy organization_documents_select_admin on public.organization_documents;
drop policy organization_documents_insert_admin on public.organization_documents;
drop policy organization_documents_update_admin on public.organization_documents;
drop policy organization_documents_delete_admin on public.organization_documents;

create policy organization_documents_select_admin on public.organization_documents
  for select to authenticated
  using (public.is_admin() or public.has_capability('documents:write'));
create policy organization_documents_insert_admin on public.organization_documents
  for insert to authenticated
  with check (public.is_admin() or public.has_capability('documents:write'));
create policy organization_documents_update_admin on public.organization_documents
  for update to authenticated
  using (public.is_admin() or public.has_capability('documents:write'))
  with check (public.is_admin() or public.has_capability('documents:write'));
create policy organization_documents_delete_admin on public.organization_documents
  for delete to authenticated
  using (public.is_admin() or public.has_capability('documents:write'));

drop policy organization_document_translations_select_admin on public.organization_document_translations;
drop policy organization_document_translations_insert_admin on public.organization_document_translations;
drop policy organization_document_translations_update_admin on public.organization_document_translations;
drop policy organization_document_translations_delete_admin on public.organization_document_translations;

create policy organization_document_translations_select_admin on public.organization_document_translations
  for select to authenticated
  using (public.is_admin() or public.has_capability('documents:write'));
create policy organization_document_translations_insert_admin on public.organization_document_translations
  for insert to authenticated
  with check (public.is_admin() or public.has_capability('documents:write'));
create policy organization_document_translations_update_admin on public.organization_document_translations
  for update to authenticated
  using (public.is_admin() or public.has_capability('documents:write'))
  with check (public.is_admin() or public.has_capability('documents:write'));
create policy organization_document_translations_delete_admin on public.organization_document_translations
  for delete to authenticated
  using (public.is_admin() or public.has_capability('documents:write'));

-- ---------------------------------------------------------------------------
-- events:write — calendar event ↔ project mappings
-- ---------------------------------------------------------------------------
-- Public event content lives in Google Calendar; this table only holds the
-- optional project association, so events:write cannot alter public event data.

drop policy calendar_event_links_select_admin on public.calendar_event_links;
drop policy calendar_event_links_insert_admin on public.calendar_event_links;
drop policy calendar_event_links_update_admin on public.calendar_event_links;
drop policy calendar_event_links_delete_admin on public.calendar_event_links;

create policy calendar_event_links_select_admin on public.calendar_event_links
  for select to authenticated
  using (public.is_admin() or public.has_capability('events:write'));
create policy calendar_event_links_insert_admin on public.calendar_event_links
  for insert to authenticated
  with check (public.is_admin() or public.has_capability('events:write'));
create policy calendar_event_links_update_admin on public.calendar_event_links
  for update to authenticated
  using (public.is_admin() or public.has_capability('events:write'))
  with check (public.is_admin() or public.has_capability('events:write'));
create policy calendar_event_links_delete_admin on public.calendar_event_links
  for delete to authenticated
  using (public.is_admin() or public.has_capability('events:write'));

-- ---------------------------------------------------------------------------
-- content_assets — owned by exactly one publication OR document
-- ---------------------------------------------------------------------------
-- The XOR owner makes one predicate for both readers/writers correct: an
-- editor may manage assets belonging to the feature they can edit, but not the
-- other feature's assets. Publication editor == publications:write; document
-- editor == documents:write. Imported images also require media:write at the
-- storage boundary, which is a separate policy by design.

drop policy content_assets_select_admin on public.content_assets;
drop policy content_assets_insert_admin on public.content_assets;
drop policy content_assets_update_admin on public.content_assets;
drop policy content_assets_delete_admin on public.content_assets;

create policy content_assets_select_admin on public.content_assets
  for select to authenticated
  using (
    public.is_admin()
    or (
      publication_id is not null
      and public.has_capability('publications:write')
    )
    or (
      organization_document_id is not null
      and public.has_capability('documents:write')
    )
  );
create policy content_assets_insert_admin on public.content_assets
  for insert to authenticated
  with check (
    public.is_admin()
    or (
      publication_id is not null
      and public.has_capability('publications:write')
    )
    or (
      organization_document_id is not null
      and public.has_capability('documents:write')
    )
  );
create policy content_assets_update_admin on public.content_assets
  for update to authenticated
  using (
    public.is_admin()
    or (
      publication_id is not null
      and public.has_capability('publications:write')
    )
    or (
      organization_document_id is not null
      and public.has_capability('documents:write')
    )
  )
  with check (
    public.is_admin()
    or (
      publication_id is not null
      and public.has_capability('publications:write')
    )
    or (
      organization_document_id is not null
      and public.has_capability('documents:write')
    )
  );
create policy content_assets_delete_admin on public.content_assets
  for delete to authenticated
  using (
    public.is_admin()
    or (
      publication_id is not null
      and public.has_capability('publications:write')
    )
    or (
      organization_document_id is not null
      and public.has_capability('documents:write')
    )
  );

commit;
