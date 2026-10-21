-- T-041 S3 — transactional import writer (pgTAP).
--
-- Design authority:
--   * D-32/D-37 — AST + version are stored; `body` is derived by the trigger.
--   * D-36 — images are content_assets with a ready UUID, XOR owner and locale.
--   * D-30 — originals are private; the download toggle needs a source path.
--   * T-042 — source_url/source_modified_at are Drive sync metadata.
--
-- The function is SECURITY INVOKER, so these tests run as an admin role (the
-- same boundary the browser uses) and also prove a non-admin cannot write.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

insert into public.organization_documents
  (id, slug, status, document_type, language, storage_path, sort_order)
values
  ('e0410000-0000-4000-8000-000000000001', 'import-existing', 'draft',
   'report', 'en', null, 1),
  ('e0410000-0000-4000-8000-000000000002', 'import-other', 'draft',
   'report', 'en', null, 2);

insert into public.organization_document_translations
  (id, document_id, locale, title, body)
values
  ('e0420000-0000-4000-8000-000000000001',
   'e0410000-0000-4000-8000-000000000001', 'en', 'Existing title', 'Old body'),
  ('e0420000-0000-4000-8000-000000000002',
   'e0410000-0000-4000-8000-000000000002', 'en', 'Other title', 'Other body');

insert into public.content_assets
  (id, organization_document_id, publication_id, locale,
   storage_path, mime_type, width, height, sha256, size_bytes)
values
  ('e0500000-0000-4000-8000-000000000001',
   'e0410000-0000-4000-8000-000000000001', null, 'pl',
   'content-assets/existing/pl/old.png', 'image/png', 10, 10, repeat('a', 64), 10),
  ('e0500000-0000-4000-8000-000000000002',
   'e0410000-0000-4000-8000-000000000002', null, 'en',
   'content-assets/other/en/foreign.png', 'image/png', 10, 10, repeat('b', 64), 10);

create or replace function pg_temp.import_ast(p_asset uuid default null)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'kind', 'document',
    'blocks',
    jsonb_build_array(
      jsonb_build_object(
        'kind', 'paragraph',
        'children', jsonb_build_array(
          jsonb_build_object('kind', 'text', 'value', 'Imported body')
        )
      )
    ) ||
    case when p_asset is null then '[]'::jsonb
      else jsonb_build_array(
        jsonb_build_object(
          'kind', 'image', 'assetId', p_asset, 'alt', 'Imported image'
        )
      )
    end
  );
$$;

select plan(22);

-- ---------------------------------------------------------------------------
-- New document import
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  $json${"sub":"e0600000-0000-4000-8000-0000000000a1","role":"authenticated","app_metadata":{"role":"admin"}}$json$,
  true);
set local role authenticated;

select lives_ok($sql$
  select public.persist_reader_import_v1(
    'document', null, 'import-new', 'en', 'Imported title', 'Imported description',
    'report', pg_temp.import_ast('e0500000-0000-4000-8000-000000000003'),
    jsonb_build_array(jsonb_build_object(
      'id', 'e0500000-0000-4000-8000-000000000003',
      'storage_path', 'content-assets/import-new/en/image.png',
      'mime_type', 'image/png', 'width', 10, 'height', 10,
      'sha256', repeat('c', 64), 'size_bytes', 10
    )),
    'upload', 'sources/import-new.docx',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    null, null, now(), null, false, 'published'
  )
$sql$, 'admin creates a new document import');

select is(
  (select count(*) from public.organization_documents where slug = 'import-new'),
  1::bigint, 'new document root exists');
select ok(
  (select body from public.organization_document_translations t
     join public.organization_documents d on d.id = t.document_id
    where d.slug = 'import-new' and t.locale = 'en') like '%Imported body%',
  'trigger derives body from the AST');
select is(
  (select body_ast_version from public.organization_document_translations t
     join public.organization_documents d on d.id = t.document_id
    where d.slug = 'import-new' and t.locale = 'en'),
  1::smallint, 'translation stores AST version 1');
select is(
  (select organization_document_id from public.content_assets
    where id = 'e0500000-0000-4000-8000-000000000003'),
  (select id from public.organization_documents where slug = 'import-new'),
  'asset is owned by the imported document');
select is(
  (select locale::text from public.content_assets
    where id = 'e0500000-0000-4000-8000-000000000003'),
  'en', 'asset keeps the translation locale');
select is(
  (select source_provider::text from public.organization_documents where slug = 'import-new'),
  'upload', 'root stores the upload provider');
select is(
  (select source_path from public.organization_documents where slug = 'import-new'),
  'sources/import-new.docx', 'root stores the private source path');

-- ---------------------------------------------------------------------------
-- Foreign / locale-mismatched assets
-- ---------------------------------------------------------------------------

select throws_ok($sql$
  select public.persist_reader_import_v1(
    'document', 'e0410000-0000-4000-8000-000000000001', 'import-existing',
    'en', 'Hijack title', null, 'report',
    pg_temp.import_ast('e0500000-0000-4000-8000-000000000002'),
    jsonb_build_array(jsonb_build_object(
      'id', 'e0500000-0000-4000-8000-000000000002',
      'storage_path', 'content-assets/other/en/foreign.png',
      'mime_type', 'image/png', 'width', 10, 'height', 10,
      'sha256', repeat('b', 64), 'size_bytes', 10
    )),
    'manual', null, null, null, null, null, null, false, 'published'
  )
$sql$, '23514', null, 'an asset owned by another document is rejected');

select throws_ok($sql$
  select public.persist_reader_import_v1(
    'document', 'e0410000-0000-4000-8000-000000000001', 'import-existing',
    'en', 'Locale mismatch', null, 'report',
    pg_temp.import_ast('e0500000-0000-4000-8000-000000000001'),
    jsonb_build_array(jsonb_build_object(
      'id', 'e0500000-0000-4000-8000-000000000001',
      'storage_path', 'content-assets/existing/pl/old.png',
      'mime_type', 'image/png', 'width', 10, 'height', 10,
      'sha256', repeat('a', 64), 'size_bytes', 10
    )),
    'manual', null, null, null, null, null, null, false, 'published'
  )
$sql$, '23514', null, 'an asset in another locale is rejected');

-- The rejected calls must leave the existing translation untouched.
select is(
  (select title from public.organization_document_translations
    where document_id = 'e0410000-0000-4000-8000-000000000001' and locale = 'en'),
  'Existing title', 'a failed import leaves the previous translation intact');

-- ---------------------------------------------------------------------------
-- Source metadata rules
-- ---------------------------------------------------------------------------

select throws_ok($sql$
  select public.persist_reader_import_v1(
    'document', null, 'import-bad-upload', 'en', 'Bad upload', null, 'report',
    pg_temp.import_ast(), '[]'::jsonb, 'upload', null, null, null, null, null,
    null, false, 'draft'
  )
$sql$, '23514', null, 'upload source without a path is rejected');

select throws_ok($sql$
  select public.persist_reader_import_v1(
    'document', null, 'import-bad-google', 'en', 'Bad google', null, 'report',
    pg_temp.import_ast(), '[]'::jsonb, 'google_doc', null, null, null,
    'https://docs.google.com/document/d/x/edit', now(), null, false, 'draft'
  )
$sql$, '23514', null, 'google_doc without an external id is rejected');

select throws_ok($sql$
  select public.persist_reader_import_v1(
    'document', null, 'import-bad-download', 'en', 'Bad download', null, 'report',
    pg_temp.import_ast(), '[]'::jsonb, 'manual', null, null, null, null, null,
    null, true, 'draft'
  )
$sql$, '23514', null, 'download toggle without a source path is rejected');

select throws_ok($sql$
  select public.persist_reader_import_v1(
    'document', null, 'import-bad-url', 'en', 'Bad url', null, 'report',
    pg_temp.import_ast(), '[]'::jsonb, 'manual', null, null, null,
    'javascript:alert(1)', null, null, false, 'draft'
  )
$sql$, '23514', null, 'a non-http source URL is rejected');

-- ---------------------------------------------------------------------------
-- Re-import replaces assets and keeps the same entity
-- ---------------------------------------------------------------------------

select lives_ok($sql$
  select public.persist_reader_import_v1(
    'document', 'e0410000-0000-4000-8000-000000000001', 'ignored-slug',
    'pl', 'Polski import', null, 'report',
    pg_temp.import_ast('e0500000-0000-4000-8000-000000000004'),
    jsonb_build_array(jsonb_build_object(
      'id', 'e0500000-0000-4000-8000-000000000004',
      'storage_path', 'content-assets/existing/pl/new.png',
      'mime_type', 'image/png', 'width', 10, 'height', 10,
      'sha256', repeat('d', 64), 'size_bytes', 10
    )),
    'manual', null, null, null, null, null, null, false, 'draft'
  )
$sql$, 'an additional locale upserts the existing document');

select is(
  (select count(*) from public.organization_documents where slug = 'import-existing'),
  1::bigint, 're-import does not create a duplicate root');
select is(
  (select count(*) from public.content_assets
    where organization_document_id = 'e0410000-0000-4000-8000-000000000001'
      and locale = 'pl' and id <> 'e0500000-0000-4000-8000-000000000004'),
  0::bigint, 'stale locale assets are removed atomically');

-- ---------------------------------------------------------------------------
-- Publications
-- ---------------------------------------------------------------------------

select lives_ok($sql$
  select public.persist_reader_import_v1(
    'publication', null, 'import-publication', 'uk', 'Публікація', 'Анотація',
    null, pg_temp.import_ast(), '[]'::jsonb, 'manual', null, null, null, null,
    null, null, false, 'published'
  )
$sql$, 'admin creates a publication import');

select is(
  (select body from public.publication_translations t
     join public.publications p on p.id = t.publication_id
    where p.slug = 'import-publication' and t.locale = 'uk'),
  'Imported body', 'publication body is derived from the AST');
select is(
  (select abstract from public.publication_translations t
     join public.publications p on p.id = t.publication_id
    where p.slug = 'import-publication' and t.locale = 'uk'),
  'Анотація', 'publication description maps to abstract');

-- ---------------------------------------------------------------------------
-- Non-admin is denied by RLS (the function is SECURITY INVOKER)
-- ---------------------------------------------------------------------------

reset role;
select set_config('request.jwt.claims',
  $json${"sub":"e0600000-0000-4000-8000-0000000000a2","role":"authenticated"}$json$,
  true);
set local role authenticated;

select throws_ok($sql$
  select public.persist_reader_import_v1(
    'document', null, 'import-nonadmin', 'en', 'Non admin', null, 'report',
    pg_temp.import_ast(), '[]'::jsonb, 'manual', null, null, null, null, null,
    null, false, 'draft'
  )
$sql$, '42501', null, 'non-admin cannot execute the import write path');

reset role;

select * from finish();
rollback;
