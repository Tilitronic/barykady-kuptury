-- T-012 schema tests (pgTAP).
--
-- Why these assertions exist:
--   * architecture.md §4 fixes the V1 content model and the event-project
--     relation; the schema must enforce it declaratively (AGENTS.md rule 5).
--   * architecture.md §6 requires deny-by-default: every content table starts
--     with RLS enabled and zero policies (policies are authored in T-013).
--   * docs/TESTING.md §3/§6 require proven constraints, not app-enforced ones.
--
-- The whole file runs inside one transaction and rolls back, so it never
-- mutates seeded data. Fixture UUIDs below are local to this file.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(47);
-- ---------------------------------------------------------------------------
-- Enumerated domains
-- ---------------------------------------------------------------------------

select is(
  (select array_agg(enumlabel::text order by enumsortorder)
     from pg_enum where enumtypid = 'public.content_status'::regtype),
  array['draft', 'published', 'archived'],
  'content_status exposes exactly draft/published/archived'
);

select is(
  (select array_agg(enumlabel::text order by enumsortorder)
     from pg_enum where enumtypid = 'public.content_locale'::regtype),
  array['en', 'pl', 'uk'],
  'content_locale exposes exactly en/pl/uk'
);

-- ---------------------------------------------------------------------------
-- Tables exist (architecture.md §4)
-- ---------------------------------------------------------------------------

select has_table('public', 'site_pages', 'site_pages exists');
select has_table('public', 'site_page_translations', 'site_page_translations exists');
select has_table('public', 'projects', 'projects exists');
select has_table('public', 'project_translations', 'project_translations exists');
select has_table('public', 'team_members', 'team_members exists');
select has_table('public', 'team_member_translations', 'team_member_translations exists');
select has_table('public', 'publications', 'publications exists');
select has_table('public', 'publication_translations', 'publication_translations exists');
select has_table('public', 'publication_files', 'publication_files exists');
select has_table('public', 'organization_documents', 'organization_documents exists');
select has_table('public', 'organization_document_translations', 'organization_document_translations exists');
select has_table('public', 'calendar_event_links', 'calendar_event_links exists');

-- ---------------------------------------------------------------------------
-- Deny-by-default: RLS enabled on every content table, zero policies (T-013)
-- ---------------------------------------------------------------------------

select is((select relrowsecurity from pg_class where oid = 'public.site_pages'::regclass), true, 'RLS enabled on site_pages');
select is((select relrowsecurity from pg_class where oid = 'public.site_page_translations'::regclass), true, 'RLS enabled on site_page_translations');
select is((select relrowsecurity from pg_class where oid = 'public.projects'::regclass), true, 'RLS enabled on projects');
select is((select relrowsecurity from pg_class where oid = 'public.project_translations'::regclass), true, 'RLS enabled on project_translations');
select is((select relrowsecurity from pg_class where oid = 'public.team_members'::regclass), true, 'RLS enabled on team_members');
select is((select relrowsecurity from pg_class where oid = 'public.team_member_translations'::regclass), true, 'RLS enabled on team_member_translations');
select is((select relrowsecurity from pg_class where oid = 'public.publications'::regclass), true, 'RLS enabled on publications');
select is((select relrowsecurity from pg_class where oid = 'public.publication_translations'::regclass), true, 'RLS enabled on publication_translations');
select is((select relrowsecurity from pg_class where oid = 'public.publication_files'::regclass), true, 'RLS enabled on publication_files');
select is((select relrowsecurity from pg_class where oid = 'public.organization_documents'::regclass), true, 'RLS enabled on organization_documents');
select is((select relrowsecurity from pg_class where oid = 'public.organization_document_translations'::regclass), true, 'RLS enabled on organization_document_translations');
select is((select relrowsecurity from pg_class where oid = 'public.calendar_event_links'::regclass), true, 'RLS enabled on calendar_event_links');

-- ---------------------------------------------------------------------------
-- Translation identity: one row per parent+locale and slug unique per locale
-- ---------------------------------------------------------------------------

insert into public.projects (id, status)
values ('22222222-2222-4222-8222-000000000001', 'draft');

insert into public.project_translations (project_id, locale, slug, title)
values ('22222222-2222-4222-8222-000000000001', 'en', 'test-project-en', 'Test project (fictional)');

select throws_ok(
  $sql$ insert into public.project_translations (project_id, locale, slug, title)
        values ('22222222-2222-4222-8222-000000000001', 'en', 'test-project-en-duplicate', 'Duplicate locale (fictional)') $sql$,
  '23505',
  NULL,
  'a second translation for the same (project_id, locale) is rejected'
);

insert into public.projects (id, status)
values ('22222222-2222-4222-8222-000000000002', 'draft');

select throws_ok(
  $sql$ insert into public.project_translations (project_id, locale, slug, title)
        values ('22222222-2222-4222-8222-000000000002', 'en', 'test-project-en', 'Duplicate slug (fictional)') $sql$,
  '23505',
  NULL,
  'the same slug cannot be reused within one locale by another project'
);

-- ---------------------------------------------------------------------------
-- Event identity: unique (calendar_id, google_event_id), never title/date
-- ---------------------------------------------------------------------------

insert into public.calendar_event_links (id, calendar_id, google_event_id, project_id)
values (
  '66666666-6666-4666-8666-000000000001',
  'test-calendar@example.org',
  'fictional-event-1',
  '22222222-2222-4222-8222-000000000001'
);

select throws_ok(
  $sql$ insert into public.calendar_event_links (id, calendar_id, google_event_id)
        values ('66666666-6666-4666-8666-000000000002', 'test-calendar@example.org', 'fictional-event-1') $sql$,
  '23505',
  NULL,
  'one Google event cannot be linked twice (unique calendar_id + google_event_id)'
);

-- ---------------------------------------------------------------------------
-- ON DELETE SET NULL keeps the event, cascade removes translations
-- ---------------------------------------------------------------------------

select is(
  (select count(*) from public.project_translations
    where project_id = '22222222-2222-4222-8222-000000000001'),
  1::bigint,
  'project translation exists before the parent is deleted'
);

delete from public.projects where id = '22222222-2222-4222-8222-000000000001';

select is(
  (select project_id from public.calendar_event_links
    where id = '66666666-6666-4666-8666-000000000001'),
  null::uuid,
  'deleting a project unlinks calendar_event_links.project_id'
);

select is(
  (select count(*) from public.calendar_event_links
    where id = '66666666-6666-4666-8666-000000000001'),
  1::bigint,
  'the calendar_event_links row survives the project delete'
);

select is(
  (select count(*) from public.project_translations
    where project_id = '22222222-2222-4222-8222-000000000001'),
  0::bigint,
  'project_translations cascade on project delete'
);

-- ---------------------------------------------------------------------------
-- Remaining translation/file tables cascade on parent delete
-- ---------------------------------------------------------------------------

insert into public.site_pages (id, page_key) values ('11111111-1111-4111-8111-000000000001', 'test-about');
insert into public.site_page_translations (page_id, locale, slug, title, body)
values ('11111111-1111-4111-8111-000000000001', 'en', 'test-about', 'About (fictional)', 'Fixture body.');
delete from public.site_pages where id = '11111111-1111-4111-8111-000000000001';
select is(
  (select count(*) from public.site_page_translations where page_id = '11111111-1111-4111-8111-000000000001'),
  0::bigint,
  'site_page_translations cascade on site page delete'
);

insert into public.team_members (id, name) values ('33333333-3333-4333-8333-000000000001', 'Test Person (fictional)');
insert into public.team_member_translations (member_id, locale, slug, role)
values ('33333333-3333-4333-8333-000000000001', 'en', 'test-person', 'Fixture role');
delete from public.team_members where id = '33333333-3333-4333-8333-000000000001';
select is(
  (select count(*) from public.team_member_translations where member_id = '33333333-3333-4333-8333-000000000001'),
  0::bigint,
  'team_member_translations cascade on member delete'
);

insert into public.publications (id, status) values ('44444444-4444-4444-8444-000000000001', 'published');
insert into public.publication_translations (publication_id, locale, slug, title)
values ('44444444-4444-4444-8444-000000000001', 'en', 'test-publication', 'Test publication (fictional)');
insert into public.publication_files (publication_id, locale, label, storage_path)
values ('44444444-4444-4444-8444-000000000001', 'en', 'English PDF', 'fixtures/publications/test-en.pdf');

select throws_ok(
  $sql$ insert into public.publication_files (publication_id, locale, label, storage_path)
        values ('44444444-4444-4444-8444-000000000001', 'en', 'Duplicate English PDF', 'fixtures/publications/test-en-again.pdf') $sql$,
  '23505',
  NULL,
  'a publication cannot hold two files for the same locale'
);

delete from public.publications where id = '44444444-4444-4444-8444-000000000001';
select is(
  (select count(*) from public.publication_translations where publication_id = '44444444-4444-4444-8444-000000000001'),
  0::bigint,
  'publication_translations cascade on publication delete'
);
select is(
  (select count(*) from public.publication_files where publication_id = '44444444-4444-4444-8444-000000000001'),
  0::bigint,
  'publication_files cascade on publication delete'
);

insert into public.organization_documents (id, document_type, language, storage_path)
values ('55555555-5555-4555-8555-000000000001', 'statute', 'en', 'fixtures/documents/test-statute.pdf');
insert into public.organization_document_translations (document_id, locale, slug, title)
values ('55555555-5555-4555-8555-000000000001', 'en', 'test-statute', 'Test statute (fictional)');
delete from public.organization_documents where id = '55555555-5555-4555-8555-000000000001';
select is(
  (select count(*) from public.organization_document_translations where document_id = '55555555-5555-4555-8555-000000000001'),
  0::bigint,
  'organization_document_translations cascade on document delete'
);

-- ---------------------------------------------------------------------------
-- updated_at trigger and declarative storage-path rule
-- ---------------------------------------------------------------------------

insert into public.projects (id, status)
values ('22222222-2222-4222-8222-000000000003', 'draft');

create temporary table test_updated_at_before as
  select updated_at from public.projects where id = '22222222-2222-4222-8222-000000000003';

select pg_sleep(0.05);

update public.projects
   set status = 'archived'
 where id = '22222222-2222-4222-8222-000000000003';

select ok(
  (select p.updated_at > b.updated_at
     from public.projects p, test_updated_at_before b
    where p.id = '22222222-2222-4222-8222-000000000003'),
  'updated_at advances when a row is updated (trigger)'
);

select throws_ok(
  $sql$ insert into public.projects (status, cover_path)
        values ('draft', 'https://example.org/cover.jpg') $sql$,
  '23514',
  NULL,
  'projects.cover_path rejects a URL (a Storage path is required)'
);

-- ---------------------------------------------------------------------------
-- T-017 (D-12): a document is either file-based or in-app readable text
-- ---------------------------------------------------------------------------

select has_column(
  'public', 'organization_document_translations', 'body',
  'organization_document_translations carries the optional in-app body'
);

select col_is_null(
  'public', 'organization_documents', 'storage_path',
  'organization_documents.storage_path is nullable (in-app text has no file)'
);

select col_is_null(
  'public', 'organization_documents', 'language',
  'organization_documents.language is nullable (in-app text has no file language)'
);

select lives_ok(
  $sql$ insert into public.organization_documents (id, status, document_type, storage_path, language)
        values ('55555555-5555-4555-8555-000000000002', 'published', 'regulations', null, null) $sql$,
  'a text-only organization_document inserts without storage_path/language'
);

insert into public.organization_document_translations (document_id, locale, slug, title, body)
values ('55555555-5555-4555-8555-000000000002', 'en', 'test-regulations',
        'Test regulations (fictional)', E'## § 1\n\nFixture body.\n\n## § 2\n\nMore text.');

select is(
  (select body from public.organization_document_translations
    where document_id = '55555555-5555-4555-8555-000000000002'),
  E'## § 1\n\nFixture body.\n\n## § 2\n\nMore text.',
  'the in-app body round-trips unchanged on the translation'
);

delete from public.organization_documents where id = '55555555-5555-4555-8555-000000000002';

select is(
  (select count(*) from public.organization_document_translations
    where document_id = '55555555-5555-4555-8555-000000000002'),
  0::bigint,
  'a text document''s translations cascade on document delete'
);

select * from finish();
rollback;
