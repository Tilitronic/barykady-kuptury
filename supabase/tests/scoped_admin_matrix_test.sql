-- T-046 — capability-scoped admin matrix (pgTAP).
--
-- Design authority:
--   * docs/architecture.md §6.1 — root bypass, per-scope allow-in-scope,
--     deny-out-of-scope, zero-scope deny, anon deny, self-escalation
--     unrepresentable, RPC re-checks, and the bucket ↔ scope mapping.
--   * D-17/D-42 — is_admin() is unchanged; has_capability() is the single
--     second enforcement point; app_metadata is the only trusted source.
--   * D-21 — deny-by-default. A scope only opens its own feature.
--
-- Expected RED before the T-046 migrations:
--   * capability_helpers: function does not exist;
--   * every scoped INSERT is denied by the old is_admin()-only policies;
--   * the projects:write RPC succeeds only after scoped_rpc_checks lands.
--
-- Identity simulation follows docs/TESTING.md §3: SET LOCAL ROLE plus
-- request.jwt.claims. The whole file runs in one transaction and rolls back.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(60);

-- ---------------------------------------------------------------------------
-- Fictional fixture: one draft project for the cross-scope read proof
-- ---------------------------------------------------------------------------

insert into public.projects (id, slug, status) values
  ('b2000000-0000-4000-8000-0000000000f0', 'scope-fixture-draft-project', 'draft');
-- T-031 FU2: the published counterpart proves the events:write assignable set
-- keeps the public (published) read and does not widen to drafts.
insert into public.projects (id, slug, status, published_at) values
  ('b2000000-0000-4000-8000-0000000000f1', 'scope-fixture-published-project',
   'published', now());
insert into public.publications (id, slug, status) values
  ('b4000000-0000-4000-8000-0000000000f0', 'scope-fixture-publication', 'draft');
insert into public.organization_documents
  (id, slug, status, document_type, language, storage_path)
values
  ('b5000000-0000-4000-8000-0000000000f0', 'scope-fixture-document', 'draft',
   'report', 'en', 'fixtures/scoped/fixture.pdf');

-- ===========================================================================
-- pages:write
-- ===========================================================================

select set_config('request.jwt.claims',
  $json${"sub":"b1000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"editor","scopes":["pages:write"]}}$json$,
  true);
set local role authenticated;

insert into public.site_pages (id, page_key, status) values
  ('b1000000-0000-4000-8000-000000000101', 'scope-pages-own', 'draft');
select is(
  (select count(*) from public.site_pages
    where id = 'b1000000-0000-4000-8000-000000000101'),
  1::bigint,
  'pages:write may create a site page'
);

update public.site_pages set sort_order = 7
 where id = 'b1000000-0000-4000-8000-000000000101';
select is(
  (select sort_order from public.site_pages
    where id = 'b1000000-0000-4000-8000-000000000101'),
  7,
  'pages:write may update a site page'
);

delete from public.site_pages where id = 'b1000000-0000-4000-8000-000000000101';
select is(
  (select count(*) from public.site_pages
    where id = 'b1000000-0000-4000-8000-000000000101'),
  0::bigint,
  'pages:write may delete a site page'
);

select throws_ok(
  $sql$ insert into public.projects (id, slug, status)
        values ('b1000000-0000-4000-8000-000000000102', 'scope-pages-foreign-project', 'draft') $sql$,
  '42501', NULL,
  'pages:write cannot create a project'
);

select is(
  (select count(*) from public.projects
    where id = 'b2000000-0000-4000-8000-0000000000f0'),
  0::bigint,
  'pages:write cannot read a draft project outside its scope'
);
reset role;

-- ===========================================================================
-- projects:write
-- ===========================================================================

select set_config('request.jwt.claims',
  $json${"sub":"b1000000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{"role":"editor","scopes":["projects:write"]}}$json$,
  true);
set local role authenticated;

insert into public.projects (id, slug, status) values
  ('b2000000-0000-4000-8000-000000000201', 'scope-projects-own', 'draft');
select is(
  (select count(*) from public.projects
    where id = 'b2000000-0000-4000-8000-000000000201'),
  1::bigint,
  'projects:write may create a project'
);

select is(
  (select count(*) from public.projects
    where id = 'b2000000-0000-4000-8000-0000000000f0'),
  1::bigint,
  'projects:write may read its own drafts'
);

select throws_ok(
  $sql$ insert into public.publications (id, slug, status)
        values ('b1000000-0000-4000-8000-000000000202', 'scope-projects-foreign-publication', 'draft') $sql$,
  '42501', NULL,
  'projects:write cannot create a publication'
);
reset role;

-- ===========================================================================
-- publications:write
-- ===========================================================================

select set_config('request.jwt.claims',
  $json${"sub":"b1000000-0000-4000-8000-000000000003","role":"authenticated","app_metadata":{"role":"editor","scopes":["publications:write"]}}$json$,
  true);
set local role authenticated;

insert into public.publications (id, slug, status) values
  ('b4000000-0000-4000-8000-000000000301', 'scope-publications-own', 'draft');
select is(
  (select count(*) from public.publications
    where id = 'b4000000-0000-4000-8000-000000000301'),
  1::bigint,
  'publications:write may create a publication'
);

insert into public.content_assets
  (id, publication_id, locale, storage_path, mime_type, width, height, sha256)
values
  ('b8000000-0000-4000-8000-000000000301', 'b4000000-0000-4000-8000-000000000301',
   'en', 'fixtures/scoped/publication-image.webp', 'image/webp', 10, 10,
   repeat('a', 64));
select is(
  (select count(*) from public.content_assets
    where id = 'b8000000-0000-4000-8000-000000000301'),
  1::bigint,
  'publications:write may manage its own publication-owned image asset'
);

select throws_ok(
  $sql$ insert into public.content_assets
          (id, organization_document_id, locale, storage_path, mime_type,
           width, height, sha256)
        values ('b8000000-0000-4000-8000-000000000302',
                'b5000000-0000-4000-8000-0000000000f0', 'en',
                'fixtures/scoped/foreign-image.webp', 'image/webp', 10, 10,
                repeat('b', 64)) $sql$,
  '42501', NULL,
  'publications:write cannot manage a document-owned image asset'
);

select throws_ok(
  $sql$ insert into public.organization_documents
          (id, slug, status, document_type, language, storage_path)
        values ('b5000000-0000-4000-8000-000000000302', 'scope-publications-foreign-document',
                'draft', 'report', 'en', 'fixtures/scoped/foreign.pdf') $sql$,
  '42501', NULL,
  'publications:write cannot create an organization document'
);

insert into storage.objects (id, bucket_id, name) values
  ('b9000000-0000-4000-8000-000000000303', 'public-documents',
   'fixtures/scoped/publication.pdf');
select is(
  (select count(*) from storage.objects
    where id = 'b9000000-0000-4000-8000-000000000303'),
  1::bigint,
  'publications:write may write a publication file to public-documents'
);

select throws_ok(
  $sql$ insert into storage.objects (id, bucket_id, name)
        values ('b9000000-0000-4000-8000-000000000304', 'public-media',
                'fixtures/scoped/publication-cover.webp') $sql$,
  '42501', NULL,
  'publications:write cannot write to public-media without media:write'
);
reset role;

-- ===========================================================================
-- documents:write
-- ===========================================================================

select set_config('request.jwt.claims',
  $json${"sub":"b1000000-0000-4000-8000-000000000004","role":"authenticated","app_metadata":{"role":"editor","scopes":["documents:write"]}}$json$,
  true);
set local role authenticated;

insert into public.organization_documents
  (id, slug, status, document_type, language, storage_path)
values
  ('b5000000-0000-4000-8000-000000000401', 'scope-documents-own', 'draft',
   'statute', 'en', 'fixtures/scoped/own-statute.pdf');
select is(
  (select count(*) from public.organization_documents
    where id = 'b5000000-0000-4000-8000-000000000401'),
  1::bigint,
  'documents:write may create an organization document'
);

insert into public.content_assets
  (id, organization_document_id, locale, storage_path, mime_type, width, height,
   sha256)
values
  ('b8000000-0000-4000-8000-000000000401',
   'b5000000-0000-4000-8000-000000000401', 'en',
   'fixtures/scoped/document-image.webp', 'image/webp', 10, 10,
   repeat('c', 64));
select is(
  (select count(*) from public.content_assets
    where id = 'b8000000-0000-4000-8000-000000000401'),
  1::bigint,
  'documents:write may manage its own document-owned image asset'
);

select throws_ok(
  $sql$ insert into public.content_assets
          (id, publication_id, locale, storage_path, mime_type, width, height,
           sha256)
        values ('b8000000-0000-4000-8000-000000000402',
                'b4000000-0000-4000-8000-0000000000f0', 'en',
                'fixtures/scoped/document-foreign-image.webp', 'image/webp',
                10, 10, repeat('d', 64)) $sql$,
  '42501', NULL,
  'documents:write cannot manage a publication-owned image asset'
);

select throws_ok(
  $sql$ insert into public.team_members (id, name, status)
        values ('b3000000-0000-4000-8000-000000000402', 'Scoped Foreign Person', 'draft') $sql$,
  '42501', NULL,
  'documents:write cannot create a team member'
);
reset role;

-- ===========================================================================
-- team:write
-- ===========================================================================

select set_config('request.jwt.claims',
  $json${"sub":"b1000000-0000-4000-8000-000000000005","role":"authenticated","app_metadata":{"role":"editor","scopes":["team:write"]}}$json$,
  true);
set local role authenticated;

insert into public.team_members (id, name, status) values
  ('b3000000-0000-4000-8000-000000000501', 'Scoped Team Person', 'draft');
select is(
  (select count(*) from public.team_members
    where id = 'b3000000-0000-4000-8000-000000000501'),
  1::bigint,
  'team:write may create a team member'
);

select throws_ok(
  $sql$ insert into public.site_pages (id, page_key, status)
        values ('b1000000-0000-4000-8000-000000000502', 'scope-team-foreign-page', 'draft') $sql$,
  '42501', NULL,
  'team:write cannot create a site page'
);
reset role;

-- ===========================================================================
-- events:write
-- ===========================================================================

select set_config('request.jwt.claims',
  $json${"sub":"b1000000-0000-4000-8000-000000000006","role":"authenticated","app_metadata":{"role":"editor","scopes":["events:write"]}}$json$,
  true);
set local role authenticated;

insert into public.calendar_event_links
  (id, calendar_id, google_event_id)
values
  ('b6000000-0000-4000-8000-000000000601', 'scope-calendar@example.org',
   'scope-event-own');
select is(
  (select count(*) from public.calendar_event_links
    where id = 'b6000000-0000-4000-8000-000000000601'),
  1::bigint,
  'events:write may create a calendar event link'
);

select throws_ok(
  $sql$ insert into public.projects (id, slug, status)
        values ('b1000000-0000-4000-8000-000000000602', 'scope-events-foreign-project', 'draft') $sql$,
  '42501', NULL,
  'events:write cannot create a project'
);

-- T-031 FU2 — the admin event selector reads the projects table. Keep the
-- §6.1 least-privilege behaviour explicit: published projects are assignable,
-- drafts are not visible to an events:write-only editor.
select is(
  (select count(*) from public.projects
    where id = 'b2000000-0000-4000-8000-0000000000f1'),
  1::bigint,
  'events:write may read published projects in the assignable set'
);

select is(
  (select count(*) from public.projects
    where id = 'b2000000-0000-4000-8000-0000000000f0'),
  0::bigint,
  'events:write cannot read draft projects in the assignable set'
);
reset role;

-- ===========================================================================
-- media:write
-- ===========================================================================

select set_config('request.jwt.claims',
  $json${"sub":"b1000000-0000-4000-8000-000000000007","role":"authenticated","app_metadata":{"role":"editor","scopes":["media:write"]}}$json$,
  true);
set local role authenticated;

insert into storage.objects (id, bucket_id, name) values
  ('b9000000-0000-4000-8000-000000000701', 'public-media',
   'fixtures/scoped/own-cover.webp');
select is(
  (select count(*) from storage.objects
    where id = 'b9000000-0000-4000-8000-000000000701'),
  1::bigint,
  'media:write may write to public-media'
);

select throws_ok(
  $sql$ insert into storage.objects (id, bucket_id, name)
        values ('b9000000-0000-4000-8000-000000000702', 'public-documents',
                'fixtures/scoped/media-foreign.pdf') $sql$,
  '42501', NULL,
  'media:write cannot write a document to public-documents'
);
reset role;

-- ===========================================================================
-- importer
-- ===========================================================================

select set_config('request.jwt.claims',
  $json${"sub":"b1000000-0000-4000-8000-000000000008","role":"authenticated","app_metadata":{"role":"editor","scopes":["importer"]}}$json$,
  true);
set local role authenticated;

insert into public.content_sync_jobs (id, kind, locale, request) values
  ('b7000000-0000-4000-8000-000000000801', 'publication', 'en', '{}'::jsonb);
select is(
  (select count(*) from public.content_sync_jobs
    where id = 'b7000000-0000-4000-8000-000000000801'),
  1::bigint,
  'importer may create an import/sync job'
);

select throws_ok(
  $sql$ insert into public.publications (id, slug, status)
        values ('b1000000-0000-4000-8000-000000000802', 'scope-importer-foreign-publication', 'draft') $sql$,
  '42501', NULL,
  'importer alone cannot create publication content'
);

insert into storage.objects (id, bucket_id, name) values
  ('b9000000-0000-4000-8000-000000000803', 'content-sources',
   'fixtures/scoped/source.docx');
select is(
  (select count(*) from storage.objects
    where id = 'b9000000-0000-4000-8000-000000000803'),
  1::bigint,
  'importer may write a private source original'
);

select throws_ok(
  $sql$ insert into storage.objects (id, bucket_id, name)
        values ('b9000000-0000-4000-8000-000000000804', 'public-media',
                'fixtures/scoped/importer-foreign.webp') $sql$,
  '42501', NULL,
  'importer cannot write public media without media:write'
);
reset role;

-- ===========================================================================
-- Anonymous: no scope, no write, no draft read
-- ===========================================================================

select set_config('request.jwt.claims', $json${"role":"anon"}$json$, true);
set local role anon;

select throws_ok($sql$ insert into public.site_pages (id, page_key, status)
  values ('b1000000-0000-4000-8000-000000000901', 'scope-anon-page', 'draft') $sql$,
  '42501', NULL, 'anon cannot create a site page');
select throws_ok($sql$ insert into public.projects (id, slug, status)
  values ('b1000000-0000-4000-8000-000000000902', 'scope-anon-project', 'draft') $sql$,
  '42501', NULL, 'anon cannot create a project');
select throws_ok($sql$ insert into public.publications (id, slug, status)
  values ('b1000000-0000-4000-8000-000000000903', 'scope-anon-publication', 'draft') $sql$,
  '42501', NULL, 'anon cannot create a publication');
select throws_ok($sql$ insert into public.organization_documents
  (id, slug, status, document_type, language, storage_path)
  values ('b1000000-0000-4000-8000-000000000904', 'scope-anon-document',
          'draft', 'report', 'en', 'fixtures/scoped/anon.pdf') $sql$,
  '42501', NULL, 'anon cannot create an organization document');
select throws_ok($sql$ insert into public.team_members (id, name, status)
  values ('b1000000-0000-4000-8000-000000000905', 'Scoped Anon Person', 'draft') $sql$,
  '42501', NULL, 'anon cannot create a team member');
select throws_ok($sql$ insert into public.calendar_event_links
  (id, calendar_id, google_event_id)
  values ('b1000000-0000-4000-8000-000000000906', 'scope-calendar@example.org',
          'scope-anon-event') $sql$,
  '42501', NULL, 'anon cannot create a calendar event link');
select throws_ok($sql$ insert into storage.objects (id, bucket_id, name)
  values ('b9000000-0000-4000-8000-000000000907', 'public-media',
          'fixtures/scoped/anon.webp') $sql$,
  '42501', NULL, 'anon cannot write public media');
select throws_ok($sql$ insert into public.content_sync_jobs (id, kind, locale, request)
  values ('b1000000-0000-4000-8000-000000000908', 'publication', 'en', '{}'::jsonb) $sql$,
  '42501', NULL, 'anon cannot create an import/sync job');
reset role;

-- ===========================================================================
-- Root: role=admin bypasses every scoped predicate (D-17 unchanged)
-- ===========================================================================

select set_config('request.jwt.claims',
  $json${"sub":"b1000000-0000-4000-8000-000000000999","role":"authenticated","app_metadata":{"role":"admin"}}$json$,
  true);
set local role authenticated;

insert into public.site_pages (id, page_key, status)
  values ('b1000000-0000-4000-8000-000000000a01', 'scope-root-page', 'draft');
select is((select count(*) from public.site_pages
  where id = 'b1000000-0000-4000-8000-000000000a01'), 1::bigint,
  'root may create a site page');

insert into public.projects (id, slug, status)
  values ('b1000000-0000-4000-8000-000000000a02', 'scope-root-project', 'draft');
select is((select count(*) from public.projects
  where id = 'b1000000-0000-4000-8000-000000000a02'), 1::bigint,
  'root may create a project');

insert into public.publications (id, slug, status)
  values ('b1000000-0000-4000-8000-000000000a03', 'scope-root-publication', 'draft');
select is((select count(*) from public.publications
  where id = 'b1000000-0000-4000-8000-000000000a03'), 1::bigint,
  'root may create a publication');

insert into public.organization_documents
  (id, slug, status, document_type, language, storage_path)
values ('b1000000-0000-4000-8000-000000000a04', 'scope-root-document',
        'draft', 'report', 'en', 'fixtures/scoped/root.pdf');
select is((select count(*) from public.organization_documents
  where id = 'b1000000-0000-4000-8000-000000000a04'), 1::bigint,
  'root may create an organization document');

insert into public.team_members (id, name, status)
  values ('b1000000-0000-4000-8000-000000000a05', 'Scoped Root Person', 'draft');
select is((select count(*) from public.team_members
  where id = 'b1000000-0000-4000-8000-000000000a05'), 1::bigint,
  'root may create a team member');

insert into public.calendar_event_links
  (id, calendar_id, google_event_id)
values ('b1000000-0000-4000-8000-000000000a06', 'scope-calendar@example.org',
        'scope-root-event');
select is((select count(*) from public.calendar_event_links
  where id = 'b1000000-0000-4000-8000-000000000a06'), 1::bigint,
  'root may create a calendar event link');

insert into storage.objects (id, bucket_id, name) values
  ('b9000000-0000-4000-8000-000000000a07', 'public-media',
   'fixtures/scoped/root-cover.webp');
select is((select count(*) from storage.objects
  where id = 'b9000000-0000-4000-8000-000000000a07'), 1::bigint,
  'root may write public media');

insert into storage.objects (id, bucket_id, name) values
  ('b9000000-0000-4000-8000-000000000a08', 'public-documents',
   'fixtures/scoped/root.pdf');
select is((select count(*) from storage.objects
  where id = 'b9000000-0000-4000-8000-000000000a08'), 1::bigint,
  'root may write public documents');

insert into public.content_sync_jobs (id, kind, locale, request) values
  ('b1000000-0000-4000-8000-000000000a09', 'publication', 'en', '{}'::jsonb);
select is((select count(*) from public.content_sync_jobs
  where id = 'b1000000-0000-4000-8000-000000000a09'), 1::bigint,
  'root may create an import/sync job');

insert into storage.objects (id, bucket_id, name) values
  ('b9000000-0000-4000-8000-000000000a10', 'content-sources',
   'fixtures/scoped/root-source.docx');
select is((select count(*) from storage.objects
  where id = 'b9000000-0000-4000-8000-000000000a10'), 1::bigint,
  'root may write private source originals');

select is((select count(*) from public.projects
  where id = 'b2000000-0000-4000-8000-0000000000f0'), 1::bigint,
  'root may read a draft project');
reset role;

-- ===========================================================================
-- Self-escalation attempts fail
-- ===========================================================================
-- app_metadata is writable only by the service role / Admin API. These cases
-- prove the client-visible claim surfaces cannot widen access.

select set_config('request.jwt.claims',
  $json${"sub":"b1000000-0000-4000-8000-000000000b01","role":"authenticated","user_metadata":{"scopes":["projects:write"]}}$json$,
  true);
set local role authenticated;
select throws_ok(
  $sql$ insert into public.projects (id, slug, status)
        values ('b1000000-0000-4000-8000-000000000b02', 'scope-escalate-user-metadata', 'draft') $sql$,
  '42501', NULL,
  'user_metadata.scopes cannot self-grant a project write'
);
reset role;

select set_config('request.jwt.claims',
  $json${"sub":"b1000000-0000-4000-8000-000000000b03","role":"authenticated","app_metadata":{"scopes":"projects:write"}}$json$,
  true);
set local role authenticated;
select throws_ok(
  $sql$ insert into public.projects (id, slug, status)
        values ('b1000000-0000-4000-8000-000000000b04', 'scope-escalate-string', 'draft') $sql$,
  '42501', NULL,
  'a string scopes value cannot self-grant a project write'
);

select set_config('request.jwt.claims',
  $json${"sub":"b1000000-0000-4000-8000-000000000b05","role":"authenticated","app_metadata":{"scopes":["PROJECTS:WRITE"]}}$json$,
  true);
select throws_ok(
  $sql$ insert into public.projects (id, slug, status)
        values ('b1000000-0000-4000-8000-000000000b06', 'scope-escalate-case', 'draft') $sql$,
  '42501', NULL,
  'a case-mismatched scope cannot self-grant a project write'
);
reset role;

select is(has_table_privilege('authenticated', 'auth.users', 'UPDATE'), false,
  'authenticated cannot update auth.users to write app_metadata');
select is(has_table_privilege('authenticated', 'auth.users', 'INSERT'), false,
  'authenticated cannot insert auth.users to mint a scoped account');

select is(
  (select count(*)
     from pg_policies
    where schemaname in ('public', 'storage')
      and (
        coalesce(qual, '') ilike '%user_metadata%'
        or coalesce(with_check, '') ilike '%user_metadata%'
      )),
  0::bigint,
  'no policy reads user_metadata'
);

-- ===========================================================================
-- T-045 RPCs: same guard, widened from root-only to projects:write
-- ===========================================================================

select set_config('request.jwt.claims',
  $json${"sub":"b1000000-0000-4000-8000-000000000c01","role":"authenticated","app_metadata":{"role":"editor","scopes":["projects:write"]}}$json$,
  true);
set local role authenticated;

select lives_ok(
  $sql$ select public.save_project_v1(
          null, 'scope-rpc-project', 'draft', null, null, null, null, null,
          '[{"locale":"en","title":"Scoped RPC project","summary":null,"body":null}]'::jsonb
        ) $sql$,
  'projects:write may call save_project_v1'
);
select lives_ok(
  $sql$ select public.transition_project_v1(
          (select id from public.projects where slug = 'scope-rpc-project'),
          'published', now()
        ) $sql$,
  'projects:write may call transition_project_v1'
);
reset role;

select set_config('request.jwt.claims',
  $json${"sub":"b1000000-0000-4000-8000-000000000c02","role":"authenticated","app_metadata":{"role":"editor","scopes":["publications:write"]}}$json$,
  true);
set local role authenticated;

select throws_ok(
  $sql$ select public.save_project_v1(
          null, 'scope-rpc-denied', 'draft', null, null, null, null, null,
          '[{"locale":"en","title":"Denied","summary":null,"body":null}]'::jsonb
        ) $sql$,
  '42501', NULL,
  'publications:write cannot call save_project_v1'
);
select throws_ok(
  $sql$ select public.transition_project_v1(
          (select id from public.projects where slug = 'scope-rpc-project'),
          'archived', null
        ) $sql$,
  '42501', NULL,
  'publications:write cannot call transition_project_v1'
);
reset role;

select set_config('request.jwt.claims',
  $json${"sub":"b1000000-0000-4000-8000-000000000c03","role":"authenticated","app_metadata":{"role":"admin"}}$json$,
  true);
set local role authenticated;

select lives_ok(
  $sql$ select public.save_project_v1(
          null, 'scope-rpc-root', 'draft', null, null, null, null, null,
          '[{"locale":"en","title":"Root RPC project","summary":null,"body":null}]'::jsonb
        ) $sql$,
  'root may still call save_project_v1 after the scoped guard change'
);
reset role;

select * from finish();
rollback;
