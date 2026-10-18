-- T-013 — RLS policies and admin claim.
--
-- Design authority (every decision below traces to one of these):
--   * docs/tickets/DECISIONS.md D-17 — the canonical admin claim is
--     app_metadata.role = 'admin'. app_metadata is server-controlled;
--     user_metadata is user-editable and must never grant admin. The claim is
--     evaluated in exactly one place, public.is_admin(); no policy repeats the
--     expression.
--   * docs/tickets/DECISIONS.md D-21 — RLS was already enabled on all 12
--     content tables in T-012 with zero policies (deny-by-default). This
--     migration only adds the intended openings; it never disables RLS.
--   * docs/architecture.md §6 — anonymous visitors may read published public
--     content only; they cannot read drafts or write. Administrators mutate
--     content through a trusted claim. Authorization lives in PostgreSQL.
--   * docs/architecture.md §4 — an event-project mapping may point at a draft
--     project in the admin interface, but public event output must not link an
--     unpublished project. The public select policy on calendar_event_links
--     therefore hides mappings whose project is not published.
--   * docs/TESTING.md §3 — proof matrix per table.
--   * docs/tickets/T-013-rls-policies.md — shared "published visible"
--     predicate; no SECURITY DEFINER without a documented reason.
--
-- Why no SECURITY DEFINER:
--   is_admin() only reads the request.jwt.claims GUC and is_published() only
--   compares an enum value. Neither touches a table, so invoker rights are
--   sufficient and safest; definer rights would add privilege-escalation risk
--   for no benefit. Both functions pin search_path = '' and schema-qualify
--   what they call, so a caller-controlled search_path cannot redirect them.
--
-- Why the claims GUC is trusted:
--   PostgREST sets request.jwt.claims from the verified JWT after validating
--   its signature. The browser cannot set or edit it, and app_metadata is only
--   mutable with the service-role key (never shipped to the client). The
--   policies are therefore bound to the same claim an Auth hook issues.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- The single enforcement point for admin authorization (D-17).
--
-- Missing or empty claims are normal for anonymous requests: nullif(..., '')
-- keeps the cast from raising, and coalesce turns the non-match into false.
-- A malformed claims value is not expected (PostgREST only writes JSON), and
-- failing closed by raising is preferable to inventing an authorization
-- decision.
create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(
    nullif(pg_catalog.current_setting('request.jwt.claims', true), '')::jsonb
      -> 'app_metadata' ->> 'role' = 'admin',
    false
  );
$$;

comment on function public.is_admin() is
  'T-013/D-17: true only when the verified JWT''s app_metadata.role is '
  '"admin". This is the single enforcement point for admin authorization; '
  'user_metadata is deliberately never read. SECURITY INVOKER with a pinned '
  'search_path (empty) because the function only reads request.jwt.claims.';

-- The shared published-visibility predicate (T-013 REFACTOR step). Every
-- policy uses this function rather than comparing status literals, so the
-- definition of "publicly visible" cannot drift between tables.
create or replace function public.is_published(p_status public.content_status)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_status = 'published'::public.content_status, false);
$$;

comment on function public.is_published(public.content_status) is
  'T-013: the single definition of a publicly visible content status. '
  'Draft and archived rows are not public. SECURITY INVOKER with a pinned '
  'search_path (empty) because the function only compares an enum value.';

-- ---------------------------------------------------------------------------
-- Root content tables: select is published-or-admin; writes are admin-only.
-- ---------------------------------------------------------------------------
-- Two SELECT policies are used instead of one `is_admin() or is_published()`
-- expression so the public opening and the admin opening stay independently
-- auditable. PostgreSQL ORs permissive policies, so the effective rule is
-- exactly "published OR admin".

-- site_pages -----------------------------------------------------------------

create policy site_pages_select_published on public.site_pages
  for select to anon, authenticated
  using (public.is_published(status));

create policy site_pages_select_admin on public.site_pages
  for select to authenticated
  using (public.is_admin());

create policy site_pages_insert_admin on public.site_pages
  for insert to authenticated
  with check (public.is_admin());

create policy site_pages_update_admin on public.site_pages
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy site_pages_delete_admin on public.site_pages
  for delete to authenticated
  using (public.is_admin());

-- projects -------------------------------------------------------------------

create policy projects_select_published on public.projects
  for select to anon, authenticated
  using (public.is_published(status));

create policy projects_select_admin on public.projects
  for select to authenticated
  using (public.is_admin());

create policy projects_insert_admin on public.projects
  for insert to authenticated
  with check (public.is_admin());

create policy projects_update_admin on public.projects
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy projects_delete_admin on public.projects
  for delete to authenticated
  using (public.is_admin());

-- team_members ---------------------------------------------------------------

create policy team_members_select_published on public.team_members
  for select to anon, authenticated
  using (public.is_published(status));

create policy team_members_select_admin on public.team_members
  for select to authenticated
  using (public.is_admin());

create policy team_members_insert_admin on public.team_members
  for insert to authenticated
  with check (public.is_admin());

create policy team_members_update_admin on public.team_members
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy team_members_delete_admin on public.team_members
  for delete to authenticated
  using (public.is_admin());

-- publications ---------------------------------------------------------------

create policy publications_select_published on public.publications
  for select to anon, authenticated
  using (public.is_published(status));

create policy publications_select_admin on public.publications
  for select to authenticated
  using (public.is_admin());

create policy publications_insert_admin on public.publications
  for insert to authenticated
  with check (public.is_admin());

create policy publications_update_admin on public.publications
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy publications_delete_admin on public.publications
  for delete to authenticated
  using (public.is_admin());

-- organization_documents -----------------------------------------------------

create policy organization_documents_select_published on public.organization_documents
  for select to anon, authenticated
  using (public.is_published(status));

create policy organization_documents_select_admin on public.organization_documents
  for select to authenticated
  using (public.is_admin());

create policy organization_documents_insert_admin on public.organization_documents
  for insert to authenticated
  with check (public.is_admin());

create policy organization_documents_update_admin on public.organization_documents
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy organization_documents_delete_admin on public.organization_documents
  for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Translation and file tables: public read follows the parent's publish state.
-- ---------------------------------------------------------------------------
-- The parent subquery is itself subject to the parent table's RLS, so a
-- translation can never become visible through a join that bypasses the
-- parent's policy. The explicit is_published() call documents the shared rule
-- and keeps this predicate identical to the root-table predicate.

-- site_page_translations -----------------------------------------------------

create policy site_page_translations_select_published on public.site_page_translations
  for select to anon, authenticated
  using (exists (
    select 1
      from public.site_pages p
     where p.id = site_page_translations.page_id
       and public.is_published(p.status)
  ));

create policy site_page_translations_select_admin on public.site_page_translations
  for select to authenticated
  using (public.is_admin());

create policy site_page_translations_insert_admin on public.site_page_translations
  for insert to authenticated
  with check (public.is_admin());

create policy site_page_translations_update_admin on public.site_page_translations
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy site_page_translations_delete_admin on public.site_page_translations
  for delete to authenticated
  using (public.is_admin());

-- project_translations -------------------------------------------------------

create policy project_translations_select_published on public.project_translations
  for select to anon, authenticated
  using (exists (
    select 1
      from public.projects p
     where p.id = project_translations.project_id
       and public.is_published(p.status)
  ));

create policy project_translations_select_admin on public.project_translations
  for select to authenticated
  using (public.is_admin());

create policy project_translations_insert_admin on public.project_translations
  for insert to authenticated
  with check (public.is_admin());

create policy project_translations_update_admin on public.project_translations
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy project_translations_delete_admin on public.project_translations
  for delete to authenticated
  using (public.is_admin());

-- team_member_translations ---------------------------------------------------

create policy team_member_translations_select_published on public.team_member_translations
  for select to anon, authenticated
  using (exists (
    select 1
      from public.team_members p
     where p.id = team_member_translations.member_id
       and public.is_published(p.status)
  ));

create policy team_member_translations_select_admin on public.team_member_translations
  for select to authenticated
  using (public.is_admin());

create policy team_member_translations_insert_admin on public.team_member_translations
  for insert to authenticated
  with check (public.is_admin());

create policy team_member_translations_update_admin on public.team_member_translations
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy team_member_translations_delete_admin on public.team_member_translations
  for delete to authenticated
  using (public.is_admin());

-- publication_translations ---------------------------------------------------

create policy publication_translations_select_published on public.publication_translations
  for select to anon, authenticated
  using (exists (
    select 1
      from public.publications p
     where p.id = publication_translations.publication_id
       and public.is_published(p.status)
  ));

create policy publication_translations_select_admin on public.publication_translations
  for select to authenticated
  using (public.is_admin());

create policy publication_translations_insert_admin on public.publication_translations
  for insert to authenticated
  with check (public.is_admin());

create policy publication_translations_update_admin on public.publication_translations
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy publication_translations_delete_admin on public.publication_translations
  for delete to authenticated
  using (public.is_admin());

-- publication_files ----------------------------------------------------------

create policy publication_files_select_published on public.publication_files
  for select to anon, authenticated
  using (exists (
    select 1
      from public.publications p
     where p.id = publication_files.publication_id
       and public.is_published(p.status)
  ));

create policy publication_files_select_admin on public.publication_files
  for select to authenticated
  using (public.is_admin());

create policy publication_files_insert_admin on public.publication_files
  for insert to authenticated
  with check (public.is_admin());

create policy publication_files_update_admin on public.publication_files
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy publication_files_delete_admin on public.publication_files
  for delete to authenticated
  using (public.is_admin());

-- organization_document_translations ----------------------------------------

create policy organization_document_translations_select_published on public.organization_document_translations
  for select to anon, authenticated
  using (exists (
    select 1
      from public.organization_documents p
     where p.id = organization_document_translations.document_id
       and public.is_published(p.status)
  ));

create policy organization_document_translations_select_admin on public.organization_document_translations
  for select to authenticated
  using (public.is_admin());

create policy organization_document_translations_insert_admin on public.organization_document_translations
  for insert to authenticated
  with check (public.is_admin());

create policy organization_document_translations_update_admin on public.organization_document_translations
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy organization_document_translations_delete_admin on public.organization_document_translations
  for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- calendar_event_links: public read of unlinked/published links; admin write.
-- ---------------------------------------------------------------------------
-- The table holds only identifiers, but project_id is itself a link to a
-- project row. Allowing an anonymous SELECT of a mapping whose project is a
-- draft would hand out that draft project's UUID (and therefore a join target),
-- contradicting architecture §4 and TESTING §3. The public policy therefore
-- exposes unlinked mappings and mappings to published projects only. A
-- mapping to a draft remains fully visible to admins and to the calendar
-- adapter (which uses the service role), and the event itself still renders
-- publicly with no project link.

create policy calendar_event_links_select_public on public.calendar_event_links
  for select to anon, authenticated
  using (
    project_id is null
    or exists (
      select 1
        from public.projects p
       where p.id = calendar_event_links.project_id
         and public.is_published(p.status)
    )
  );

create policy calendar_event_links_select_admin on public.calendar_event_links
  for select to authenticated
  using (public.is_admin());

create policy calendar_event_links_insert_admin on public.calendar_event_links
  for insert to authenticated
  with check (public.is_admin());

create policy calendar_event_links_update_admin on public.calendar_event_links
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy calendar_event_links_delete_admin on public.calendar_event_links
  for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Narrow explicit REVOKE
-- ---------------------------------------------------------------------------
-- Supabase's default privileges (pg_default_acl) grant anon, authenticated and
-- service_role INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER on every new
-- table in public. RLS alone already denies anon writes because no write policy
-- is granted to anon, but defence in depth is warranted for a role that must
-- never write under any future policy mistake. SELECT is deliberately left in
-- place: the public policies above depend on it.
--
-- authenticated keeps its grants: admin authorization is expressed by the
-- is_admin() policies, not by table privileges. service_role keeps its grants
-- because it bypasses RLS by design (server-side only, never shipped).
revoke insert, update, delete, truncate, references, trigger on
  public.site_pages,
  public.site_page_translations,
  public.projects,
  public.project_translations,
  public.team_members,
  public.team_member_translations,
  public.publications,
  public.publication_translations,
  public.publication_files,
  public.organization_documents,
  public.organization_document_translations,
  public.calendar_event_links
from anon;
