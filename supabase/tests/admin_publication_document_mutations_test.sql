-- T-029 — transactional publication/document mutations (pgTAP).
--
-- Design authority:
--   * docs/tickets/T-029-admin-publications-documents.md — URL xor file
--     versions, one active file per language, replacement removes the old
--     reference, documents with type/date/language/file/sort/publish.
--   * docs/architecture.md §4/§6.1 — normalized roots/translations/files;
--     `publications:write` and `documents:write` re-checked in-function.
--   * T-045/T-028 — the paired transactional RPC pattern per entity.
--
-- Expected RED before the T-029 migration exists: every signature/privilege
-- assertion fails (to_regprocedure is null) and every RPC call errors with
-- "function ... does not exist".
--
-- Identity simulation follows TESTING §3 (SET LOCAL ROLE + request.jwt.claims).
-- The whole file runs in one transaction and rolls back.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(45);

-- ---------------------------------------------------------------------------
-- Signatures, security and privileges
-- ---------------------------------------------------------------------------

select ok(
  to_regprocedure(
    'public.save_publication_v1(uuid,text,public.content_status,public.content_locale,date,text,integer,timestamptz,jsonb,jsonb)'
  ) is not null,
  'save_publication_v1 exists with the transactional save signature'
);

select is(
  (
    select prosecdef
      from pg_proc
     where oid = to_regprocedure(
       'public.save_publication_v1(uuid,text,public.content_status,public.content_locale,date,text,integer,timestamptz,jsonb,jsonb)'
     )
  ),
  false,
  'save_publication_v1 is SECURITY INVOKER'
);

select ok(
  (
    select proconfig
      from pg_proc
     where oid = to_regprocedure(
       'public.save_publication_v1(uuid,text,public.content_status,public.content_locale,date,text,integer,timestamptz,jsonb,jsonb)'
     )
  ) @> array['search_path=""'],
  'save_publication_v1 pins search_path'
);

select ok(
  exists (
    select 1 from pg_proc
     where oid = to_regprocedure(
         'public.save_publication_v1(uuid,text,public.content_status,public.content_locale,date,text,integer,timestamptz,jsonb,jsonb)'
       )
       and has_function_privilege('authenticated', oid, 'EXECUTE')
  ),
  'authenticated may execute save_publication_v1'
);

select ok(
  not exists (
    select 1 from pg_proc
     where oid = to_regprocedure(
         'public.save_publication_v1(uuid,text,public.content_status,public.content_locale,date,text,integer,timestamptz,jsonb,jsonb)'
       )
       and has_function_privilege('anon', oid, 'EXECUTE')
  ),
  'anon may not execute save_publication_v1'
);

select ok(
  to_regprocedure(
    'public.transition_publication_v1(uuid,public.content_status,timestamptz)'
  ) is not null,
  'transition_publication_v1 exists'
);

select is(
  (
    select prosecdef from pg_proc
     where oid = to_regprocedure(
       'public.transition_publication_v1(uuid,public.content_status,timestamptz)'
     )
  ),
  false,
  'transition_publication_v1 is SECURITY INVOKER'
);

select ok(
  to_regprocedure(
    'public.save_document_v1(uuid,text,public.content_status,text,public.content_locale,date,text,text,bigint,integer,timestamptz,jsonb)'
  ) is not null,
  'save_document_v1 exists'
);

select ok(
  (
    select proconfig from pg_proc
     where oid = to_regprocedure(
       'public.save_document_v1(uuid,text,public.content_status,text,public.content_locale,date,text,text,bigint,integer,timestamptz,jsonb)'
     )
  ) @> array['search_path=""'],
  'save_document_v1 pins search_path'
);

select ok(
  exists (
    select 1 from pg_proc
     where oid = to_regprocedure(
         'public.save_document_v1(uuid,text,public.content_status,text,public.content_locale,date,text,text,bigint,integer,timestamptz,jsonb)'
       )
       and has_function_privilege('authenticated', oid, 'EXECUTE')
  ),
  'authenticated may execute save_document_v1'
);

select ok(
  to_regprocedure(
    'public.transition_document_v1(uuid,public.content_status,timestamptz)'
  ) is not null,
  'transition_document_v1 exists'
);

select ok(
  not exists (
    select 1 from pg_proc
     where oid = to_regprocedure(
         'public.save_document_v1(uuid,text,public.content_status,text,public.content_locale,date,text,text,bigint,integer,timestamptz,jsonb)'
       )
       and has_function_privilege('anon', oid, 'EXECUTE')
  ),
  'anon may not execute save_document_v1'
);

-- ---------------------------------------------------------------------------
-- Admin publication save: root + translations + files in one transaction
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  $json${"sub":"d4000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"admin"}}$json$,
  true
);
set local role authenticated;

select ok(
  public.save_publication_v1(
    null,
    't029-annual-report',
    'draft',
    'en',
    '2026-05-01',
    null,
    null,
    null,
    $json$[
      {"locale":"en","title":"Annual report","abstract":"Abstract","authors":"Author"},
      {"locale":"pl","title":"Raport roczny","abstract":null,"authors":null}
    ]$json$,
    $json$[
      {"locale":"en","label":"EN PDF","storagePath":"publications/t029-en.pdf","mimeType":"application/pdf","sizeBytes":123},
      {"locale":"pl","label":"PL PDF","storagePath":"publications/t029-pl.pdf","mimeType":"application/pdf","sizeBytes":234}
    ]$json$
  ) is not null,
  'save_publication_v1 creates a publication and returns its id'
);

select is(
  (
    select count(*) from public.publication_translations t
      join public.publications p on p.id = t.publication_id
     where p.slug = 't029-annual-report'
  ),
  2::bigint,
  'both translations were written in the same transaction'
);

select is(
  (
    select count(*) from public.publication_files f
      join public.publications p on p.id = f.publication_id
     where p.slug = 't029-annual-report'
  ),
  2::bigint,
  'one file version per language exists'
);

select is(
  (
    select f.storage_path from public.publication_files f
      join public.publications p on p.id = f.publication_id
     where p.slug = 't029-annual-report' and f.locale = 'en'
  ),
  'publications/t029-en.pdf',
  'the stored value is the object key, never a public URL'
);

-- A URL and files together are ambiguous; the RPC must reject the case.
select throws_ok(
  $sql$
    select public.save_publication_v1(
      null,
      't029-both-actions',
      'draft',
      'en',
      null,
      'https://example.org/report',
      null,
      null,
      $json$[{"locale":"en","title":"Both","abstract":null,"authors":null}]$json$,
      $json$[{"locale":"en","label":null,"storagePath":"publications/t029-both.pdf","mimeType":"application/pdf","sizeBytes":1}]$json$
    )
  $sql$,
  '23514',
  null,
  'a publication cannot have both an external URL and file versions'
);

select throws_ok(
  $sql$
    select public.save_publication_v1(
      null,
      't029-no-action',
      'published',
      'en',
      null,
      null,
      null,
      null,
      $json$[{"locale":"en","title":"No action","abstract":null,"authors":null}]$json$,
      '[]'::jsonb
    )
  $sql$,
  '23514',
  null,
  'a published publication needs an external URL or a file version'
);

select throws_ok(
  $sql$
    select public.save_publication_v1(
      null,
      't029-absolute-url',
      'draft',
      'en',
      null,
      null,
      null,
      null,
      $json$[{"locale":"en","title":"Absolute","abstract":null,"authors":null}]$json$,
      $json$[{"locale":"en","label":null,"storagePath":"https://example.org/report.pdf","mimeType":"application/pdf","sizeBytes":1}]$json$
    )
  $sql$,
  '23514',
  null,
  'an absolute public URL is rejected at the data boundary'
);

-- ---------------------------------------------------------------------------
-- Replacement keeps exactly one active file per language
-- ---------------------------------------------------------------------------

select ok(
  public.save_publication_v1(
    (select id from public.publications where slug = 't029-annual-report'),
    't029-annual-report',
    'draft',
    'en',
    '2026-05-01',
    null,
    1,
    null,
    $json$[
      {"locale":"en","title":"Annual report","abstract":"Abstract","authors":"Author"},
      {"locale":"pl","title":"Raport roczny","abstract":null,"authors":null}
    ]$json$,
    $json$[
      {"locale":"en","label":"EN PDF v2","storagePath":"publications/t029-en-v2.pdf","mimeType":"application/pdf","sizeBytes":999}
    ]$json$
  ) is not null,
  'replacing a file version through the save RPC succeeds'
);

select is(
  (
    select count(*) from public.publication_files f
      join public.publications p on p.id = f.publication_id
     where p.slug = 't029-annual-report'
  ),
  1::bigint,
  'the omitted locale row is deleted (one active file remains)'
);

select is(
  (
    select f.storage_path from public.publication_files f
      join public.publications p on p.id = f.publication_id
     where p.slug = 't029-annual-report'
  ),
  'publications/t029-en-v2.pdf',
  'the replacement path replaced the old reference'
);

-- Metadata edits must not erase reader-owned body text.
reset role;
update public.publication_translations t
   set body = 'Imported body text'
  from public.publications p
 where p.id = t.publication_id
   and p.slug = 't029-annual-report'
   and t.locale = 'en';
set local role authenticated;

select ok(
  public.save_publication_v1(
  (select id from public.publications where slug = 't029-annual-report'),
  't029-annual-report',
  'published',
  'en',
  '2026-05-01',
  null,
  1,
  '2026-05-02T00:00:00Z',
  $json$[{"locale":"en","title":"Annual report updated","abstract":null,"authors":null}]$json$,
  $json$[{"locale":"en","label":"EN PDF v2","storagePath":"publications/t029-en-v2.pdf","mimeType":"application/pdf","sizeBytes":999}]$json$
) is not null,
  'publishing through the save RPC succeeds'
);

select is(
  (
    select t.body from public.publication_translations t
      join public.publications p on p.id = t.publication_id
     where p.slug = 't029-annual-report' and t.locale = 'en'
  ),
  'Imported body text',
  'the publication metadata upsert preserves imported body text'
);

select is(
  (
    select p.status::text from public.publications p
     where p.slug = 't029-annual-report'
  ),
  'published',
  'the save RPC persisted the published status'
);

select is(
  (
    select p.published_at from public.publications p
     where p.slug = 't029-annual-report'
  ),
  '2026-05-02T00:00:00Z'::timestamptz,
  'the save RPC persisted the publication timestamp'
);

select lives_ok(
  $sql$
    select public.transition_publication_v1(
      (select id from public.publications where slug = 't029-annual-report'),
      'draft',
      null
    )
  $sql$,
  'unpublishing through transition_publication_v1 succeeds'
);

select is(
  (
    select p.published_at from public.publications p
     where p.slug = 't029-annual-report'
  ),
  null::timestamptz,
  'unpublishing clears published_at'
);

select throws_ok(
  $sql$
    select public.save_publication_v1(
      null,
      't029-actionless-draft',
      'draft',
      'en',
      null,
      null,
      null,
      null,
      $json$[{"locale":"en","title":"Actionless","abstract":null,"authors":null}]$json$,
      '[]'::jsonb
    );
    select public.transition_publication_v1(
      (select id from public.publications where slug = 't029-actionless-draft'),
      'published',
      null
    );
  $sql$,
  '23514',
  null,
  'the publish transition refuses an actionless publication'
);

-- ---------------------------------------------------------------------------
-- Document save: root + translations, body preservation, unique slug
-- ---------------------------------------------------------------------------

select ok(
  public.save_document_v1(
    null,
    't029-statute',
    'draft',
    'statute',
    'en',
    '2026-05-03',
    'documents/t029-statute.pdf',
    'application/pdf',
    321,
    null,
    null,
    $json$[
      {"locale":"en","title":"Statute","description":"The statute"},
      {"locale":"pl","title":"Statut","description":null}
    ]$json$
  ) is not null,
  'save_document_v1 creates a document'
);

select is(
  (
    select count(*) from public.organization_document_translations t
      join public.organization_documents d on d.id = t.document_id
     where d.slug = 't029-statute'
  ),
  2::bigint,
  'both document translations were written atomically'
);

select is(
  (
    select d.storage_path from public.organization_documents d
     where d.slug = 't029-statute'
  ),
  'documents/t029-statute.pdf',
  'the document stores the object key'
);

-- T-017 body is owned by the reader/import path; a metadata edit must not
-- erase it.
reset role;
update public.organization_document_translations t
   set body = 'Imported statute body'
  from public.organization_documents d
 where d.id = t.document_id
   and d.slug = 't029-statute'
   and t.locale = 'en';
set local role authenticated;

select ok(
  public.save_document_v1(
  (select id from public.organization_documents where slug = 't029-statute'),
  't029-statute',
  'published',
  'statute',
  'en',
  '2026-05-03',
  'documents/t029-statute.pdf',
  'application/pdf',
  321,
  1,
  '2026-05-04T00:00:00Z',
  $json$[{"locale":"en","title":"Statute updated","description":null}]$json$
) is not null,
  'publishing a document through the save RPC succeeds'
);

select is(
  (
    select t.body from public.organization_document_translations t
      join public.organization_documents d on d.id = t.document_id
     where d.slug = 't029-statute' and t.locale = 'en'
  ),
  'Imported statute body',
  'the document metadata upsert preserves the T-017 body text'
);

select is(
  (
    select d.status::text from public.organization_documents d
     where d.slug = 't029-statute'
  ),
  'published',
  'the document save persisted the published status'
);

select throws_ok(
  $sql$
    select public.save_document_v1(
      null,
      't029-statute',
      'draft',
      'statute',
      'en',
      null,
      'documents/t029-duplicate.pdf',
      'application/pdf',
      1,
      null,
      null,
      $json$[{"locale":"en","title":"Duplicate","description":null}]$json$
    )
  $sql$,
  '23505',
  null,
  'the canonical document slug is unique'
);

select throws_ok(
  $sql$
    select public.save_document_v1(
      null,
      't029-bad-path',
      'draft',
      'report',
      'en',
      null,
      'https://example.org/report.pdf',
      'application/pdf',
      1,
      null,
      null,
      $json$[{"locale":"en","title":"Bad path","description":null}]$json$
    )
  $sql$,
  '23514',
  null,
  'a document storage path cannot be an absolute URL'
);

select lives_ok(
  $sql$
    select public.transition_document_v1(
      (select id from public.organization_documents where slug = 't029-statute'),
      'draft',
      null
    )
  $sql$,
  'unpublishing a document succeeds'
);

select is(
  (
    select d.published_at from public.organization_documents d
     where d.slug = 't029-statute'
  ),
  null::timestamptz,
  'document unpublish clears published_at'
);

-- ---------------------------------------------------------------------------
-- Scope matrix: publications:write vs documents:write vs non-admin
-- ---------------------------------------------------------------------------

reset role;
select set_config(
  'request.jwt.claims',
  $json${"sub":"d4000000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{"role":"editor","scopes":["publications:write"]}}$json$,
  true
);
set local role authenticated;

select lives_ok(
  $sql$
    select public.save_publication_v1(
      null,
      't029-scoped-publication',
      'draft',
      'en',
      null,
      'https://example.org/scoped',
      null,
      null,
      $json$[{"locale":"en","title":"Scoped","abstract":null,"authors":null}]$json$,
      '[]'::jsonb
    )
  $sql$,
  'a publications:write editor may save a publication'
);

select throws_ok(
  $sql$
    select public.save_document_v1(
      null,
      't029-scoped-document',
      'draft',
      'report',
      'en',
      null,
      'documents/scoped.pdf',
      'application/pdf',
      1,
      null,
      null,
      $json$[{"locale":"en","title":"Scoped","description":null}]$json$
    )
  $sql$,
  '42501',
  null,
  'a publications:write editor cannot save a document'
);

reset role;
select set_config(
  'request.jwt.claims',
  $json${"sub":"d4000000-0000-4000-8000-000000000003","role":"authenticated","app_metadata":{"role":"editor","scopes":["documents:write"]}}$json$,
  true
);
set local role authenticated;

select lives_ok(
  $sql$
    select public.save_document_v1(
      null,
      't029-scoped-document',
      'draft',
      'report',
      'en',
      null,
      'documents/scoped.pdf',
      'application/pdf',
      1,
      null,
      null,
      $json$[{"locale":"en","title":"Scoped doc","description":null}]$json$
    )
  $sql$,
  'a documents:write editor may save a document'
);

select throws_ok(
  $sql$
    select public.save_publication_v1(
      null,
      't029-wrong-scope',
      'draft',
      'en',
      null,
      'https://example.org/wrong',
      null,
      null,
      $json$[{"locale":"en","title":"Wrong","abstract":null,"authors":null}]$json$,
      '[]'::jsonb
    )
  $sql$,
  '42501',
  null,
  'a documents:write editor cannot save a publication'
);

reset role;
select set_config(
  'request.jwt.claims',
  $json${"sub":"d4000000-0000-4000-8000-000000000004","role":"authenticated"}$json$,
  true
);
set local role authenticated;

select throws_ok(
  $sql$
    select public.save_publication_v1(
      null,
      't029-non-admin',
      'draft',
      'en',
      null,
      'https://example.org/non-admin',
      null,
      null,
      $json$[{"locale":"en","title":"Non admin","abstract":null,"authors":null}]$json$,
      '[]'::jsonb
    )
  $sql$,
  '42501',
  null,
  'an authenticated non-admin cannot save a publication'
);

select throws_ok(
  $sql$
    select public.save_document_v1(
      null,
      't029-non-admin-document',
      'draft',
      'report',
      'en',
      null,
      'documents/non-admin.pdf',
      'application/pdf',
      1,
      null,
      null,
      $json$[{"locale":"en","title":"Non admin","description":null}]$json$
    )
  $sql$,
  '42501',
  null,
  'an authenticated non-admin cannot save a document'
);

select * from finish();
rollback;
