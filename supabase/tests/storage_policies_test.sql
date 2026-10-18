-- T-014 — Storage bucket configuration and storage.objects policies (pgTAP).
--
-- Authority:
--   * docs/architecture.md §6 — public access must be deliberate; admin write
--     policies must be distinct from public read; reject active content.
--   * docs/PRODUCT_REQUIREMENTS.md §4 — public downloads work without auth.
--   * docs/tickets/T-014-storage-policies.md — two public-read/admin-write
--     buckets, no public write path, anonymous cannot list outside them.
--   * docs/tickets/DECISIONS.md D-12 (PDF + original DOCX) and D-17
--     (public.is_admin() is the only admin-claim check).
--
-- Identity simulation follows docs/TESTING.md §3: SET LOCAL ROLE plus
-- request.jwt.claims. The service-role key is never used as an ordinary user.
-- The whole file runs in one transaction and rolls back; fixtures never leak
-- into the seeded database.
--
-- Expected RED before the T-014 migration exists: the bucket assertions fail
-- and the object fixtures cannot link to the missing buckets (FK error). After
-- the migration the positive public-read and admin-write paths must pass.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(24);

-- ---------------------------------------------------------------------------
-- Bucket definitions (migration-as-truth)
-- ---------------------------------------------------------------------------

select is(
  (select count(*) from storage.buckets where id = 'public-documents'),
  1::bigint,
  'public-documents bucket exists'
);
select is(
  (select public from storage.buckets where id = 'public-documents'),
  true,
  'public-documents is public-read'
);
select is(
  (select file_size_limit from storage.buckets where id = 'public-documents'),
  52428800::bigint,
  'public-documents enforces the 50 MiB limit'
);
select is(
  (select allowed_mime_types from storage.buckets where id = 'public-documents'),
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]::text[],
  'public-documents allows PDF and DOCX only'
);

select is(
  (select count(*) from storage.buckets where id = 'public-media'),
  1::bigint,
  'public-media bucket exists'
);
select is(
  (select public from storage.buckets where id = 'public-media'),
  true,
  'public-media is public-read'
);
select is(
  (select file_size_limit from storage.buckets where id = 'public-media'),
  52428800::bigint,
  'public-media enforces the 50 MiB limit'
);
select is(
  (select allowed_mime_types from storage.buckets where id = 'public-media'),
  array['image/png', 'image/jpeg', 'image/webp']::text[],
  'public-media allows PNG, JPEG and WebP only'
);

select ok(
  not exists (
    select 1
      from storage.buckets
     where id in ('public-documents', 'public-media')
       and allowed_mime_types && array[
         'image/svg+xml',
         'text/html',
         'application/xhtml+xml',
         'text/javascript',
         'application/javascript'
       ]::text[]
  ),
  'neither public bucket allows an active-content MIME type'
);

-- ---------------------------------------------------------------------------
-- RLS and policy inventory
-- ---------------------------------------------------------------------------

select is(
  (select relrowsecurity from pg_class where oid = 'storage.objects'::regclass),
  true,
  'RLS remains enabled on storage.objects'
);

select is(
  (select count(*)
     from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname in (
        'storage_objects_select_public',
        'storage_objects_insert_admin',
        'storage_objects_update_admin',
        'storage_objects_delete_admin'
      )),
  4::bigint,
  'storage.objects has public select plus admin insert/update/delete policies'
);

-- ---------------------------------------------------------------------------
-- Fictional fixtures (inserted as the migration superuser; RLS bypassed here)
-- ---------------------------------------------------------------------------

insert into storage.objects (id, bucket_id, name) values
  ('c0000000-0000-4000-8000-000000000001', 'public-documents',
   'fixtures/rls/public-statute.pdf'),
  ('c0000000-0000-4000-8000-000000000002', 'public-media',
   'fixtures/rls/project-cover.webp');

-- A test-only private bucket proves the public select policy is scoped to the
-- two public buckets rather than to storage.objects as a whole.
insert into storage.buckets (id, name, public)
values ('t014-private-test', 't014-private-test', false);
insert into storage.objects (id, bucket_id, name) values
  ('c0000000-0000-4000-8000-000000000003', 't014-private-test',
   'fixtures/rls/private.pdf');

-- The Storage API sets this GUC when it performs a delete. Direct DELETE is
-- otherwise blocked by storage.protect_delete(), which would mask the RLS
-- result this test is asserting.
select set_config('storage.allow_delete_query', 'true', true);

-- ---------------------------------------------------------------------------
-- Anonymous: public reads succeed; private listing and all writes are denied
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims', $json${"role":"anon"}$json$, true);
set local role anon;

select is(
  (select count(*) from storage.objects
    where id = 'c0000000-0000-4000-8000-000000000001'),
  1::bigint,
  'anon reads a known object in public-documents'
);
select is(
  (select count(*) from storage.objects
    where id = 'c0000000-0000-4000-8000-000000000002'),
  1::bigint,
  'anon reads a known object in public-media'
);
select is(
  (select count(*) from storage.objects
    where bucket_id = 't014-private-test'),
  0::bigint,
  'anon cannot list objects outside the public buckets'
);

select throws_ok(
  $sql$ insert into storage.objects (id, bucket_id, name)
        values ('c0000000-0000-4000-8000-0000000000f1', 'public-documents',
                'fixtures/rls/anon-upload.pdf') $sql$,
  '42501',
  NULL,
  'anon insert denied on storage.objects'
);

with u as (
  update storage.objects
     set name = 'fixtures/rls/anon-updated.pdf'
   where id = 'c0000000-0000-4000-8000-000000000001'
  returning 1
)
select is((select count(*) from u), 0::bigint,
  'anon update affects no storage objects');

with d as (
  delete from storage.objects
   where id = 'c0000000-0000-4000-8000-000000000001'
  returning 1
)
select is((select count(*) from d), 0::bigint,
  'anon delete affects no storage objects');

reset role;

-- ---------------------------------------------------------------------------
-- Authenticated non-admin: reads public objects, but cannot mutate
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  $json${"sub":"c0000000-0000-4000-8000-0000000000a1","role":"authenticated"}$json$,
  true);
set local role authenticated;

select throws_ok(
  $sql$ insert into storage.objects (id, bucket_id, name)
        values ('c0000000-0000-4000-8000-0000000000f2', 'public-media',
                'fixtures/rls/nonadmin-upload.webp') $sql$,
  '42501',
  NULL,
  'non-admin insert denied on storage.objects'
);

with u as (
  update storage.objects
     set name = 'fixtures/rls/nonadmin-updated.webp'
   where id = 'c0000000-0000-4000-8000-000000000002'
  returning 1
)
select is((select count(*) from u), 0::bigint,
  'non-admin update affects no storage objects');

with d as (
  delete from storage.objects
   where id = 'c0000000-0000-4000-8000-000000000002'
  returning 1
)
select is((select count(*) from d), 0::bigint,
  'non-admin delete affects no storage objects');

reset role;

-- ---------------------------------------------------------------------------
-- Administrator: reads public objects and can insert/update/delete
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  $json${"sub":"c0000000-0000-4000-8000-0000000000a2","role":"authenticated","app_metadata":{"role":"admin"}}$json$,
  true);
set local role authenticated;

select is(
  (select count(*) from storage.objects
    where id = 'c0000000-0000-4000-8000-000000000001'),
  1::bigint,
  'admin reads a known object in public-documents'
);

insert into storage.objects (id, bucket_id, name)
values ('c0000000-0000-4000-8000-000000000004', 'public-media',
        'fixtures/rls/admin-upload.webp');
select is(
  (select count(*) from storage.objects
    where id = 'c0000000-0000-4000-8000-000000000004'),
  1::bigint,
  'admin insert succeeds on storage.objects'
);

update storage.objects
   set name = 'fixtures/rls/admin-upload-updated.webp'
 where id = 'c0000000-0000-4000-8000-000000000004';
select is(
  (select name from storage.objects
    where id = 'c0000000-0000-4000-8000-000000000004'),
  'fixtures/rls/admin-upload-updated.webp',
  'admin update succeeds on storage.objects'
);

delete from storage.objects
 where id = 'c0000000-0000-4000-8000-000000000004';
select is(
  (select count(*) from storage.objects
    where id = 'c0000000-0000-4000-8000-000000000004'),
  0::bigint,
  'admin delete succeeds on storage.objects'
);

reset role;

select * from finish();
rollback;
