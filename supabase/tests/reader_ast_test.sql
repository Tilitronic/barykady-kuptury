-- T-040 — unified reader AST, validation/projection and asset boundary (pgTAP).
--
-- Design authority:
--   * docs/tickets/DECISIONS.md D-32 — versioned ReaderDocument AST + plain-text
--     `body` projection; no raw HTML/mdast in storage.
--   * D-36 — `content_assets` owns image files with an XOR document/publication
--     owner, locale, MIME allowlist, dimensions and sha256; public read only
--     through a published owner.
--   * D-37 — AST validation and projection are write-time DB invariants.
--   * D-30 — originals live in the private `content-sources` bucket.
--   * docs/tickets/T-040-unified-reader.md §Content model — node allowlist,
--     link schemes, heading levels 2–4, table semantics, image alt rules.
--
-- Expected RED before the T-040 migration: the columns/table/functions/bucket
-- do not exist, so the first assertions fail loudly.
--
-- One transaction, one rollback: fixtures never leak into the seeded database.
-- Identity simulation follows TESTING §3 (SET LOCAL ROLE + request.jwt.claims).

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Fictional fixtures (inserted as the migration superuser; RLS bypassed here)
-- ---------------------------------------------------------------------------

insert into public.organization_documents
  (id, slug, status, document_type, language, storage_path, sort_order, published_at)
values
  ('d0400000-0000-4000-8000-000000000001', 'reader-fixture-doc', 'published',
   'regulations', null, null, 1, now()),
  ('d0400000-0000-4000-8000-000000000002', 'reader-fixture-draft-doc', 'draft',
   'regulations', null, null, 2, null),
  ('d0400000-0000-4000-8000-000000000003', 'reader-fixture-other-doc', 'published',
   'report', null, null, 3, now()),
  ('d0400000-0000-4000-8000-000000000006', 'reader-fixture-ast', 'published',
   'regulations', null, null, 6, now());

insert into public.organization_document_translations
  (id, document_id, locale, title, body)
values
  ('d0410000-0000-4000-8000-000000000001', 'd0400000-0000-4000-8000-000000000001', 'en',
   'Reader Fixture Document', 'Legacy document body'),
  ('d0410000-0000-4000-8000-000000000002', 'd0400000-0000-4000-8000-000000000002', 'en',
   'Draft Document', 'Draft body'),
  ('d0410000-0000-4000-8000-000000000003', 'd0400000-0000-4000-8000-000000000003', 'en',
   'Other Document', 'Legacy other body'),
  ('d0410000-0000-4000-8000-000000000006', 'd0400000-0000-4000-8000-000000000006', 'en',
   'AST Document', 'Legacy AST body'),
  ('d0410000-0000-4000-8000-000000000007', 'd0400000-0000-4000-8000-000000000006', 'pl',
   'Dokument AST', 'Legacy PL AST body');

insert into public.publications
  (id, slug, status, language, publication_date, sort_order, published_at)
values
  ('d0400000-0000-4000-8000-000000000004', 'reader-fixture-pub', 'published',
   'en', '2026-04-01', 1, now()),
  ('d0400000-0000-4000-8000-000000000005', 'reader-fixture-draft-pub', 'draft',
   'en', null, 2, null);

insert into public.publication_translations
  (id, publication_id, locale, title, abstract, body)
values
  ('d0420000-0000-4000-8000-000000000004', 'd0400000-0000-4000-8000-000000000004', 'en',
   'Reader Fixture Publication', 'Publication abstract', 'Legacy publication body'),
  ('d0420000-0000-4000-8000-000000000005', 'd0400000-0000-4000-8000-000000000005', 'en',
   'Draft Publication', null, null);

insert into public.content_assets
  (id, organization_document_id, publication_id, locale, storage_path, mime_type, width, height, sha256, size_bytes)
values
  ('d0500000-0000-4000-8000-000000000001', 'd0400000-0000-4000-8000-000000000001', null, 'en',
   'content-assets/doc-1/en/diagram.png', 'image/png', 640, 360, repeat('a', 64), 1024),
  ('d0500000-0000-4000-8000-000000000002', 'd0400000-0000-4000-8000-000000000002', null, 'en',
   'content-assets/doc-2/en/draft.png', 'image/png', 640, 360, repeat('b', 64), 1024),
  ('d0500000-0000-4000-8000-000000000003', null, 'd0400000-0000-4000-8000-000000000004', 'en',
   'content-assets/pub-4/en/cover.webp', 'image/webp', 1200, 630, repeat('c', 64), 2048),
  ('d0500000-0000-4000-8000-000000000004', 'd0400000-0000-4000-8000-000000000003', null, 'en',
   'content-assets/doc-3/en/other.png', 'image/jpeg', 100, 100, repeat('d', 64), 512),
  ('d0500000-0000-4000-8000-000000000005', 'd0400000-0000-4000-8000-000000000006', null, 'pl',
   'content-assets/doc-6/pl/polish.png', 'image/png', 100, 100, repeat('e', 64), 512),
  ('d0500000-0000-4000-8000-000000000006', 'd0400000-0000-4000-8000-000000000006', null, 'en',
   'content-assets/doc-6/en/valid.png', 'image/png', 100, 100, repeat('f', 64), 512);

-- A complete, valid v1 document exercising every block kind and inline kind
-- that the reader ships. The asset must belong to the target translation's
-- owner and locale; callers pass the asset they want to prove.
create or replace function pg_temp.reader_valid_ast(p_asset uuid)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'kind', 'document',
    'blocks', jsonb_build_array(
      jsonb_build_object(
        'kind', 'heading', 'level', 2,
        'children', jsonb_build_array(
          jsonb_build_object('kind', 'text', 'value', 'Reader Heading')
        )
      ),
      jsonb_build_object(
        'kind', 'paragraph',
        'children', jsonb_build_array(
          jsonb_build_object('kind', 'text', 'value', 'Reader paragraph '),
          jsonb_build_object('kind', 'strong', 'children', jsonb_build_array(
            jsonb_build_object('kind', 'text', 'value', 'bold')
          )),
          jsonb_build_object('kind', 'emphasis', 'children', jsonb_build_array(
            jsonb_build_object('kind', 'text', 'value', 'italic')
          )),
          jsonb_build_object('kind', 'link', 'href', 'https://example.org',
            'children', jsonb_build_array(
              jsonb_build_object('kind', 'text', 'value', 'link text')
            )
          ),
          jsonb_build_object('kind', 'inlineCode', 'value', 'inline-code'),
          jsonb_build_object('kind', 'sup', 'children', jsonb_build_array(
            jsonb_build_object('kind', 'text', 'value', '1')
          )),
          jsonb_build_object('kind', 'sub', 'children', jsonb_build_array(
            jsonb_build_object('kind', 'text', 'value', '2')
          )),
          jsonb_build_object('kind', 'span', 'lang', 'de', 'children', jsonb_build_array(
            jsonb_build_object('kind', 'text', 'value', 'German words')
          ))
        )
      ),
      jsonb_build_object(
        'kind', 'list', 'ordered', false,
        'items', jsonb_build_array(
          jsonb_build_object('children', jsonb_build_array(
            jsonb_build_object('kind', 'text', 'value', 'List item one')
          )),
          jsonb_build_object('children', jsonb_build_array(
            jsonb_build_object('kind', 'text', 'value', 'List item two')
          ))
        )
      ),
      jsonb_build_object(
        'kind', 'table', 'headerRows', 1, 'caption', 'Captioned table',
        'rows', jsonb_build_array(
          jsonb_build_array(
            jsonb_build_object('header', true, 'scope', 'col',
              'children', jsonb_build_array(
                jsonb_build_object('kind', 'text', 'value', 'Header one')
              )
            ),
            jsonb_build_object('header', true, 'scope', 'col',
              'children', jsonb_build_array(
                jsonb_build_object('kind', 'text', 'value', 'Header two')
              )
            )
          ),
          jsonb_build_array(
            jsonb_build_object('header', false, 'colspan', 1,
              'children', jsonb_build_array(
                jsonb_build_object('kind', 'text', 'value', 'Cell one')
              )
            ),
            jsonb_build_object('header', false, 'rowspan', 1,
              'children', jsonb_build_array(
                jsonb_build_object('kind', 'text', 'value', 'Cell two')
              )
            )
          )
        )
      ),
      jsonb_build_object(
        'kind', 'image', 'assetId', p_asset, 'alt', 'Diagram alt',
        'caption', 'Diagram caption', 'decorative', false
      ),
      jsonb_build_object(
        'kind', 'blockquote',
        'children', jsonb_build_array(
          jsonb_build_object('kind', 'paragraph', 'children', jsonb_build_array(
            jsonb_build_object('kind', 'text', 'value', 'Quoted text')
          ))
        )
      ),
      jsonb_build_object('kind', 'code', 'language', 'sql', 'value', 'select 1;'),
      jsonb_build_object(
        'kind', 'footnote', 'label', '1',
        'children', jsonb_build_array(
          jsonb_build_object('kind', 'text', 'value', 'Footnote text')
        )
      ),
      jsonb_build_object('kind', 'divider')
    )
  );
$$;

select plan(96);

-- ---------------------------------------------------------------------------
-- Schema shape and function inventory
-- ---------------------------------------------------------------------------

select is(
  (select array_agg(enumlabel::text order by enumsortorder)
     from pg_enum where enumtypid = 'public.content_source_provider'::regtype),
  array['manual', 'upload', 'google_doc'],
  'content_source_provider exposes manual/upload/google_doc'
);

select has_column('public', 'organization_document_translations', 'body_ast',
  'document translations carry body_ast');
select has_column('public', 'organization_document_translations', 'body_ast_version',
  'document translations carry body_ast_version');
select has_column('public', 'publication_translations', 'body',
  'publication translations carry the plain-text body');
select has_column('public', 'publication_translations', 'body_ast',
  'publication translations carry body_ast');
select has_column('public', 'publication_translations', 'body_ast_version',
  'publication translations carry body_ast_version');

select has_column('public', 'organization_documents', 'source_provider',
  'documents carry source_provider');
select has_column('public', 'organization_documents', 'source_path',
  'documents carry source_path');
select has_column('public', 'organization_documents', 'source_external_id',
  'documents carry source_external_id');
select has_column('public', 'organization_documents', 'allow_original_download',
  'documents carry allow_original_download');
select has_column('public', 'publications', 'source_provider',
  'publications carry source_provider');
select has_column('public', 'publications', 'allow_original_download',
  'publications carry allow_original_download');

select has_table('public', 'content_assets', 'content_assets exists');
select is((select relrowsecurity from pg_class where oid = 'public.content_assets'::regclass),
  true, 'RLS is enabled on content_assets');
select has_index('public', 'content_assets', 'content_assets_storage_path_key',
  'content_assets storage_path is unique');

select has_function('public', 'validate_reader_ast_v1', array['jsonb', 'smallint'],
  'validate_reader_ast_v1(jsonb, smallint) exists');
select has_function('public', 'reader_ast_to_plain_text_v1', array['jsonb'],
  'reader_ast_to_plain_text_v1(jsonb) exists');

select is((select public from storage.buckets where id = 'content-sources'),
  false, 'content-sources bucket is private');
select is(
  (select allowed_mime_types from storage.buckets where id = 'content-sources'),
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/markdown',
    'text/plain'
  ]::text[],
  'content-sources allows only source document formats'
);

select is(
  (select count(*) from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname in (
        'storage_objects_select_content_sources_admin',
        'storage_objects_insert_content_sources_admin',
        'storage_objects_update_content_sources_admin',
        'storage_objects_delete_content_sources_admin'
      )),
  4::bigint,
  'content-sources has four admin-only object policies'
);

select is(
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'content_assets'
      and policyname in (
        'content_assets_select_published',
        'content_assets_select_admin',
        'content_assets_insert_admin',
        'content_assets_update_admin',
        'content_assets_delete_admin'
      )),
  5::bigint,
  'content_assets has published-read plus admin write policies'
);

-- ---------------------------------------------------------------------------
-- Version coupling and legacy-body preservation
-- ---------------------------------------------------------------------------

-- Legacy rows (created above) keep their authored body when no AST exists.
select is(
  (select body from public.organization_document_translations
    where id = 'd0410000-0000-4000-8000-000000000001'),
  'Legacy document body',
  'legacy document body is preserved when body_ast is null'
);
select is(
  (select body from public.publication_translations
    where id = 'd0420000-0000-4000-8000-000000000004'),
  'Legacy publication body',
  'legacy publication body is preserved when body_ast is null'
);

select throws_ok($sql$
  update public.organization_document_translations
     set body_ast = '{"kind":"document","blocks":[]}'::jsonb,
         body_ast_version = null
   where id = 'd0410000-0000-4000-8000-000000000003'
$sql$, '23514', NULL, 'body_ast without body_ast_version is rejected');

select throws_ok($sql$
  update public.organization_document_translations
     set body_ast = null, body_ast_version = 1
   where id = 'd0410000-0000-4000-8000-000000000003'
$sql$, '23514', NULL, 'body_ast_version without body_ast is rejected');

select throws_ok($sql$
  update public.organization_document_translations
     set body_ast = '{"kind":"document","blocks":[]}'::jsonb,
         body_ast_version = 2
   where id = 'd0410000-0000-4000-8000-000000000003'
$sql$, '23514', NULL, 'unsupported body_ast_version is rejected');

select lives_ok($sql$
  update public.organization_document_translations
     set body_ast = '{"kind":"document","blocks":[]}'::jsonb,
         body_ast_version = 1
   where id = 'd0410000-0000-4000-8000-000000000003'
$sql$, 'version 1 with a valid empty document is accepted');

-- Restore the legacy fixture for later assertions.
update public.organization_document_translations
   set body_ast = null, body_ast_version = null, body = 'Legacy other body'
 where id = 'd0410000-0000-4000-8000-000000000003';

-- ---------------------------------------------------------------------------
-- Valid AST: validation, asset ownership and plain-text projection
-- ---------------------------------------------------------------------------

select lives_ok($sql$
  update public.organization_document_translations
     set body_ast = pg_temp.reader_valid_ast('d0500000-0000-4000-8000-000000000006'),
         body_ast_version = 1
   where id = 'd0410000-0000-4000-8000-000000000006'
$sql$, 'complete valid v1 AST is accepted for its owner/locale asset');

select isnt(
  (select body from public.organization_document_translations
    where id = 'd0410000-0000-4000-8000-000000000006'),
  'Legacy AST body',
  'AST write replaces the legacy body with the projection'
);

select ok(
  position('Reader Heading' in (select body from public.organization_document_translations
    where id = 'd0410000-0000-4000-8000-000000000006')) > 0,
  'projection includes heading text');
select ok(
  (select body from public.organization_document_translations
    where id = 'd0410000-0000-4000-8000-000000000006')
  like '%Reader paragraph%bold%italic%link text%inline-code%German words%',
  'projection flattens all inline kinds');
select ok(
  (select body from public.organization_document_translations
    where id = 'd0410000-0000-4000-8000-000000000006')
  like '%List item one%List item two%',
  'projection includes list items');
select ok(
  (select body from public.organization_document_translations
    where id = 'd0410000-0000-4000-8000-000000000006')
  like '%Captioned table%Header one%Cell one%Cell two%',
  'projection includes table caption and cells');
select ok(
  (select body from public.organization_document_translations
    where id = 'd0410000-0000-4000-8000-000000000006')
  like '%Diagram alt%Diagram caption%',
  'projection includes image alt and caption');
select ok(
  (select body from public.organization_document_translations
    where id = 'd0410000-0000-4000-8000-000000000006')
  like '%Quoted text%select 1;%Footnote text%',
  'projection includes blockquote, code and footnote text');
select ok(
  (select body from public.organization_document_translations
    where id = 'd0410000-0000-4000-8000-000000000006')
  not like '%assetId%',
  'projection contains text, not the JSON payload');
select ok(
  position('Reader Heading' in public.reader_ast_to_plain_text_v1(
    pg_temp.reader_valid_ast('d0500000-0000-4000-8000-000000000006'))) > 0,
  'reader_ast_to_plain_text_v1 is callable directly');

-- ---------------------------------------------------------------------------
-- AST validation: document, block and inline allowlists
-- ---------------------------------------------------------------------------

select throws_ok($sql$
  update public.organization_document_translations
     set body_ast = jsonb_set(
       pg_temp.reader_valid_ast('d0500000-0000-4000-8000-000000000006'),
       '{kind}', '"paragraph"')
   where id = 'd0410000-0000-4000-8000-000000000006'
$sql$, '23514', NULL, 'top-level kind must be document');

select throws_ok($sql$
  update public.organization_document_translations
     set body_ast = pg_temp.reader_valid_ast('d0500000-0000-4000-8000-000000000006')
       #- '{blocks}'
   where id = 'd0410000-0000-4000-8000-000000000006'
$sql$, '23514', NULL, 'document requires blocks');

select throws_ok($sql$
  update public.organization_document_translations
     set body_ast = jsonb_set(
       pg_temp.reader_valid_ast('d0500000-0000-4000-8000-000000000006'),
       '{extra}', 'true')
   where id = 'd0410000-0000-4000-8000-000000000006'
$sql$, '23514', NULL, 'unknown top-level properties are rejected');

select throws_ok($sql$
  update public.organization_document_translations
     set body_ast = jsonb_set(
       pg_temp.reader_valid_ast('d0500000-0000-4000-8000-000000000006'),
       '{blocks}', (pg_temp.reader_valid_ast('d0500000-0000-4000-8000-000000000006')->'blocks')
         || '[{"kind":"html","value":"<b>x</b>"}]'::jsonb)
   where id = 'd0410000-0000-4000-8000-000000000006'
$sql$, '23514', NULL, 'unknown block kinds are rejected');

select throws_ok($sql$
  update public.organization_document_translations
     set body_ast = jsonb_set(
       pg_temp.reader_valid_ast('d0500000-0000-4000-8000-000000000006'),
       '{blocks,1,children}', '[{"kind":"script","value":"alert(1)"}]'::jsonb)
   where id = 'd0410000-0000-4000-8000-000000000006'
$sql$, '23514', NULL, 'unknown inline kinds are rejected');

select throws_ok($sql$
  update public.organization_document_translations
     set body_ast = jsonb_set(
       pg_temp.reader_valid_ast('d0500000-0000-4000-8000-000000000006'),
       '{blocks,1,unknown}', '"x"')
   where id = 'd0410000-0000-4000-8000-000000000006'
$sql$, '23514', NULL, 'unknown block properties are rejected');

-- ---------------------------------------------------------------------------
-- Heading levels 2–4
-- ---------------------------------------------------------------------------

select throws_ok($sql$
  update public.organization_document_translations
     set body_ast = jsonb_set(
       pg_temp.reader_valid_ast('d0500000-0000-4000-8000-000000000006'),
       '{blocks,0,level}', '1')
   where id = 'd0410000-0000-4000-8000-000000000006'
$sql$, '23514', NULL, 'heading level 1 is rejected');
select throws_ok($sql$
  update public.organization_document_translations
     set body_ast = jsonb_set(
       pg_temp.reader_valid_ast('d0500000-0000-4000-8000-000000000006'),
       '{blocks,0,level}', '5')
   where id = 'd0410000-0000-4000-8000-000000000006'
$sql$, '23514', NULL, 'heading level 5 is rejected');
select lives_ok($sql$
  update public.organization_document_translations
     set body_ast = jsonb_set(
       pg_temp.reader_valid_ast('d0500000-0000-4000-8000-000000000006'),
       '{blocks,0,level}', '4')
   where id = 'd0410000-0000-4000-8000-000000000006'
$sql$, 'heading level 4 is accepted');

-- ---------------------------------------------------------------------------
-- Link schemes
-- ---------------------------------------------------------------------------

select throws_ok($sql$
  update public.organization_document_translations
     set body_ast = jsonb_set(
       pg_temp.reader_valid_ast('d0500000-0000-4000-8000-000000000006'),
       '{blocks,1,children,3,href}', '"javascript:alert(1)"')
   where id = 'd0410000-0000-4000-8000-000000000006'
$sql$, '23514', NULL, 'javascript: links are rejected');
select throws_ok($sql$
  update public.organization_document_translations
     set body_ast = jsonb_set(
       pg_temp.reader_valid_ast('d0500000-0000-4000-8000-000000000006'),
       '{blocks,1,children,3,href}', '"data:text/html,x"')
   where id = 'd0410000-0000-4000-8000-000000000006'
$sql$, '23514', NULL, 'data: links are rejected');
select throws_ok($sql$
  update public.organization_document_translations
     set body_ast = jsonb_set(
       pg_temp.reader_valid_ast('d0500000-0000-4000-8000-000000000006'),
       '{blocks,1,children,3,href}', '"//evil.example/x"')
   where id = 'd0410000-0000-4000-8000-000000000006'
$sql$, '23514', NULL, 'protocol-relative links are rejected');
select throws_ok($sql$
  update public.organization_document_translations
     set body_ast = jsonb_set(
       pg_temp.reader_valid_ast('d0500000-0000-4000-8000-000000000006'),
       '{blocks,1,children,3,href}', '"relative/path"')
   where id = 'd0410000-0000-4000-8000-000000000006'
$sql$, '23514', NULL, 'non-slash relative links are rejected');

select lives_ok($sql$
  update public.organization_document_translations
     set body_ast = jsonb_set(
       pg_temp.reader_valid_ast('d0500000-0000-4000-8000-000000000006'),
       '{blocks,1,children,3,href}', '"mailto:info@example.org"')
   where id = 'd0410000-0000-4000-8000-000000000006'
$sql$, 'mailto: links are accepted');
select lives_ok($sql$
  update public.organization_document_translations
     set body_ast = jsonb_set(
       pg_temp.reader_valid_ast('d0500000-0000-4000-8000-000000000006'),
       '{blocks,1,children,3,href}', '"#mission"')
   where id = 'd0410000-0000-4000-8000-000000000006'
$sql$, '# links are accepted');
select lives_ok($sql$
  update public.organization_document_translations
     set body_ast = jsonb_set(
       pg_temp.reader_valid_ast('d0500000-0000-4000-8000-000000000006'),
       '{blocks,1,children,3,href}', '"/en/about"')
   where id = 'd0410000-0000-4000-8000-000000000006'
$sql$, 'same-origin absolute links are accepted');

-- ---------------------------------------------------------------------------
-- Table semantics
-- ---------------------------------------------------------------------------

select throws_ok($sql$
  update public.organization_document_translations
     set body_ast = jsonb_set(
       pg_temp.reader_valid_ast('d0500000-0000-4000-8000-000000000006'),
       '{blocks,3,headerRows}', '9')
   where id = 'd0410000-0000-4000-8000-000000000006'
$sql$, '23514', NULL, 'headerRows must not exceed the row count');
select throws_ok($sql$
  update public.organization_document_translations
     set body_ast = pg_temp.reader_valid_ast('d0500000-0000-4000-8000-000000000006')
       #- '{blocks,3,rows,0,0,scope}'
   where id = 'd0410000-0000-4000-8000-000000000006'
$sql$, '23514', NULL, 'header cells require a scope');
select throws_ok($sql$
  update public.organization_document_translations
     set body_ast = jsonb_set(
       pg_temp.reader_valid_ast('d0500000-0000-4000-8000-000000000006'),
       '{blocks,3,rows,0,0,scope}', '"invalid"')
   where id = 'd0410000-0000-4000-8000-000000000006'
$sql$, '23514', NULL, 'header scope must be col/row/colgroup/rowgroup');
select throws_ok($sql$
  update public.organization_document_translations
     set body_ast = jsonb_set(
       pg_temp.reader_valid_ast('d0500000-0000-4000-8000-000000000006'),
       '{blocks,3,rows,1,0,scope}', '"col"')
   where id = 'd0410000-0000-4000-8000-000000000006'
$sql$, '23514', NULL, 'non-header cells must not carry a scope');
select throws_ok($sql$
  update public.organization_document_translations
     set body_ast = jsonb_set(
       pg_temp.reader_valid_ast('d0500000-0000-4000-8000-000000000006'),
       '{blocks,3,rows,1,0,colspan}', '0')
   where id = 'd0410000-0000-4000-8000-000000000006'
$sql$, '23514', NULL, 'colspan must be greater than zero');
select throws_ok($sql$
  update public.organization_document_translations
     set body_ast = jsonb_set(
       pg_temp.reader_valid_ast('d0500000-0000-4000-8000-000000000006'),
       '{blocks,3,rows,1,1,rowspan}', '-1')
   where id = 'd0410000-0000-4000-8000-000000000006'
$sql$, '23514', NULL, 'rowspan must be greater than zero');

-- ---------------------------------------------------------------------------
-- Image alt/decorative/asset rules
-- ---------------------------------------------------------------------------

select throws_ok($sql$
  update public.organization_document_translations
     set body_ast = pg_temp.reader_valid_ast('d0500000-0000-4000-8000-000000000006')
       #- '{blocks,4,alt}'
   where id = 'd0410000-0000-4000-8000-000000000006'
$sql$, '23514', NULL, 'images require an alt property');

select throws_ok($sql$
  update public.organization_document_translations
     set body_ast = jsonb_set(
       pg_temp.reader_valid_ast('d0500000-0000-4000-8000-000000000006'),
       '{blocks,4,decorative}', 'true')
   where id = 'd0410000-0000-4000-8000-000000000006'
$sql$, '23514', NULL, 'decorative images require empty alt text');

select throws_ok($sql$
  update public.organization_document_translations
     set body_ast = jsonb_set(
       pg_temp.reader_valid_ast('d0500000-0000-4000-8000-000000000006'),
       '{blocks,4,alt}', '""')
   where id = 'd0410000-0000-4000-8000-000000000006'
$sql$, '23514', NULL, 'non-decorative images require non-empty alt text');

select throws_ok($sql$
  update public.organization_document_translations
     set body_ast = jsonb_set(
       pg_temp.reader_valid_ast('d0500000-0000-4000-8000-000000000006'),
       '{blocks,4,assetId}', '"not-a-uuid"')
   where id = 'd0410000-0000-4000-8000-000000000006'
$sql$, '23514', NULL, 'image assetId must be a UUID');

select throws_ok($sql$
  update public.organization_document_translations
     set body_ast = pg_temp.reader_valid_ast('d0500000-0000-4000-8000-0000000000ff')
   where id = 'd0410000-0000-4000-8000-000000000006'
$sql$, '23514', NULL, 'images must reference an existing content asset');

select throws_ok($sql$
  update public.organization_document_translations
     set body_ast = pg_temp.reader_valid_ast('d0500000-0000-4000-8000-000000000004')
   where id = 'd0410000-0000-4000-8000-000000000006'
$sql$, '23514', NULL, 'images must be owned by the translation parent');

select throws_ok($sql$
  update public.organization_document_translations
     set body_ast = pg_temp.reader_valid_ast('d0500000-0000-4000-8000-000000000005')
   where id = 'd0410000-0000-4000-8000-000000000006'
$sql$, '23514', NULL, 'images must match the translation locale');

select lives_ok($sql$
  update public.organization_document_translations
     set body_ast = jsonb_set(
       jsonb_set(
         pg_temp.reader_valid_ast('d0500000-0000-4000-8000-000000000006'),
         '{blocks,4,decorative}', 'true'),
       '{blocks,4,alt}', '""')
   where id = 'd0410000-0000-4000-8000-000000000006'
$sql$, 'decorative image with empty alt is accepted');

select throws_ok($sql$
  update public.organization_document_translations
     set body_ast = jsonb_set(
       pg_temp.reader_valid_ast('d0500000-0000-4000-8000-000000000006'),
       '{blocks,4,caption}', '42')
   where id = 'd0410000-0000-4000-8000-000000000006'
$sql$, '23514', NULL, 'image captions must be strings');

-- Restore a valid AST for the owner, then prove the publication trigger too.
update public.organization_document_translations
   set body_ast = pg_temp.reader_valid_ast('d0500000-0000-4000-8000-000000000006'),
       body_ast_version = 1
 where id = 'd0410000-0000-4000-8000-000000000006';

select lives_ok($sql$
  update public.publication_translations
     set body_ast = pg_temp.reader_valid_ast('d0500000-0000-4000-8000-000000000003'),
         body_ast_version = 1
   where id = 'd0420000-0000-4000-8000-000000000004'
$sql$, 'publication translation validates and projects its AST');

select ok(
  (select body from public.publication_translations
    where id = 'd0420000-0000-4000-8000-000000000004')
  like '%Reader Heading%',
  'publication body projection includes AST text');

-- ---------------------------------------------------------------------------
-- Root source metadata checks
-- ---------------------------------------------------------------------------

select throws_ok($sql$
  update public.organization_documents set source_provider = 'upload'
   where id = 'd0400000-0000-4000-8000-000000000001'
$sql$, '23514', NULL, 'upload source requires source_path');
select throws_ok($sql$
  update public.organization_documents set source_provider = 'google_doc'
   where id = 'd0400000-0000-4000-8000-000000000001'
$sql$, '23514', NULL, 'google_doc source requires source_external_id');
select throws_ok($sql$
  update public.organization_documents set allow_original_download = true
   where id = 'd0400000-0000-4000-8000-000000000001'
$sql$, '23514', NULL, 'original download requires a source_path');
select throws_ok($sql$
  update public.organization_documents
     set source_path = 'https://example.org/statute.pdf'
   where id = 'd0400000-0000-4000-8000-000000000001'
$sql$, '23514', NULL, 'source_path must not be a URL');
select lives_ok($sql$
  update public.organization_documents
     set source_provider = 'upload', source_path = 'sources/statute.docx',
         source_mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         allow_original_download = true
   where id = 'd0400000-0000-4000-8000-000000000001'
$sql$, 'valid upload metadata and download toggle are accepted');
select lives_ok($sql$
  update public.publications
     set source_provider = 'google_doc', source_external_id = 'drive-doc-123',
         source_synced_at = now()
   where id = 'd0400000-0000-4000-8000-000000000004'
$sql$, 'valid google_doc metadata is accepted');

-- Reset for deterministic role assertions below.
update public.organization_documents
   set source_provider = 'manual', source_path = null, source_mime = null,
       allow_original_download = false
 where id = 'd0400000-0000-4000-8000-000000000001';

-- ---------------------------------------------------------------------------
-- content_assets RLS: published owner read, admin write, anon denial
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims', $json${"role":"anon"}$json$, true);
set local role anon;

select is(
  (select count(*) from public.content_assets
    where id = 'd0500000-0000-4000-8000-000000000001'),
  1::bigint, 'anon reads an asset of a published document');
select is(
  (select count(*) from public.content_assets
    where id = 'd0500000-0000-4000-8000-000000000002'),
  0::bigint, 'anon cannot read an asset of a draft document');
select is(
  (select count(*) from public.content_assets
    where id = 'd0500000-0000-4000-8000-000000000003'),
  1::bigint, 'anon reads an asset of a published publication');

select throws_ok($sql$
  insert into public.content_assets
    (id, organization_document_id, locale, storage_path, mime_type, width, height, sha256)
  values ('d0500000-0000-4000-8000-0000000000f1',
          'd0400000-0000-4000-8000-000000000001', 'en',
          'content-assets/anon.png', 'image/png', 10, 10, repeat('1', 64))
$sql$, '42501', NULL, 'anon insert denied on content_assets');

select throws_ok($sql$
  update public.content_assets set size_bytes = 1
   where id = 'd0500000-0000-4000-8000-000000000001'
$sql$, '42501', NULL, 'anon update denied on content_assets');

select throws_ok($sql$
  delete from public.content_assets
   where id = 'd0500000-0000-4000-8000-000000000001'
$sql$, '42501', NULL, 'anon delete denied on content_assets');

reset role;

select set_config('request.jwt.claims',
  $json${"sub":"d0600000-0000-4000-8000-0000000000a1","role":"authenticated"}$json$,
  true);
set local role authenticated;

select throws_ok($sql$
  insert into public.content_assets
    (id, organization_document_id, locale, storage_path, mime_type, width, height, sha256)
  values ('d0500000-0000-4000-8000-0000000000f2',
          'd0400000-0000-4000-8000-000000000001', 'en',
          'content-assets/nonadmin.png', 'image/png', 10, 10, repeat('2', 64))
$sql$, '42501', NULL, 'non-admin insert denied on content_assets');

with u as (
  update public.content_assets set size_bytes = 1
   where id = 'd0500000-0000-4000-8000-000000000001'
  returning 1
)
select is((select count(*) from u), 0::bigint,
  'non-admin update affects no content assets');

reset role;

select set_config('request.jwt.claims',
  $json${"sub":"d0600000-0000-4000-8000-0000000000a2","role":"authenticated","app_metadata":{"role":"admin"}}$json$,
  true);
set local role authenticated;

select is(
  (select count(*) from public.content_assets
    where id = 'd0500000-0000-4000-8000-000000000002'),
  1::bigint, 'admin reads a draft owner asset');

insert into public.content_assets
  (id, organization_document_id, locale, storage_path, mime_type, width, height, sha256)
values ('d0500000-0000-4000-8000-0000000000a1',
        'd0400000-0000-4000-8000-000000000001', 'en',
        'content-assets/admin.png', 'image/png', 10, 10, repeat('3', 64));

select is(
  (select count(*) from public.content_assets
    where id = 'd0500000-0000-4000-8000-0000000000a1'),
  1::bigint, 'admin insert succeeds on content_assets');

update public.content_assets set size_bytes = 42
 where id = 'd0500000-0000-4000-8000-0000000000a1';
select is(
  (select size_bytes from public.content_assets
    where id = 'd0500000-0000-4000-8000-0000000000a1'),
  42::bigint, 'admin update succeeds on content_assets');

delete from public.content_assets
 where id = 'd0500000-0000-4000-8000-0000000000a1';
select is(
  (select count(*) from public.content_assets
    where id = 'd0500000-0000-4000-8000-0000000000a1'),
  0::bigint, 'admin delete succeeds on content_assets');

-- The asset-ownership check runs SECURITY INVOKER; prove an admin can still
-- write a validated AST (the admin select policy exposes the asset row).
select lives_ok($sql$
  update public.organization_document_translations
     set body_ast = pg_temp.reader_valid_ast('d0500000-0000-4000-8000-000000000005'),
         body_ast_version = 1
   where id = 'd0410000-0000-4000-8000-000000000007'
$sql$, 'admin can persist a validated AST through RLS');

select ok(
  (select body from public.organization_document_translations
    where id = 'd0410000-0000-4000-8000-000000000007')
  like '%Reader Heading%',
  'admin AST write projects the body under RLS');

reset role;

-- ---------------------------------------------------------------------------
-- content-sources storage boundary
-- ---------------------------------------------------------------------------

insert into storage.objects (id, bucket_id, name)
values ('d0600000-0000-4000-8000-000000000001', 'content-sources',
        'sources/regulations.docx');

select set_config('storage.allow_delete_query', 'true', true);

select set_config('request.jwt.claims', $json${"role":"anon"}$json$, true);
set local role anon;

select is(
  (select count(*) from storage.objects
    where id = 'd0600000-0000-4000-8000-000000000001'),
  0::bigint, 'anon cannot read content-sources objects');

select throws_ok($sql$
  insert into storage.objects (id, bucket_id, name)
  values ('d0600000-0000-4000-8000-0000000000f1', 'content-sources',
          'sources/anon.docx')
$sql$, '42501', NULL, 'anon insert denied on content-sources');

reset role;

select set_config('request.jwt.claims',
  $json${"sub":"d0600000-0000-4000-8000-0000000000b1","role":"authenticated"}$json$,
  true);
set local role authenticated;

select is(
  (select count(*) from storage.objects
    where id = 'd0600000-0000-4000-8000-000000000001'),
  0::bigint, 'non-admin cannot read content-sources objects');

reset role;

select set_config('request.jwt.claims',
  $json${"sub":"d0600000-0000-4000-8000-0000000000b2","role":"authenticated","app_metadata":{"role":"admin"}}$json$,
  true);
set local role authenticated;

select is(
  (select count(*) from storage.objects
    where id = 'd0600000-0000-4000-8000-000000000001'),
  1::bigint, 'admin reads content-sources objects');

insert into storage.objects (id, bucket_id, name)
values ('d0600000-0000-4000-8000-000000000002', 'content-sources',
        'sources/admin.docx');
select is(
  (select count(*) from storage.objects
    where id = 'd0600000-0000-4000-8000-000000000002'),
  1::bigint, 'admin insert succeeds on content-sources');

delete from storage.objects
 where id = 'd0600000-0000-4000-8000-000000000002';
select is(
  (select count(*) from storage.objects
    where id = 'd0600000-0000-4000-8000-000000000002'),
  0::bigint, 'admin delete succeeds on content-sources');

reset role;

select * from finish();
rollback;
