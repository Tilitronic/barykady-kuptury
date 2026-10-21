-- T-042 S9 — throttle, backoff and single-flight (pgTAP).
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

insert into public.organization_documents
  (id, slug, status, document_type, language, storage_path, source_provider,
   source_external_id, source_synced_at, source_modified_at, sort_order)
values
  ('f0410000-0000-4000-8000-000000000001', 's9-google', 'published',
   'report', 'en', null, 'google_doc', 'drive-1', now(), now() - interval '1 hour', 1),
  ('f0410000-0000-4000-8000-000000000002', 's9-manual', 'published',
   'report', 'en', null, 'manual', null, null, null, 2);

insert into public.publications
  (id, slug, status, language, source_provider, source_external_id,
   source_synced_at, source_modified_at, sort_order)
values
  ('f0420000-0000-4000-8000-000000000001', 's9-pub', 'published', 'en',
   'google_doc', 'drive-2', now(), now() - interval '1 hour', 1);

select plan(14);

select is(
  (select outcome from public.claim_content_check_v1('document', 's9-google', 15)),
  'checked', 'first check is allowed');
select is(
  (select source_checked_at is not null from public.organization_documents
    where id = 'f0410000-0000-4000-8000-000000000001'),
  true, 'first check records source_checked_at');
select is(
  (select outcome from public.claim_content_check_v1('document', 's9-google', 15)),
  'throttled', 'second check is throttled for 15 minutes');
select is(
  (select outcome from public.claim_content_check_v1('document', 's9-manual', 15)),
  'not-google', 'manual rows are not Drive-checked');
select is(
  (select outcome from public.claim_content_check_v1('document', 'missing', 15)),
  'not-found', 'unknown slugs are not disclosed');
select is(
  (select outcome from public.claim_content_check_v1('publication', 's9-pub', 15)),
  'checked', 'publications use the same check path');

select public.record_content_check_result_v1(
  'document', 'f0410000-0000-4000-8000-000000000001', false);
select is(
  (select source_check_failures from public.organization_documents
    where id = 'f0410000-0000-4000-8000-000000000001'),
  1, 'failure increments the backoff counter');
update public.organization_documents
   set source_checked_at = now() - interval '20 minutes'
 where id = 'f0410000-0000-4000-8000-000000000001';
select is(
  (select outcome from public.claim_content_check_v1('document', 's9-google', 15)),
  'throttled', 'one failure backs off to 30 minutes');
update public.organization_documents
   set source_checked_at = now() - interval '31 minutes'
 where id = 'f0410000-0000-4000-8000-000000000001';
select is(
  (select outcome from public.claim_content_check_v1('document', 's9-google', 15)),
  'checked', 'the check is allowed after the backoff window');

select public.record_content_check_result_v1(
  'document', 'f0410000-0000-4000-8000-000000000001', true);
select is(
  (select source_check_failures from public.organization_documents
    where id = 'f0410000-0000-4000-8000-000000000001'),
  0, 'a successful check resets failures');

create temp table s9_job as
select public.enqueue_content_sync_job_v1(
  'document', 'f0410000-0000-4000-8000-000000000001', 'en',
  '{"mode":"apply","kind":"document","fileId":"drive-1"}'::jsonb) as id;

select is(
  public.enqueue_content_sync_job_v1(
    'document', 'f0410000-0000-4000-8000-000000000001', 'en',
    '{"mode":"apply","kind":"document","fileId":"drive-1"}'::jsonb),
  (select id from s9_job),
  'a concurrent enqueue coalesces onto the same active job');

select is(
  public.claim_scheduled_content_sync_job_v1(
    'document', 'f0410000-0000-4000-8000-000000000001', 'en',
    '{"mode":"apply","kind":"document","fileId":"drive-1"}'::jsonb),
  null,
  'the scheduled runner skips an already-active job');

select ok(
  not has_function_privilege(
    'anon',
    'public.claim_content_check_v1(text,text,integer)',
    'EXECUTE'
  ),
  'anon has no execute privilege on the check RPC');

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok($sql$
  select public.claim_content_check_v1('document', 's9-google', 15)
$sql$, '42501', null, 'anon cannot call the service-role check RPC');
reset role;

select * from finish();
rollback;
