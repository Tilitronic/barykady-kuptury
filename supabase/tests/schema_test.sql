-- T-012 schema tests (pgTAP).
--
-- Why these assertions exist:
--   * architecture.md §4 fixes the V1 content model and the event-project
--     relation; the schema must enforce it declaratively (AGENTS.md rule 5).
--   * architecture.md §6 requires deny-by-default: every content table starts
--     with RLS enabled and zero policies (policies are authored in T-013).
--   * docs/TESTING.md §3/§6 require proven constraints, not app-enforced ones.
--   * docs/tickets/DECISIONS.md D-24 — one canonical slug per root entity,
--     shared by every locale; translation tables must not carry a slug.
--
-- The whole file runs inside one transaction and rolls back, so it never
-- mutates seeded data. Fixture UUIDs below are local to this file.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(63);
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
-- Canonical identity (D-24): the root row carries one globally unique slug.
-- Translation rows carry no slug and stay one row per parent+locale.
-- ---------------------------------------------------------------------------

select has_column('public', 'projects', 'slug',
  'projects carries the canonical slug (D-24)');
select has_column('public', 'publications', 'slug',
  'publications carries the canonical slug (D-24)');
select has_column('public', 'organization_documents', 'slug',
  'organization_documents carries the canonical slug (D-24)');

select col_not_null('public', 'projects', 'slug', 'projects.slug is required');
select col_not_null('public', 'publications', 'slug', 'publications.slug is required');
select col_not_null('public', 'organization_documents', 'slug',
  'organization_documents.slug is required');

-- Identity is shared by every locale, so a localized slug cannot exist: the
-- same canonical slug serves /en/, /pl/ and /uk/ URLs (architecture §8).
select hasnt_column('public', 'project_translations', 'slug',
  'project_translations has no localized slug');
select hasnt_column('public', 'publication_translations', 'slug',
  'publication_translations has no localized slug');
select hasnt_column('public', 'organization_document_translations', 'slug',
  'organization_document_translations has no localized slug');
select hasnt_column('public', 'site_page_translations', 'slug',
  'site_page_translations has no localized slug');
select hasnt_column('public', 'team_member_translations', 'slug',
  'team_member_translations has no localized slug');

insert into public.projects (id, slug, status)
values ('22222222-2222-4222-8222-000000000001', 'test-project-en', 'draft');

insert into public.project_translations (project_id, locale, title)
values ('22222222-2222-4222-8222-000000000001', 'en', 'Test project (fictional)');

select throws_ok(
  $sql$ insert into public.project_translations (project_id, locale, title)
        values ('22222222-2222-4222-8222-000000000001', 'en', 'Duplicate locale (fictional)') $sql$,
  '23505',
  NULL,
  'a second translation for the same (project_id, locale) is rejected'
);

insert into public.projects (id, slug, status)
values ('22222222-2222-4222-8222-000000000002', 'test-project-other', 'draft');

select throws_ok(
  $sql$ insert into public.projects (id, slug, status)
        values ('22222222-2222-4222-8222-000000000009', 'test-project-en', 'draft') $sql$,
  '23505',
  NULL,
  'a canonical project slug is globally unique (not scoped per locale)'
);

select throws_ok(
  $sql$ insert into public.projects (id, slug, status)
        values ('22222222-2222-4222-8222-00000000000a', 'Test-Project', 'draft') $sql$,
  '23514',
  NULL,
  'a project slug rejects uppercase characters'
);

insert into public.publications (id, slug, status)
values ('44444444-4444-4444-8444-000000000010', 'test-publication-canonical', 'draft');

select throws_ok(
  $sql$ insert into public.publications (id, slug, status)
        values ('44444444-4444-4444-8444-000000000011', 'test-publication-canonical', 'draft') $sql$,
  '23505',
  NULL,
  'a canonical publication slug is globally unique'
);

select throws_ok(
  $sql$ insert into public.publications (id, slug, status)
        values ('44444444-4444-4444-8444-000000000012', 'test publication', 'draft') $sql$,
  '23514',
  NULL,
  'a publication slug rejects spaces'
);

insert into public.organization_documents (id, slug, document_type, language, storage_path)
values ('55555555-5555-4555-8555-000000000010', 'test-document-canonical',
        'statute', 'en', 'fixtures/documents/canonical.pdf');

select throws_ok(
  $sql$ insert into public.organization_documents (id, slug, document_type, language, storage_path)
        values ('55555555-5555-4555-8555-000000000011', 'test-document-canonical',
                'statute', 'en', 'fixtures/documents/canonical-duplicate.pdf') $sql$,
  '23505',
  NULL,
  'a canonical organization_document slug is globally unique'
);

select throws_ok(
  $sql$ insert into public.organization_documents (id, slug, document_type, language, storage_path)
        values ('55555555-5555-4555-8555-000000000012', 'test_document',
                'statute', 'en', 'fixtures/documents/canonical-underscore.pdf') $sql$,
  '23514',
  NULL,
  'an organization_document slug rejects underscores'
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
insert into public.site_page_translations (page_id, locale, title, body)
values ('11111111-1111-4111-8111-000000000001', 'en', 'About (fictional)', 'Fixture body.');
delete from public.site_pages where id = '11111111-1111-4111-8111-000000000001';
select is(
  (select count(*) from public.site_page_translations where page_id = '11111111-1111-4111-8111-000000000001'),
  0::bigint,
  'site_page_translations cascade on site page delete'
);

insert into public.team_members (id, name) values ('33333333-3333-4333-8333-000000000001', 'Test Person (fictional)');
insert into public.team_member_translations (member_id, locale, role)
values ('33333333-3333-4333-8333-000000000001', 'en', 'Fixture role');
delete from public.team_members where id = '33333333-3333-4333-8333-000000000001';
select is(
  (select count(*) from public.team_member_translations where member_id = '33333333-3333-4333-8333-000000000001'),
  0::bigint,
  'team_member_translations cascade on member delete'
);

insert into public.publications (id, slug, status)
values ('44444444-4444-4444-8444-000000000001', 'test-publication', 'published');
insert into public.publication_translations (publication_id, locale, title)
values ('44444444-4444-4444-8444-000000000001', 'en', 'Test publication (fictional)');
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

insert into public.organization_documents (id, slug, document_type, language, storage_path)
values ('55555555-5555-4555-8555-000000000001', 'test-statute', 'statute', 'en', 'fixtures/documents/test-statute.pdf');
insert into public.organization_document_translations (document_id, locale, title)
values ('55555555-5555-4555-8555-000000000001', 'en', 'Test statute (fictional)');
delete from public.organization_documents where id = '55555555-5555-4555-8555-000000000001';
select is(
  (select count(*) from public.organization_document_translations where document_id = '55555555-5555-4555-8555-000000000001'),
  0::bigint,
  'organization_document_translations cascade on document delete'
);

-- ---------------------------------------------------------------------------
-- updated_at trigger and declarative storage-path rule
-- ---------------------------------------------------------------------------

insert into public.projects (id, slug, status)
values ('22222222-2222-4222-8222-000000000003', 'test-project-updated-at', 'draft');

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
  $sql$ insert into public.projects (slug, status, cover_path)
        values ('test-cover-path', 'draft', 'https://example.org/cover.jpg') $sql$,
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
  $sql$ insert into public.organization_documents (id, slug, status, document_type, storage_path, language)
        values ('55555555-5555-4555-8555-000000000002', 'test-regulations', 'published', 'regulations', null, null) $sql$,
  'a text-only organization_document inserts without storage_path/language'
);

insert into public.organization_document_translations (document_id, locale, title, body)
values ('55555555-5555-4555-8555-000000000002', 'en',
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
