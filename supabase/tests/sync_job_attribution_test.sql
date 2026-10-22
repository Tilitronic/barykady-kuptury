-- T-042 review fix — content_sync_jobs.requested_by is wired on every path.
--
-- Direction (D-41/ana002 §8): attribution is not decorative. The manual admin
-- insert gets the caller id from the browser session; the public/scheduled
-- enqueue functions inherit the link-owner id from the most recent attributed
-- job for the same entity. Nothing may create a fresh Google sync job without
-- an owner when one is knowable.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

insert into public.organization_documents
  (id, slug, status, document_type, language, source_provider,
   source_external_id, sort_order)
values
  ('b0420000-0000-4000-8000-000000000001', 'attribution-linked', 'published',
   'report', 'en', 'google_doc', 'drive-attribution', 1),
  ('b0420000-0000-4000-8000-000000000002', 'attribution-unlinked', 'published',
   'report', 'en', 'google_doc', 'drive-unlinked', 2);

-- A prior manual job is the link-owner record for this document.
insert into public.content_sync_jobs
  (kind, entity_id, locale, status, request, requested_by)
values
  ('document', 'b0420000-0000-4000-8000-000000000001', 'en', 'succeeded',
   '{"mode":"apply","kind":"document","fileId":"drive-attribution"}'::jsonb,
   'b0420000-0000-4000-8000-0000000000aa');

select plan(5);

create temp table public_enqueue as
select public.enqueue_content_sync_job_v1(
  'document', 'b0420000-0000-4000-8000-000000000001', 'en',
  '{"mode":"apply","kind":"document","fileId":"drive-attribution"}'::jsonb) as id;

select is(
  (select requested_by from public.content_sync_jobs
    where id = (select id from public_enqueue)),
  'b0420000-0000-4000-8000-0000000000aa'::uuid,
  'public enqueue inherits the link-owner requested_by');

create temp table scheduled_claim as
select public.claim_scheduled_content_sync_job_v1(
  'document', 'b0420000-0000-4000-8000-000000000001', 'en',
  '{"mode":"apply","kind":"document","fileId":"drive-attribution"}'::jsonb) as id;

select is(
  (select id from scheduled_claim),
  null::uuid,
  'scheduled claim skips the active single-flight job');

update public.content_sync_jobs
   set status = 'succeeded'
 where id = (select id from public_enqueue);

create temp table scheduled_claim_2 as
select public.claim_scheduled_content_sync_job_v1(
  'document', 'b0420000-0000-4000-8000-000000000001', 'en',
  '{"mode":"apply","kind":"document","fileId":"drive-attribution"}'::jsonb) as id;

select is(
  (select requested_by from public.content_sync_jobs
    where id = (select id from scheduled_claim_2)),
  'b0420000-0000-4000-8000-0000000000aa'::uuid,
  'scheduled claim inherits the same link-owner');

create temp table unlinked_claim as
select public.claim_scheduled_content_sync_job_v1(
  'document', 'b0420000-0000-4000-8000-000000000002', 'en',
  '{"mode":"apply","kind":"document","fileId":"drive-unlinked"}'::jsonb) as id;

select is(
  (select requested_by from public.content_sync_jobs
    where id = (select id from unlinked_claim)),
  null::uuid,
  'a never-attributed entity keeps requested_by null instead of inventing an actor');

select is(
  (select count(*) from public.content_sync_jobs
    where requested_by is not null
      and entity_id = 'b0420000-0000-4000-8000-000000000001'),
  3::bigint,
  'every job for the linked document carries the owner');

select * from finish();
rollback;
