-- T-013 — RLS proof matrix (pgTAP).
--
-- Design authority:
--   * docs/architecture.md §6 — anonymous reads published public content only;
--     anonymous cannot read drafts or write; administrators mutate via a
--     trusted claim; deny-by-default at the data boundary.
--   * docs/architecture.md §4 — public event output must not expose a link to
--     an unpublished project.
--   * docs/TESTING.md §3 — per-table matrix: anon published read allowed,
--     anon draft read denied, anon write denied, non-admin authenticated
--     write denied, admin CRUD allowed, event mappings do not reveal drafts.
--   * docs/tickets/DECISIONS.md D-17 — admin claim is app_metadata.role; the
--     claim is only ever evaluated by public.is_admin().
--
-- Identity simulation follows TESTING §3: SET LOCAL ROLE plus
-- request.jwt.claims. The service-role key is never used as an ordinary user.
-- The whole file runs in one transaction and rolls back, so fixtures never
-- leak into the seeded database.
--
-- Expected RED before the T-013 migration exists: every positive assertion
-- (anon reads a published row, admin reads a draft, admin insert/update/delete)
-- fails because the tables have RLS enabled and zero policies (D-21).

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Fictional fixtures (inserted as the migration superuser; RLS bypassed here)
-- ---------------------------------------------------------------------------

-- Site pages: published, draft, and an admin target with no translations.
insert into public.site_pages (id, page_key, status, sort_order, published_at) values
  ('a1000000-0000-4000-8000-000000000001', 'rls-published-page', 'published', 1, now()),
  ('a1000000-0000-4000-8000-000000000002', 'rls-draft-page', 'draft', 2, null),
  ('a1000000-0000-4000-8000-000000000003', 'rls-admin-target-page', 'published', 3, now());

insert into public.site_page_translations (id, page_id, locale, title) values
  ('a1100000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'en',
   'RLS Published Page (fictional)'),
  ('a1100000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000002', 'en',
   'RLS Draft Page (fictional)');

-- Projects: published (anon-visible), draft, and an admin translation target.
insert into public.projects (id, slug, status, published_at) values
  ('a2000000-0000-4000-8000-000000000001', 'rls-project-published', 'published', now()),
  ('a2000000-0000-4000-8000-000000000002', 'rls-project-draft', 'draft', null),
  ('a2000000-0000-4000-8000-000000000003', 'rls-project-admin-target', 'published', now());

insert into public.project_translations (id, project_id, locale, title) values
  ('a2100000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'en',
   'RLS Published Project (fictional)'),
  ('a2100000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000002', 'en',
   'RLS Draft Project (fictional)');

-- Team members: published, draft, and an admin translation target.
insert into public.team_members (id, name, status, sort_order, published_at) values
  ('a3000000-0000-4000-8000-000000000001', 'RLS Published Person (fictional)', 'published', 1, now()),
  ('a3000000-0000-4000-8000-000000000002', 'RLS Draft Person (fictional)', 'draft', 2, null),
  ('a3000000-0000-4000-8000-000000000003', 'RLS Admin Target Person (fictional)', 'published', 3, now());

insert into public.team_member_translations (id, member_id, locale, role) values
  ('a3100000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 'en',
   'RLS Published Role (fictional)'),
  ('a3100000-0000-4000-8000-000000000002', 'a3000000-0000-4000-8000-000000000002', 'en',
   'RLS Draft Role (fictional)');

-- Publications: published, draft, and an admin target for translations/files.
insert into public.publications (id, slug, status, publication_date, published_at) values
  ('a4000000-0000-4000-8000-000000000001', 'rls-publication-published', 'published', '2026-01-01', now()),
  ('a4000000-0000-4000-8000-000000000002', 'rls-publication-draft', 'draft', null, null),
  ('a4000000-0000-4000-8000-000000000003', 'rls-publication-admin-target', 'published', '2026-01-02', now());

insert into public.publication_translations (id, publication_id, locale, title) values
  ('a4100000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000001', 'en',
   'RLS Published Publication (fictional)'),
  ('a4100000-0000-4000-8000-000000000002', 'a4000000-0000-4000-8000-000000000002', 'en',
   'RLS Draft Publication (fictional)');

insert into public.publication_files (id, publication_id, locale, label, storage_path) values
  ('a4200000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000001', 'en',
   'RLS published file', 'fixtures/rls/publication-en.pdf'),
  ('a4200000-0000-4000-8000-000000000002', 'a4000000-0000-4000-8000-000000000002', 'en',
   'RLS draft file', 'fixtures/rls/publication-draft.pdf');

-- Organization documents: published, draft, and an admin translation target.
insert into public.organization_documents
  (id, slug, status, document_type, language, storage_path, sort_order, published_at)
values
  ('a5000000-0000-4000-8000-000000000001', 'rls-document-published', 'published', 'statute', 'en',
   'fixtures/rls/statute-published.pdf', 1, now()),
  ('a5000000-0000-4000-8000-000000000002', 'rls-document-draft', 'draft', 'statute', 'en',
   'fixtures/rls/statute-draft.pdf', 2, null),
  ('a5000000-0000-4000-8000-000000000003', 'rls-document-admin-target', 'published', 'report', 'en',
   'fixtures/rls/report-admin-target.pdf', 3, now());

insert into public.organization_document_translations (id, document_id, locale, title) values
  ('a5100000-0000-4000-8000-000000000001', 'a5000000-0000-4000-8000-000000000001', 'en',
   'RLS Published Document (fictional)'),
  ('a5100000-0000-4000-8000-000000000002', 'a5000000-0000-4000-8000-000000000002', 'en',
   'RLS Draft Document (fictional)');

-- T-017 text documents: null file columns, body on the translation. Access stays
-- status/parent-based, so the published/draft read rules must be unchanged.
insert into public.organization_documents
  (id, slug, status, document_type, language, storage_path, sort_order, published_at)
values
  ('a5000000-0000-4000-8000-000000000005', 'rls-document-text-published', 'published', 'regulations', null, null, 5, now()),
  ('a5000000-0000-4000-8000-000000000006', 'rls-document-text-draft', 'draft', 'regulations', null, null, 6, null);

insert into public.organization_document_translations (id, document_id, locale, title, body) values
  ('a5100000-0000-4000-8000-000000000005', 'a5000000-0000-4000-8000-000000000005', 'en',
   'RLS Published Text Document (fictional)', '## § 1\n\nFixture body.'),
  ('a5100000-0000-4000-8000-000000000006', 'a5000000-0000-4000-8000-000000000006', 'en',
   'RLS Draft Text Document (fictional)', '## § 1\n\nDraft body.');

-- Event mappings: unlinked, linked to a published project, linked to a draft.
insert into public.calendar_event_links (id, calendar_id, google_event_id, project_id) values
  ('a6000000-0000-4000-8000-000000000001', 'rls-calendar@example.org', 'rls-event-unlinked', null),
  ('a6000000-0000-4000-8000-000000000002', 'rls-calendar@example.org', 'rls-event-linked-published',
   'a2000000-0000-4000-8000-000000000001'),
  ('a6000000-0000-4000-8000-000000000003', 'rls-calendar@example.org', 'rls-event-linked-draft',
   'a2000000-0000-4000-8000-000000000002');

select plan(152);

-- ===========================================================================
-- Root content tables (12 assertions each)
-- ===========================================================================

-- --- site_pages -----------------------------------------------------------

select set_config('request.jwt.claims', $json${"role":"anon"}$json$, true);
set local role anon;
select is((select count(*) from public.site_pages where id = 'a1000000-0000-4000-8000-000000000001'), 1::bigint, 'anon reads a published site_page');
select is((select count(*) from public.site_pages where id = 'a1000000-0000-4000-8000-000000000002'), 0::bigint, 'anon cannot read a draft site_page');
select throws_ok($sql$ insert into public.site_pages (id, page_key) values ('a1000000-0000-4000-8000-0000000000f1', 'rls-anon-page') $sql$, '42501', NULL, 'anon insert denied on site_pages');
select throws_ok($sql$ update public.site_pages set sort_order = 99 where id = 'a1000000-0000-4000-8000-000000000001' $sql$, '42501', NULL, 'anon update denied on site_pages');
select throws_ok($sql$ delete from public.site_pages where id = 'a1000000-0000-4000-8000-000000000001' $sql$, '42501', NULL, 'anon delete denied on site_pages');
reset role;

select set_config('request.jwt.claims', $json${"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}$json$, true);
set local role authenticated;
select throws_ok($sql$ insert into public.site_pages (id, page_key) values ('a1000000-0000-4000-8000-0000000000f2', 'rls-nonadmin-page') $sql$, '42501', NULL, 'non-admin insert denied on site_pages');
with u as (update public.site_pages set sort_order = 99 where id = 'a1000000-0000-4000-8000-000000000001' returning 1)
select is((select count(*) from u), 0::bigint, 'non-admin update affects no site_pages rows');
with d as (delete from public.site_pages where id = 'a1000000-0000-4000-8000-000000000001' returning 1)
select is((select count(*) from d), 0::bigint, 'non-admin delete affects no site_pages rows');
reset role;

select set_config('request.jwt.claims', $json${"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{"role":"admin"}}$json$, true);
set local role authenticated;
select is((select count(*) from public.site_pages where id = 'a1000000-0000-4000-8000-000000000002'), 1::bigint, 'admin reads a draft site_page');
insert into public.site_pages (id, page_key, status) values ('a1000000-0000-4000-8000-000000000004', 'rls-admin-insert-page', 'draft');
select is((select count(*) from public.site_pages where id = 'a1000000-0000-4000-8000-000000000004'), 1::bigint, 'admin insert succeeds on site_pages');
update public.site_pages set status = 'archived' where id = 'a1000000-0000-4000-8000-000000000004';
select is((select status::text from public.site_pages where id = 'a1000000-0000-4000-8000-000000000004'), 'archived', 'admin update succeeds on site_pages');
delete from public.site_pages where id = 'a1000000-0000-4000-8000-000000000004';
select is((select count(*) from public.site_pages where id = 'a1000000-0000-4000-8000-000000000004'), 0::bigint, 'admin delete succeeds on site_pages');
reset role;

-- --- projects -------------------------------------------------------------

select set_config('request.jwt.claims', $json${"role":"anon"}$json$, true);
set local role anon;
select is((select count(*) from public.projects where id = 'a2000000-0000-4000-8000-000000000001'), 1::bigint, 'anon reads a published project');
select is((select count(*) from public.projects where id = 'a2000000-0000-4000-8000-000000000002'), 0::bigint, 'anon cannot read a draft project');
select throws_ok($sql$ insert into public.projects (id, slug, status) values ('a2000000-0000-4000-8000-0000000000f1', 'rls-anon-project', 'draft') $sql$, '42501', NULL, 'anon insert denied on projects');
select throws_ok($sql$ update public.projects set status = 'archived' where id = 'a2000000-0000-4000-8000-000000000001' $sql$, '42501', NULL, 'anon update denied on projects');
select throws_ok($sql$ delete from public.projects where id = 'a2000000-0000-4000-8000-000000000001' $sql$, '42501', NULL, 'anon delete denied on projects');
reset role;

select set_config('request.jwt.claims', $json${"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}$json$, true);
set local role authenticated;
select is((select count(*) from public.projects where id = 'a2000000-0000-4000-8000-000000000001'), 1::bigint, 'non-admin authenticated reads a published project');
select throws_ok($sql$ insert into public.projects (id, slug, status) values ('a2000000-0000-4000-8000-0000000000f2', 'rls-nonadmin-project', 'draft') $sql$, '42501', NULL, 'non-admin insert denied on projects');
with u as (update public.projects set status = 'archived' where id = 'a2000000-0000-4000-8000-000000000001' returning 1)
select is((select count(*) from u), 0::bigint, 'non-admin update affects no projects rows');
with d as (delete from public.projects where id = 'a2000000-0000-4000-8000-000000000001' returning 1)
select is((select count(*) from d), 0::bigint, 'non-admin delete affects no projects rows');
reset role;

select set_config('request.jwt.claims', $json${"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{"role":"admin"}}$json$, true);
set local role authenticated;
select is((select count(*) from public.projects where id = 'a2000000-0000-4000-8000-000000000002'), 1::bigint, 'admin reads a draft project');
insert into public.projects (id, slug, status) values ('a2000000-0000-4000-8000-000000000004', 'rls-admin-project', 'draft');
select is((select count(*) from public.projects where id = 'a2000000-0000-4000-8000-000000000004'), 1::bigint, 'admin insert succeeds on projects');
update public.projects set status = 'archived' where id = 'a2000000-0000-4000-8000-000000000004';
select is((select status::text from public.projects where id = 'a2000000-0000-4000-8000-000000000004'), 'archived', 'admin update succeeds on projects');
delete from public.projects where id = 'a2000000-0000-4000-8000-000000000004';
select is((select count(*) from public.projects where id = 'a2000000-0000-4000-8000-000000000004'), 0::bigint, 'admin delete succeeds on projects');
reset role;

-- --- team_members ---------------------------------------------------------

select set_config('request.jwt.claims', $json${"role":"anon"}$json$, true);
set local role anon;
select is((select count(*) from public.team_members where id = 'a3000000-0000-4000-8000-000000000001'), 1::bigint, 'anon reads a published team_member');
select is((select count(*) from public.team_members where id = 'a3000000-0000-4000-8000-000000000002'), 0::bigint, 'anon cannot read a draft team_member');
select throws_ok($sql$ insert into public.team_members (id, name) values ('a3000000-0000-4000-8000-0000000000f1', 'RLS Anon Person (fictional)') $sql$, '42501', NULL, 'anon insert denied on team_members');
select throws_ok($sql$ update public.team_members set sort_order = 99 where id = 'a3000000-0000-4000-8000-000000000001' $sql$, '42501', NULL, 'anon update denied on team_members');
select throws_ok($sql$ delete from public.team_members where id = 'a3000000-0000-4000-8000-000000000001' $sql$, '42501', NULL, 'anon delete denied on team_members');
reset role;

select set_config('request.jwt.claims', $json${"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}$json$, true);
set local role authenticated;
select throws_ok($sql$ insert into public.team_members (id, name) values ('a3000000-0000-4000-8000-0000000000f2', 'RLS Nonadmin Person (fictional)') $sql$, '42501', NULL, 'non-admin insert denied on team_members');
with u as (update public.team_members set sort_order = 99 where id = 'a3000000-0000-4000-8000-000000000001' returning 1)
select is((select count(*) from u), 0::bigint, 'non-admin update affects no team_members rows');
with d as (delete from public.team_members where id = 'a3000000-0000-4000-8000-000000000001' returning 1)
select is((select count(*) from d), 0::bigint, 'non-admin delete affects no team_members rows');
reset role;

select set_config('request.jwt.claims', $json${"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{"role":"admin"}}$json$, true);
set local role authenticated;
select is((select count(*) from public.team_members where id = 'a3000000-0000-4000-8000-000000000002'), 1::bigint, 'admin reads a draft team_member');
insert into public.team_members (id, name, status) values ('a3000000-0000-4000-8000-000000000004', 'RLS Admin Insert Person (fictional)', 'draft');
select is((select count(*) from public.team_members where id = 'a3000000-0000-4000-8000-000000000004'), 1::bigint, 'admin insert succeeds on team_members');
update public.team_members set status = 'archived' where id = 'a3000000-0000-4000-8000-000000000004';
select is((select status::text from public.team_members where id = 'a3000000-0000-4000-8000-000000000004'), 'archived', 'admin update succeeds on team_members');
delete from public.team_members where id = 'a3000000-0000-4000-8000-000000000004';
select is((select count(*) from public.team_members where id = 'a3000000-0000-4000-8000-000000000004'), 0::bigint, 'admin delete succeeds on team_members');
reset role;

-- --- publications ---------------------------------------------------------

select set_config('request.jwt.claims', $json${"role":"anon"}$json$, true);
set local role anon;
select is((select count(*) from public.publications where id = 'a4000000-0000-4000-8000-000000000001'), 1::bigint, 'anon reads a published publication');
select is((select count(*) from public.publications where id = 'a4000000-0000-4000-8000-000000000002'), 0::bigint, 'anon cannot read a draft publication');
select throws_ok($sql$ insert into public.publications (id, slug, status) values ('a4000000-0000-4000-8000-0000000000f1', 'rls-anon-publication', 'draft') $sql$, '42501', NULL, 'anon insert denied on publications');
select throws_ok($sql$ update public.publications set sort_order = 99 where id = 'a4000000-0000-4000-8000-000000000001' $sql$, '42501', NULL, 'anon update denied on publications');
select throws_ok($sql$ delete from public.publications where id = 'a4000000-0000-4000-8000-000000000001' $sql$, '42501', NULL, 'anon delete denied on publications');
reset role;

select set_config('request.jwt.claims', $json${"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}$json$, true);
set local role authenticated;
select throws_ok($sql$ insert into public.publications (id, slug, status) values ('a4000000-0000-4000-8000-0000000000f2', 'rls-nonadmin-publication', 'draft') $sql$, '42501', NULL, 'non-admin insert denied on publications');
with u as (update public.publications set sort_order = 99 where id = 'a4000000-0000-4000-8000-000000000001' returning 1)
select is((select count(*) from u), 0::bigint, 'non-admin update affects no publications rows');
with d as (delete from public.publications where id = 'a4000000-0000-4000-8000-000000000001' returning 1)
select is((select count(*) from d), 0::bigint, 'non-admin delete affects no publications rows');
reset role;

select set_config('request.jwt.claims', $json${"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{"role":"admin"}}$json$, true);
set local role authenticated;
select is((select count(*) from public.publications where id = 'a4000000-0000-4000-8000-000000000002'), 1::bigint, 'admin reads a draft publication');
insert into public.publications (id, slug, status) values ('a4000000-0000-4000-8000-000000000004', 'rls-admin-publication', 'draft');
select is((select count(*) from public.publications where id = 'a4000000-0000-4000-8000-000000000004'), 1::bigint, 'admin insert succeeds on publications');
update public.publications set status = 'archived' where id = 'a4000000-0000-4000-8000-000000000004';
select is((select status::text from public.publications where id = 'a4000000-0000-4000-8000-000000000004'), 'archived', 'admin update succeeds on publications');
delete from public.publications where id = 'a4000000-0000-4000-8000-000000000004';
select is((select count(*) from public.publications where id = 'a4000000-0000-4000-8000-000000000004'), 0::bigint, 'admin delete succeeds on publications');
reset role;

-- --- organization_documents ----------------------------------------------

select set_config('request.jwt.claims', $json${"role":"anon"}$json$, true);
set local role anon;
select is((select count(*) from public.organization_documents where id = 'a5000000-0000-4000-8000-000000000001'), 1::bigint, 'anon reads a published organization_document');
select is((select count(*) from public.organization_documents where id = 'a5000000-0000-4000-8000-000000000002'), 0::bigint, 'anon cannot read a draft organization_document');
select is((select count(*) from public.organization_documents where id = 'a5000000-0000-4000-8000-000000000005'), 1::bigint, 'anon reads a published text organization_document');
select is((select count(*) from public.organization_documents where id = 'a5000000-0000-4000-8000-000000000006'), 0::bigint, 'anon cannot read a draft text organization_document');
select throws_ok($sql$ insert into public.organization_documents (id, slug, document_type, language, storage_path) values ('a5000000-0000-4000-8000-0000000000f1', 'rls-anon-statute', 'statute', 'en', 'fixtures/rls/anon-statute.pdf') $sql$, '42501', NULL, 'anon insert denied on organization_documents');
select throws_ok($sql$ update public.organization_documents set sort_order = 99 where id = 'a5000000-0000-4000-8000-000000000001' $sql$, '42501', NULL, 'anon update denied on organization_documents');
select throws_ok($sql$ delete from public.organization_documents where id = 'a5000000-0000-4000-8000-000000000001' $sql$, '42501', NULL, 'anon delete denied on organization_documents');
reset role;

select set_config('request.jwt.claims', $json${"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}$json$, true);
set local role authenticated;
select throws_ok($sql$ insert into public.organization_documents (id, slug, document_type, language, storage_path) values ('a5000000-0000-4000-8000-0000000000f2', 'rls-nonadmin-statute', 'statute', 'en', 'fixtures/rls/nonadmin-statute.pdf') $sql$, '42501', NULL, 'non-admin insert denied on organization_documents');
with u as (update public.organization_documents set sort_order = 99 where id = 'a5000000-0000-4000-8000-000000000001' returning 1)
select is((select count(*) from u), 0::bigint, 'non-admin update affects no organization_documents rows');
with d as (delete from public.organization_documents where id = 'a5000000-0000-4000-8000-000000000001' returning 1)
select is((select count(*) from d), 0::bigint, 'non-admin delete affects no organization_documents rows');
reset role;

select set_config('request.jwt.claims', $json${"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{"role":"admin"}}$json$, true);
set local role authenticated;
select is((select count(*) from public.organization_documents where id = 'a5000000-0000-4000-8000-000000000002'), 1::bigint, 'admin reads a draft organization_document');
insert into public.organization_documents (id, slug, status, document_type, language, storage_path) values ('a5000000-0000-4000-8000-000000000004', 'rls-admin-statute', 'draft', 'statute', 'en', 'fixtures/rls/admin-statute.pdf');
select is((select count(*) from public.organization_documents where id = 'a5000000-0000-4000-8000-000000000004'), 1::bigint, 'admin insert succeeds on organization_documents');
update public.organization_documents set status = 'archived' where id = 'a5000000-0000-4000-8000-000000000004';
select is((select status::text from public.organization_documents where id = 'a5000000-0000-4000-8000-000000000004'), 'archived', 'admin update succeeds on organization_documents');
delete from public.organization_documents where id = 'a5000000-0000-4000-8000-000000000004';
select is((select count(*) from public.organization_documents where id = 'a5000000-0000-4000-8000-000000000004'), 0::bigint, 'admin delete succeeds on organization_documents');
reset role;

-- ===========================================================================
-- Translation and file tables (12 assertions each): public read follows the
-- parent's publish state; writes are admin-only.
-- ===========================================================================

-- --- site_page_translations ----------------------------------------------

select set_config('request.jwt.claims', $json${"role":"anon"}$json$, true);
set local role anon;
select is((select count(*) from public.site_page_translations where id = 'a1100000-0000-4000-8000-000000000001'), 1::bigint, 'anon reads a translation of a published site_page');
select is((select count(*) from public.site_page_translations where id = 'a1100000-0000-4000-8000-000000000002'), 0::bigint, 'anon cannot read a translation of a draft site_page');
select throws_ok($sql$ insert into public.site_page_translations (id, page_id, locale, title) values ('a1100000-0000-4000-8000-0000000000f1', 'a1000000-0000-4000-8000-000000000001', 'pl', 'Anon insert (fictional)') $sql$, '42501', NULL, 'anon insert denied on site_page_translations');
select throws_ok($sql$ update public.site_page_translations set needs_review = true where id = 'a1100000-0000-4000-8000-000000000001' $sql$, '42501', NULL, 'anon update denied on site_page_translations');
select throws_ok($sql$ delete from public.site_page_translations where id = 'a1100000-0000-4000-8000-000000000001' $sql$, '42501', NULL, 'anon delete denied on site_page_translations');
reset role;

select set_config('request.jwt.claims', $json${"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}$json$, true);
set local role authenticated;
select throws_ok($sql$ insert into public.site_page_translations (id, page_id, locale, title) values ('a1100000-0000-4000-8000-0000000000f2', 'a1000000-0000-4000-8000-000000000001', 'pl', 'Nonadmin insert (fictional)') $sql$, '42501', NULL, 'non-admin insert denied on site_page_translations');
with u as (update public.site_page_translations set needs_review = true where id = 'a1100000-0000-4000-8000-000000000001' returning 1)
select is((select count(*) from u), 0::bigint, 'non-admin update affects no site_page_translations rows');
with d as (delete from public.site_page_translations where id = 'a1100000-0000-4000-8000-000000000001' returning 1)
select is((select count(*) from d), 0::bigint, 'non-admin delete affects no site_page_translations rows');
reset role;

select set_config('request.jwt.claims', $json${"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{"role":"admin"}}$json$, true);
set local role authenticated;
select is((select count(*) from public.site_page_translations where id = 'a1100000-0000-4000-8000-000000000002'), 1::bigint, 'admin reads a translation of a draft site_page');
insert into public.site_page_translations (id, page_id, locale, title) values ('a1100000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000003', 'en', 'RLS Admin Page Insert (fictional)');
select is((select count(*) from public.site_page_translations where id = 'a1100000-0000-4000-8000-000000000003'), 1::bigint, 'admin insert succeeds on site_page_translations');
update public.site_page_translations set needs_review = true where id = 'a1100000-0000-4000-8000-000000000003';
select is((select needs_review from public.site_page_translations where id = 'a1100000-0000-4000-8000-000000000003'), true, 'admin update succeeds on site_page_translations');
delete from public.site_page_translations where id = 'a1100000-0000-4000-8000-000000000003';
select is((select count(*) from public.site_page_translations where id = 'a1100000-0000-4000-8000-000000000003'), 0::bigint, 'admin delete succeeds on site_page_translations');
reset role;

-- --- project_translations -------------------------------------------------

select set_config('request.jwt.claims', $json${"role":"anon"}$json$, true);
set local role anon;
select is((select count(*) from public.project_translations where id = 'a2100000-0000-4000-8000-000000000001'), 1::bigint, 'anon reads a translation of a published project');
select is((select count(*) from public.project_translations where id = 'a2100000-0000-4000-8000-000000000002'), 0::bigint, 'anon cannot read a translation of a draft project');
select throws_ok($sql$ insert into public.project_translations (id, project_id, locale, title) values ('a2100000-0000-4000-8000-0000000000f1', 'a2000000-0000-4000-8000-000000000001', 'pl', 'Anon insert (fictional)') $sql$, '42501', NULL, 'anon insert denied on project_translations');
select throws_ok($sql$ update public.project_translations set needs_review = true where id = 'a2100000-0000-4000-8000-000000000001' $sql$, '42501', NULL, 'anon update denied on project_translations');
select throws_ok($sql$ delete from public.project_translations where id = 'a2100000-0000-4000-8000-000000000001' $sql$, '42501', NULL, 'anon delete denied on project_translations');
reset role;

select set_config('request.jwt.claims', $json${"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}$json$, true);
set local role authenticated;
select is((select count(*) from public.project_translations where id = 'a2100000-0000-4000-8000-000000000001'), 1::bigint, 'non-admin authenticated reads a translation of a published project');
select throws_ok($sql$ insert into public.project_translations (id, project_id, locale, title) values ('a2100000-0000-4000-8000-0000000000f2', 'a2000000-0000-4000-8000-000000000001', 'pl', 'Nonadmin insert (fictional)') $sql$, '42501', NULL, 'non-admin insert denied on project_translations');
with u as (update public.project_translations set needs_review = true where id = 'a2100000-0000-4000-8000-000000000001' returning 1)
select is((select count(*) from u), 0::bigint, 'non-admin update affects no project_translations rows');
with d as (delete from public.project_translations where id = 'a2100000-0000-4000-8000-000000000001' returning 1)
select is((select count(*) from d), 0::bigint, 'non-admin delete affects no project_translations rows');
reset role;

select set_config('request.jwt.claims', $json${"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{"role":"admin"}}$json$, true);
set local role authenticated;
select is((select count(*) from public.project_translations where id = 'a2100000-0000-4000-8000-000000000002'), 1::bigint, 'admin reads a translation of a draft project');
insert into public.project_translations (id, project_id, locale, title) values ('a2100000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000003', 'en', 'RLS Admin Project Insert (fictional)');
select is((select count(*) from public.project_translations where id = 'a2100000-0000-4000-8000-000000000003'), 1::bigint, 'admin insert succeeds on project_translations');
update public.project_translations set needs_review = true where id = 'a2100000-0000-4000-8000-000000000003';
select is((select needs_review from public.project_translations where id = 'a2100000-0000-4000-8000-000000000003'), true, 'admin update succeeds on project_translations');
delete from public.project_translations where id = 'a2100000-0000-4000-8000-000000000003';
select is((select count(*) from public.project_translations where id = 'a2100000-0000-4000-8000-000000000003'), 0::bigint, 'admin delete succeeds on project_translations');
reset role;

-- --- team_member_translations --------------------------------------------

select set_config('request.jwt.claims', $json${"role":"anon"}$json$, true);
set local role anon;
select is((select count(*) from public.team_member_translations where id = 'a3100000-0000-4000-8000-000000000001'), 1::bigint, 'anon reads a translation of a published team_member');
select is((select count(*) from public.team_member_translations where id = 'a3100000-0000-4000-8000-000000000002'), 0::bigint, 'anon cannot read a translation of a draft team_member');
select throws_ok($sql$ insert into public.team_member_translations (id, member_id, locale, role) values ('a3100000-0000-4000-8000-0000000000f1', 'a3000000-0000-4000-8000-000000000001', 'pl', 'Anon role (fictional)') $sql$, '42501', NULL, 'anon insert denied on team_member_translations');
select throws_ok($sql$ update public.team_member_translations set needs_review = true where id = 'a3100000-0000-4000-8000-000000000001' $sql$, '42501', NULL, 'anon update denied on team_member_translations');
select throws_ok($sql$ delete from public.team_member_translations where id = 'a3100000-0000-4000-8000-000000000001' $sql$, '42501', NULL, 'anon delete denied on team_member_translations');
reset role;

select set_config('request.jwt.claims', $json${"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}$json$, true);
set local role authenticated;
select throws_ok($sql$ insert into public.team_member_translations (id, member_id, locale, role) values ('a3100000-0000-4000-8000-0000000000f2', 'a3000000-0000-4000-8000-000000000001', 'pl', 'Nonadmin role (fictional)') $sql$, '42501', NULL, 'non-admin insert denied on team_member_translations');
with u as (update public.team_member_translations set needs_review = true where id = 'a3100000-0000-4000-8000-000000000001' returning 1)
select is((select count(*) from u), 0::bigint, 'non-admin update affects no team_member_translations rows');
with d as (delete from public.team_member_translations where id = 'a3100000-0000-4000-8000-000000000001' returning 1)
select is((select count(*) from d), 0::bigint, 'non-admin delete affects no team_member_translations rows');
reset role;

select set_config('request.jwt.claims', $json${"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{"role":"admin"}}$json$, true);
set local role authenticated;
select is((select count(*) from public.team_member_translations where id = 'a3100000-0000-4000-8000-000000000002'), 1::bigint, 'admin reads a translation of a draft team_member');
insert into public.team_member_translations (id, member_id, locale, role) values ('a3100000-0000-4000-8000-000000000003', 'a3000000-0000-4000-8000-000000000003', 'en', 'RLS Admin Role (fictional)');
select is((select count(*) from public.team_member_translations where id = 'a3100000-0000-4000-8000-000000000003'), 1::bigint, 'admin insert succeeds on team_member_translations');
update public.team_member_translations set needs_review = true where id = 'a3100000-0000-4000-8000-000000000003';
select is((select needs_review from public.team_member_translations where id = 'a3100000-0000-4000-8000-000000000003'), true, 'admin update succeeds on team_member_translations');
delete from public.team_member_translations where id = 'a3100000-0000-4000-8000-000000000003';
select is((select count(*) from public.team_member_translations where id = 'a3100000-0000-4000-8000-000000000003'), 0::bigint, 'admin delete succeeds on team_member_translations');
reset role;

-- --- publication_translations --------------------------------------------

select set_config('request.jwt.claims', $json${"role":"anon"}$json$, true);
set local role anon;
select is((select count(*) from public.publication_translations where id = 'a4100000-0000-4000-8000-000000000001'), 1::bigint, 'anon reads a translation of a published publication');
select is((select count(*) from public.publication_translations where id = 'a4100000-0000-4000-8000-000000000002'), 0::bigint, 'anon cannot read a translation of a draft publication');
select throws_ok($sql$ insert into public.publication_translations (id, publication_id, locale, title) values ('a4100000-0000-4000-8000-0000000000f1', 'a4000000-0000-4000-8000-000000000001', 'pl', 'Anon insert (fictional)') $sql$, '42501', NULL, 'anon insert denied on publication_translations');
select throws_ok($sql$ update public.publication_translations set needs_review = true where id = 'a4100000-0000-4000-8000-000000000001' $sql$, '42501', NULL, 'anon update denied on publication_translations');
select throws_ok($sql$ delete from public.publication_translations where id = 'a4100000-0000-4000-8000-000000000001' $sql$, '42501', NULL, 'anon delete denied on publication_translations');
reset role;

select set_config('request.jwt.claims', $json${"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}$json$, true);
set local role authenticated;
select throws_ok($sql$ insert into public.publication_translations (id, publication_id, locale, title) values ('a4100000-0000-4000-8000-0000000000f2', 'a4000000-0000-4000-8000-000000000001', 'pl', 'Nonadmin insert (fictional)') $sql$, '42501', NULL, 'non-admin insert denied on publication_translations');
with u as (update public.publication_translations set needs_review = true where id = 'a4100000-0000-4000-8000-000000000001' returning 1)
select is((select count(*) from u), 0::bigint, 'non-admin update affects no publication_translations rows');
with d as (delete from public.publication_translations where id = 'a4100000-0000-4000-8000-000000000001' returning 1)
select is((select count(*) from d), 0::bigint, 'non-admin delete affects no publication_translations rows');
reset role;

select set_config('request.jwt.claims', $json${"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{"role":"admin"}}$json$, true);
set local role authenticated;
select is((select count(*) from public.publication_translations where id = 'a4100000-0000-4000-8000-000000000002'), 1::bigint, 'admin reads a translation of a draft publication');
insert into public.publication_translations (id, publication_id, locale, title) values ('a4100000-0000-4000-8000-000000000003', 'a4000000-0000-4000-8000-000000000003', 'en', 'RLS Admin Publication Insert (fictional)');
select is((select count(*) from public.publication_translations where id = 'a4100000-0000-4000-8000-000000000003'), 1::bigint, 'admin insert succeeds on publication_translations');
update public.publication_translations set needs_review = true where id = 'a4100000-0000-4000-8000-000000000003';
select is((select needs_review from public.publication_translations where id = 'a4100000-0000-4000-8000-000000000003'), true, 'admin update succeeds on publication_translations');
delete from public.publication_translations where id = 'a4100000-0000-4000-8000-000000000003';
select is((select count(*) from public.publication_translations where id = 'a4100000-0000-4000-8000-000000000003'), 0::bigint, 'admin delete succeeds on publication_translations');
reset role;

-- --- publication_files ----------------------------------------------------

select set_config('request.jwt.claims', $json${"role":"anon"}$json$, true);
set local role anon;
select is((select count(*) from public.publication_files where id = 'a4200000-0000-4000-8000-000000000001'), 1::bigint, 'anon reads a file of a published publication');
select is((select count(*) from public.publication_files where id = 'a4200000-0000-4000-8000-000000000002'), 0::bigint, 'anon cannot read a file of a draft publication');
select throws_ok($sql$ insert into public.publication_files (id, publication_id, locale, storage_path) values ('a4200000-0000-4000-8000-0000000000f1', 'a4000000-0000-4000-8000-000000000001', 'pl', 'fixtures/rls/anon-file.pdf') $sql$, '42501', NULL, 'anon insert denied on publication_files');
select throws_ok($sql$ update public.publication_files set label = 'Anon update' where id = 'a4200000-0000-4000-8000-000000000001' $sql$, '42501', NULL, 'anon update denied on publication_files');
select throws_ok($sql$ delete from public.publication_files where id = 'a4200000-0000-4000-8000-000000000001' $sql$, '42501', NULL, 'anon delete denied on publication_files');
reset role;

select set_config('request.jwt.claims', $json${"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}$json$, true);
set local role authenticated;
select is((select count(*) from public.publication_files where id = 'a4200000-0000-4000-8000-000000000001'), 1::bigint, 'non-admin authenticated reads a file of a published publication');
select throws_ok($sql$ insert into public.publication_files (id, publication_id, locale, storage_path) values ('a4200000-0000-4000-8000-0000000000f2', 'a4000000-0000-4000-8000-000000000001', 'pl', 'fixtures/rls/nonadmin-file.pdf') $sql$, '42501', NULL, 'non-admin insert denied on publication_files');
with u as (update public.publication_files set label = 'Nonadmin update' where id = 'a4200000-0000-4000-8000-000000000001' returning 1)
select is((select count(*) from u), 0::bigint, 'non-admin update affects no publication_files rows');
with d as (delete from public.publication_files where id = 'a4200000-0000-4000-8000-000000000001' returning 1)
select is((select count(*) from d), 0::bigint, 'non-admin delete affects no publication_files rows');
reset role;

select set_config('request.jwt.claims', $json${"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{"role":"admin"}}$json$, true);
set local role authenticated;
select is((select count(*) from public.publication_files where id = 'a4200000-0000-4000-8000-000000000002'), 1::bigint, 'admin reads a file of a draft publication');
insert into public.publication_files (id, publication_id, locale, label, storage_path) values ('a4200000-0000-4000-8000-000000000003', 'a4000000-0000-4000-8000-000000000003', 'en', 'RLS Admin File', 'fixtures/rls/admin-file.pdf');
select is((select count(*) from public.publication_files where id = 'a4200000-0000-4000-8000-000000000003'), 1::bigint, 'admin insert succeeds on publication_files');
update public.publication_files set label = 'RLS Admin File Updated' where id = 'a4200000-0000-4000-8000-000000000003';
select is((select label from public.publication_files where id = 'a4200000-0000-4000-8000-000000000003'), 'RLS Admin File Updated', 'admin update succeeds on publication_files');
delete from public.publication_files where id = 'a4200000-0000-4000-8000-000000000003';
select is((select count(*) from public.publication_files where id = 'a4200000-0000-4000-8000-000000000003'), 0::bigint, 'admin delete succeeds on publication_files');
reset role;

-- --- organization_document_translations ----------------------------------

select set_config('request.jwt.claims', $json${"role":"anon"}$json$, true);
set local role anon;
select is((select count(*) from public.organization_document_translations where id = 'a5100000-0000-4000-8000-000000000001'), 1::bigint, 'anon reads a translation of a published organization_document');
select is((select count(*) from public.organization_document_translations where id = 'a5100000-0000-4000-8000-000000000002'), 0::bigint, 'anon cannot read a translation of a draft organization_document');
select throws_ok($sql$ insert into public.organization_document_translations (id, document_id, locale, title) values ('a5100000-0000-4000-8000-0000000000f1', 'a5000000-0000-4000-8000-000000000001', 'pl', 'Anon insert (fictional)') $sql$, '42501', NULL, 'anon insert denied on organization_document_translations');
select throws_ok($sql$ update public.organization_document_translations set needs_review = true where id = 'a5100000-0000-4000-8000-000000000001' $sql$, '42501', NULL, 'anon update denied on organization_document_translations');
select throws_ok($sql$ delete from public.organization_document_translations where id = 'a5100000-0000-4000-8000-000000000001' $sql$, '42501', NULL, 'anon delete denied on organization_document_translations');
reset role;

select set_config('request.jwt.claims', $json${"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}$json$, true);
set local role authenticated;
select is((select count(*) from public.organization_document_translations where id = 'a5100000-0000-4000-8000-000000000001'), 1::bigint, 'non-admin authenticated reads a translation of a published organization_document');
select throws_ok($sql$ insert into public.organization_document_translations (id, document_id, locale, title) values ('a5100000-0000-4000-8000-0000000000f2', 'a5000000-0000-4000-8000-000000000001', 'pl', 'Nonadmin insert (fictional)') $sql$, '42501', NULL, 'non-admin insert denied on organization_document_translations');
with u as (update public.organization_document_translations set needs_review = true where id = 'a5100000-0000-4000-8000-000000000001' returning 1)
select is((select count(*) from u), 0::bigint, 'non-admin update affects no organization_document_translations rows');
with d as (delete from public.organization_document_translations where id = 'a5100000-0000-4000-8000-000000000001' returning 1)
select is((select count(*) from d), 0::bigint, 'non-admin delete affects no organization_document_translations rows');
reset role;

select set_config('request.jwt.claims', $json${"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{"role":"admin"}}$json$, true);
set local role authenticated;
select is((select count(*) from public.organization_document_translations where id = 'a5100000-0000-4000-8000-000000000002'), 1::bigint, 'admin reads a translation of a draft organization_document');
insert into public.organization_document_translations (id, document_id, locale, title) values ('a5100000-0000-4000-8000-000000000003', 'a5000000-0000-4000-8000-000000000003', 'en', 'RLS Admin Document Insert (fictional)');
select is((select count(*) from public.organization_document_translations where id = 'a5100000-0000-4000-8000-000000000003'), 1::bigint, 'admin insert succeeds on organization_document_translations');
update public.organization_document_translations set needs_review = true where id = 'a5100000-0000-4000-8000-000000000003';
select is((select needs_review from public.organization_document_translations where id = 'a5100000-0000-4000-8000-000000000003'), true, 'admin update succeeds on organization_document_translations');
delete from public.organization_document_translations where id = 'a5100000-0000-4000-8000-000000000003';
select is((select count(*) from public.organization_document_translations where id = 'a5100000-0000-4000-8000-000000000003'), 0::bigint, 'admin delete succeeds on organization_document_translations');
reset role;

-- ===========================================================================
-- calendar_event_links (13 assertions)
-- Public read is allowed only for unlinked rows or rows whose project is
-- published (architecture §4: public output must not link a draft project).
-- ===========================================================================

select set_config('request.jwt.claims', $json${"role":"anon"}$json$, true);
set local role anon;
select is((select count(*) from public.calendar_event_links where id = 'a6000000-0000-4000-8000-000000000001'), 1::bigint, 'anon reads an unlinked calendar event mapping');
select is((select count(*) from public.calendar_event_links where id = 'a6000000-0000-4000-8000-000000000002'), 1::bigint, 'anon reads a mapping to a published project');
select is((select count(*) from public.calendar_event_links where id = 'a6000000-0000-4000-8000-000000000003'), 0::bigint, 'anon cannot read a mapping to a draft project');
select throws_ok($sql$ insert into public.calendar_event_links (id, calendar_id, google_event_id) values ('a6000000-0000-4000-8000-0000000000f1', 'rls-calendar@example.org', 'rls-anon-event') $sql$, '42501', NULL, 'anon insert denied on calendar_event_links');
select throws_ok($sql$ update public.calendar_event_links set project_id = null where id = 'a6000000-0000-4000-8000-000000000002' $sql$, '42501', NULL, 'anon update denied on calendar_event_links');
select throws_ok($sql$ delete from public.calendar_event_links where id = 'a6000000-0000-4000-8000-000000000002' $sql$, '42501', NULL, 'anon delete denied on calendar_event_links');
reset role;

select set_config('request.jwt.claims', $json${"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}$json$, true);
set local role authenticated;
select is((select count(*) from public.calendar_event_links where id = 'a6000000-0000-4000-8000-000000000002'), 1::bigint, 'non-admin authenticated reads a mapping to a published project');
select throws_ok($sql$ insert into public.calendar_event_links (id, calendar_id, google_event_id) values ('a6000000-0000-4000-8000-0000000000f2', 'rls-calendar@example.org', 'rls-nonadmin-event') $sql$, '42501', NULL, 'non-admin insert denied on calendar_event_links');
with u as (update public.calendar_event_links set project_id = null where id = 'a6000000-0000-4000-8000-000000000002' returning 1)
select is((select count(*) from u), 0::bigint, 'non-admin update affects no calendar_event_links rows');
with d as (delete from public.calendar_event_links where id = 'a6000000-0000-4000-8000-000000000002' returning 1)
select is((select count(*) from d), 0::bigint, 'non-admin delete affects no calendar_event_links rows');
reset role;

select set_config('request.jwt.claims', $json${"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{"role":"admin"}}$json$, true);
set local role authenticated;
select is((select count(*) from public.calendar_event_links where id in ('a6000000-0000-4000-8000-000000000001', 'a6000000-0000-4000-8000-000000000002', 'a6000000-0000-4000-8000-000000000003')), 3::bigint, 'admin reads all calendar event mappings including draft links');
insert into public.calendar_event_links (id, calendar_id, google_event_id) values ('a6000000-0000-4000-8000-000000000004', 'rls-calendar@example.org', 'rls-admin-event');
select is((select count(*) from public.calendar_event_links where id = 'a6000000-0000-4000-8000-000000000004'), 1::bigint, 'admin insert succeeds on calendar_event_links');
update public.calendar_event_links set project_id = 'a2000000-0000-4000-8000-000000000001' where id = 'a6000000-0000-4000-8000-000000000004';
select is((select project_id from public.calendar_event_links where id = 'a6000000-0000-4000-8000-000000000004'), 'a2000000-0000-4000-8000-000000000001'::uuid, 'admin update succeeds on calendar_event_links');
delete from public.calendar_event_links where id = 'a6000000-0000-4000-8000-000000000004';
select is((select count(*) from public.calendar_event_links where id = 'a6000000-0000-4000-8000-000000000004'), 0::bigint, 'admin delete succeeds on calendar_event_links');
reset role;

select * from finish();
rollback;
