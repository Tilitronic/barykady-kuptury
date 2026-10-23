-- T-031 — calendar_event_links invariants (pgTAP).
--
-- Design authority:
--   * docs/architecture.md §4 — one mapping row per (calendar_id,
--     google_event_id); the project is zero-or-one and `ON DELETE SET NULL`
--     must keep the event valid after its project disappears.
--   * docs/PRODUCT_REQUIREMENTS.md §4 (Events) — an event can be associated
--     with zero or one project and events without projects render normally.
--   * docs/architecture.md §6.1 — `events:write` gates writes; the public
--     policy hides mappings to unpublished projects (T-013).
--
-- The idempotency proof uses the same statement PostgREST emits for
-- `.upsert(..., { onConflict: "calendar_id,google_event_id" })`: PostgreSQL
-- resolves ON CONFLICT atomically, so a repeat assignment cannot create a
-- duplicate row and needs no RPC.
--
-- The whole file runs in one transaction and rolls back; fixtures never leak.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(7);

-- ---------------------------------------------------------------------------
-- Fixtures (admin context)
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  $json${"sub":"a7000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"admin"}}$json$,
  true
);
set local role authenticated;

insert into public.projects (id, slug, status, published_at) values
  ('a7000000-0000-4000-8000-000000000101', 'pgtap-event-project-one', 'published', now()),
  ('a7000000-0000-4000-8000-000000000102', 'pgtap-event-project-two', 'published', now()),
  ('a7000000-0000-4000-8000-000000000103', 'pgtap-event-project-draft', 'draft', null);

-- First assignment and an idempotent repeat that changes the project.
insert into public.calendar_event_links (calendar_id, google_event_id, project_id)
values ('pgtap-calendar@example.org', 'pgtap-event-published',
        'a7000000-0000-4000-8000-000000000101')
on conflict (calendar_id, google_event_id)
do update set project_id = excluded.project_id;

insert into public.calendar_event_links (calendar_id, google_event_id, project_id)
values ('pgtap-calendar@example.org', 'pgtap-event-published',
        'a7000000-0000-4000-8000-000000000102')
on conflict (calendar_id, google_event_id)
do update set project_id = excluded.project_id;

-- A mapping to a draft: legal to store, never public.
insert into public.calendar_event_links (calendar_id, google_event_id, project_id)
values ('pgtap-calendar@example.org', 'pgtap-event-draft',
        'a7000000-0000-4000-8000-000000000103');

select is(
  (
    select count(*)
      from public.calendar_event_links
     where calendar_id = 'pgtap-calendar@example.org'
       and google_event_id = 'pgtap-event-published'
  ),
  1::bigint,
  'assigning twice keeps exactly one mapping row'
);

select is(
  (
    select project_id
      from public.calendar_event_links
     where calendar_id = 'pgtap-calendar@example.org'
       and google_event_id = 'pgtap-event-published'
  ),
  'a7000000-0000-4000-8000-000000000102'::uuid,
  'the repeat assignment updates the existing row to the new project'
);

-- ---------------------------------------------------------------------------
-- Public read follows the linked project lifecycle (T-013)
-- ---------------------------------------------------------------------------

reset role;
select set_config('request.jwt.claims', $json${"role":"anon"}$json$, true);
set local role anon;

select is(
  (
    select count(*)
      from public.calendar_event_links
     where calendar_id = 'pgtap-calendar@example.org'
       and google_event_id = 'pgtap-event-published'
  ),
  1::bigint,
  'anon reads a mapping to a published project'
);

select is(
  (
    select count(*)
      from public.calendar_event_links
     where calendar_id = 'pgtap-calendar@example.org'
       and google_event_id = 'pgtap-event-draft'
  ),
  0::bigint,
  'anon cannot read a mapping to a draft project'
);

-- ---------------------------------------------------------------------------
-- Project deletion unlinks without removing the event identity
-- ---------------------------------------------------------------------------

reset role;
select set_config(
  'request.jwt.claims',
  $json${"sub":"a7000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"admin"}}$json$,
  true
);
set local role authenticated;

delete from public.projects
 where id = 'a7000000-0000-4000-8000-000000000102';

select is(
  (
    select count(*)
      from public.calendar_event_links
     where calendar_id = 'pgtap-calendar@example.org'
       and google_event_id = 'pgtap-event-published'
  ),
  1::bigint,
  'deleting the project keeps the mapping row (event remains renderable)'
);

select is(
  (
    select project_id
      from public.calendar_event_links
     where calendar_id = 'pgtap-calendar@example.org'
       and google_event_id = 'pgtap-event-published'
  ),
  null::uuid,
  'ON DELETE SET NULL leaves the mapping unlinked'
);

reset role;
select set_config('request.jwt.claims', $json${"role":"anon"}$json$, true);
set local role anon;

select is(
  (
    select count(*)
      from public.calendar_event_links
     where calendar_id = 'pgtap-calendar@example.org'
       and google_event_id = 'pgtap-event-published'
  ),
  1::bigint,
  'an unlinked mapping stays publicly readable (event renders without a project)'
);

select * from finish();
rollback;
