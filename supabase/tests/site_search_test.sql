-- T-039 — site search RPC contract (pgTAP).
--
-- Design authority:
--   * docs/tickets/DECISIONS.md D-26 — two-section site search; content comes
--     from one Postgres RPC over published pages/projects/publications/
--     documents/team, with calendar events merged client-side.
--   * docs/tickets/T-039-consolidated-pages-search.md §"Search contract" —
--     signature, published-only sources, requested-locale-with-English-
--     fallback, literal substring (no LIKE wildcards), rank 3/2/1, limit 1–50,
--     excerpt ≤ 180, and client-built routes (hence slug/page_key output).
--   * docs/architecture.md §6 — RLS remains the data boundary; the function is
--     SECURITY INVOKER and adds an explicit status filter so a future policy
--     change cannot silently widen public search.
--
-- Expected RED before the T-039 migration exists: every assertion errors with
-- "function public.search_published_content(...) does not exist".
--
-- The whole file runs in one transaction and rolls back, so fixtures never
-- leak into the seeded database. Identity simulation follows TESTING §3
-- (SET LOCAL ROLE + request.jwt.claims); no service-role shortcut.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Fictional fixtures (inserted as the migration superuser; RLS bypassed here)
-- ---------------------------------------------------------------------------
-- Tokens are deliberately unique ("zqx…") so assertions never depend on seed
-- content. Every published root has an English translation (T-038); some also
-- have Polish to prove requested-locale preference.

-- Site pages: published (title/meta/body ranks, long-ish body), fallback-only
-- English, draft, archived.
insert into public.site_pages (id, page_key, status, sort_order, published_at) values
  ('b1000000-0000-4000-8000-000000000001', 'search-fixture-page', 'published', 1, now()),
  ('b1000000-0000-4000-8000-000000000002', 'search-fixture-fallback-page', 'published', 2, now()),
  ('b1000000-0000-4000-8000-000000000003', 'search-fixture-draft-page', 'draft', 3, null),
  ('b1000000-0000-4000-8000-000000000004', 'search-fixture-archived-page', 'archived', 4, null);

insert into public.site_page_translations (id, page_id, locale, title, body, meta_description) values
  ('b1100000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'en',
   'Zqxtitlepage Search', 'zqxbodypage landing text', 'zqxmetapage zqxshared'),
  ('b1100000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000002', 'en',
   'Zqx Fallback Heading', 'zqxfallbackbody', null),
  ('b1100000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000003', 'en',
   'Zqxdraft Page', null, null),
  ('b1100000-0000-4000-8000-000000000004', 'b1000000-0000-4000-8000-000000000004', 'en',
   'Zqxarch Page', null, null);

-- Projects: published with EN+PL (locale preference), draft, archived,
-- rank-ordering pair, and a long body for the excerpt cap.
insert into public.projects (id, slug, status, published_at) values
  ('b2000000-0000-4000-8000-000000000001', 'search-fixture-project', 'published', now()),
  ('b2000000-0000-4000-8000-000000000002', 'search-fixture-draft-project', 'draft', null),
  ('b2000000-0000-4000-8000-000000000003', 'search-fixture-archived-project', 'archived', null),
  ('b2000000-0000-4000-8000-000000000004', 'search-fixture-long-project', 'published', now()),
  ('b2000000-0000-4000-8000-000000000005', 'search-fixture-order-title', 'published', now()),
  ('b2000000-0000-4000-8000-000000000006', 'search-fixture-order-summary', 'published', now());

insert into public.project_translations (id, project_id, locale, title, summary, body) values
  ('b2100000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'en',
   'Zqxproject Fixture', 'zqxsummary zqxshared', 'zqxprojectbody'),
  ('b2100000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000001', 'pl',
   'Zqxproject Projekt PL', 'zqxsummary PL', 'zqxprojectbody PL'),
  ('b2100000-0000-4000-8000-000000000003', 'b2000000-0000-4000-8000-000000000002', 'en',
   'Zqxdraft Project', null, null),
  ('b2100000-0000-4000-8000-000000000004', 'b2000000-0000-4000-8000-000000000003', 'en',
   'Zqxarch Project', null, null),
  ('b2100000-0000-4000-8000-000000000005', 'b2000000-0000-4000-8000-000000000004', 'en',
   'Zqxlong Fixture', null, 'zqxlong ' || repeat('y', 400)),
  ('b2100000-0000-4000-8000-000000000006', 'b2000000-0000-4000-8000-000000000005', 'en',
   'Zqxorder Beta', null, null),
  ('b2100000-0000-4000-8000-000000000007', 'b2000000-0000-4000-8000-000000000006', 'en',
   'Alpha Order Fixture', 'zqxorder summary', null);

-- Publications: published EN+PL, draft.
insert into public.publications (id, slug, status, publication_date, published_at) values
  ('b4000000-0000-4000-8000-000000000001', 'search-fixture-publication', 'published', '2026-03-01', now()),
  ('b4000000-0000-4000-8000-000000000002', 'search-fixture-draft-publication', 'draft', null, null);

insert into public.publication_translations
  (id, publication_id, locale, title, abstract, body) values
  ('b4100000-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-000000000001', 'en',
   'Zqxpubl Fixture', 'zqxabstract zqxshared', 'zqxbodypubl publication body'),
  ('b4100000-0000-4000-8000-000000000002', 'b4000000-0000-4000-8000-000000000001', 'pl',
   'Zqxpubl Publikacja PL', 'zqxabstract PL', null),
  ('b4100000-0000-4000-8000-000000000003', 'b4000000-0000-4000-8000-000000000002', 'en',
   'Zqxdraft Publication', null, null);

-- Organization documents: published text document, draft.
insert into public.organization_documents
  (id, slug, status, document_type, language, storage_path, sort_order, published_at)
values
  ('b5000000-0000-4000-8000-000000000001', 'search-fixture-document', 'published',
   'regulations', null, null, 1, now()),
  ('b5000000-0000-4000-8000-000000000002', 'search-fixture-draft-document', 'draft',
   'regulations', null, null, 2, null);

insert into public.organization_document_translations
  (id, document_id, locale, title, description, body)
values
  ('b5100000-0000-4000-8000-000000000001', 'b5000000-0000-4000-8000-000000000001', 'en',
   'Zqxdoc Fixture', 'zqxdesc zqxshared', 'zqxdocbody regulation text'),
  ('b5100000-0000-4000-8000-000000000002', 'b5000000-0000-4000-8000-000000000002', 'en',
   'Zqxdraft Document', null, 'zqxdraft body');

-- Team members: published, draft.
insert into public.team_members (id, name, status, sort_order, published_at) values
  ('b3000000-0000-4000-8000-000000000001', 'Zqxteam Fixture Person', 'published', 1, now()),
  ('b3000000-0000-4000-8000-000000000002', 'Zqxdraft Person', 'draft', 2, null);

insert into public.team_member_translations (id, member_id, locale, role, bio) values
  ('b3100000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000001', 'en',
   'zqxrole zqxshared', 'zqxteam bio text'),
  ('b3100000-0000-4000-8000-000000000002', 'b3000000-0000-4000-8000-000000000002', 'en',
   'zqxdraft role', null);

select plan(46);

-- ---------------------------------------------------------------------------
-- Contract shape and hardening
-- ---------------------------------------------------------------------------

select has_function(
  'public', 'search_published_content',
  array['text', 'content_locale', 'text[]', 'integer'],
  'search_published_content(text, content_locale, text[], integer) exists');

select is(
  (select prosecdef from pg_proc
    where oid = 'public.search_published_content(text, public.content_locale, text[], integer)'::regprocedure),
  false,
  'search RPC is SECURITY INVOKER (RLS remains the boundary)');

select ok(
  (select proconfig from pg_proc
    where oid = 'public.search_published_content(text, public.content_locale, text[], integer)'::regprocedure)
  @> array['search_path=public'],
  'search RPC pins search_path to public');

select ok(
  has_function_privilege('anon',
    'public.search_published_content(text, public.content_locale, text[], integer)',
    'execute'),
  'anon may execute the search RPC');

select ok(
  has_function_privilege('authenticated',
    'public.search_published_content(text, public.content_locale, text[], integer)',
    'execute'),
  'authenticated may execute the search RPC');

-- ---------------------------------------------------------------------------
-- Guardrails: NULL/empty/short queries return nothing
-- ---------------------------------------------------------------------------

select is((select count(*) from public.search_published_content(null, 'en')),
  0::bigint, 'NULL query returns nothing');
select is((select count(*) from public.search_published_content('', 'en')),
  0::bigint, 'empty query returns nothing');
select is((select count(*) from public.search_published_content('   ', 'en')),
  0::bigint, 'whitespace-only query returns nothing');
select is((select count(*) from public.search_published_content('z', 'en')),
  0::bigint, 'one-character query returns nothing');
select ok((select count(*) from public.search_published_content('zq', 'en')) > 0,
  'two-character query searches');

-- strpos(), not LIKE: wildcards are literal characters.
select is((select count(*) from public.search_published_content('%%', 'en')),
  0::bigint, 'percent signs are literal (no LIKE wildcard expansion)');
select is((select count(*) from public.search_published_content('__', 'en')),
  0::bigint, 'underscores are literal (no LIKE single-character wildcard)');
select is((select count(*) from public.search_published_content('zqx%', 'en')),
  0::bigint, 'a trailing percent does not act as a wildcard');
select is((select count(*) from public.search_published_content('%_', 'en')),
  0::bigint, 'mixed wildcard characters are literal');

-- ---------------------------------------------------------------------------
-- Each content kind is found, with the client route inputs
-- ---------------------------------------------------------------------------

select is((select title from public.search_published_content('zqxtitlepage', 'en')
            where kind = 'page'),
  'Zqxtitlepage Search', 'published site page is found');

select is((select page_key from public.search_published_content('zqxtitlepage', 'en')
            where kind = 'page'),
  'search-fixture-page', 'page result carries page_key');
select is((select slug from public.search_published_content('zqxtitlepage', 'en')
            where kind = 'page'),
  null::text, 'page result has no slug');

select is((select slug from public.search_published_content('zqxproject', 'en')
            where kind = 'project' and title = 'Zqxproject Fixture'),
  'search-fixture-project', 'project result carries the canonical slug');
select is((select page_key from public.search_published_content('zqxproject', 'en')
            where kind = 'project' and title = 'Zqxproject Fixture'),
  null::text, 'project result has no page_key');

select is((select title from public.search_published_content('zqxpubl', 'en')
            where kind = 'publication'),
  'Zqxpubl Fixture', 'published publication is found');

select is((select title from public.search_published_content('zqxdoc', 'en')
            where kind = 'document'),
  'Zqxdoc Fixture', 'published document is found');

select is((select title from public.search_published_content('zqxteam', 'en')
            where kind = 'team'),
  'Zqxteam Fixture Person', 'published team member is found');

select is((select slug from public.search_published_content('zqxteam', 'en')
            where kind = 'team'),
  null::text, 'team result has no slug');
select is((select page_key from public.search_published_content('zqxteam', 'en')
            where kind = 'team'),
  null::text, 'team result has no page_key');

-- ---------------------------------------------------------------------------
-- Locale selection: requested locale first, English fallback second
-- ---------------------------------------------------------------------------

select is((select title from public.search_published_content('zqxproject', 'pl')
            where kind = 'project' and slug = 'search-fixture-project'),
  'Zqxproject Projekt PL', 'requested locale translation is preferred');

select is((select title from public.search_published_content('zqxproject', 'uk')
            where kind = 'project' and slug = 'search-fixture-project'),
  'Zqxproject Fixture', 'missing requested locale falls back to English');

select is((select title from public.search_published_content('zqxfallbackbody', 'pl')
            where kind = 'page'),
  'Zqx Fallback Heading', 'English fallback also applies to pages');

-- ---------------------------------------------------------------------------
-- Ranking: title 3, summary/abstract/description/role 2, body/bio 1
-- ---------------------------------------------------------------------------

select is((select rank from public.search_published_content('zqxtitlepage', 'en')
            where kind = 'page'),
  3, 'title match ranks 3');

select is((select rank from public.search_published_content('zqxmetapage', 'en')
            where kind = 'page'),
  2, 'page meta description match ranks 2');

select is((select rank from public.search_published_content('zqxbodypage', 'en')
            where kind = 'page'),
  1, 'page body match ranks 1');

select is((select rank from public.search_published_content('zqxsummary', 'en')
            where kind = 'project'),
  2, 'project summary match ranks 2');

select is((select rank from public.search_published_content('zqxprojectbody', 'en')
            where kind = 'project' and title = 'Zqxproject Fixture'),
  1, 'project body match ranks 1');

select is((select rank from public.search_published_content('zqxdocbody', 'en')
            where kind = 'document'),
  1, 'document body match ranks 1');

select is((select rank from public.search_published_content('zqxbodypubl', 'en')
            where kind = 'publication'),
  1, 'publication body match ranks 1 (T-040 projection)');

select is((select rank from public.search_published_content('zqxteam', 'en')
            where kind = 'team'),
  3, 'team name match ranks 3');

select is((select rank from public.search_published_content('zqxrole', 'en')
            where kind = 'team'),
  2, 'team role match ranks 2');

select is(
  (select array_agg(title) from public.search_published_content('zqxorder', 'en')
    where kind = 'project'),
  array['Zqxorder Beta', 'Alpha Order Fixture'],
  'results are ordered by rank descending, then title ascending');

-- ---------------------------------------------------------------------------
-- Filters, exclusion, limit, excerpt cap
-- ---------------------------------------------------------------------------

select is((select count(*) from public.search_published_content('zqxshared', 'en')),
  5::bigint, 'shared token matches all five database kinds');

select is(
  (select array_agg(kind order by kind) from public.search_published_content(
     'zqxshared', 'en', array['project', 'document'])),
  array['document', 'project'],
  'result_kinds filters the source kinds');

select is((select count(*) from public.search_published_content('zqxdraft', 'en')),
  0::bigint, 'draft rows are excluded');
select is((select count(*) from public.search_published_content('zqxarch', 'en')),
  0::bigint, 'archived rows are excluded');

select is((select count(*) from public.search_published_content('zqxshared', 'en', null, 2)),
  2::bigint, 'result_limit caps the row count');
select is((select count(*) from public.search_published_content('zqxshared', 'en', null, 0)),
  1::bigint, 'a non-positive limit clamps to 1');

select ok(
  (select max(length(excerpt)) from public.search_published_content('zqxlong', 'en')) <= 180,
  'excerpt is capped at 180 characters');

-- ---------------------------------------------------------------------------
-- Anonymous call: published rows through RLS, never drafts
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims', $json${"role":"anon"}$json$, true);
set local role anon;

select is((select count(*) from public.search_published_content('zqxshared', 'en')),
  5::bigint, 'anon call returns published rows across all kinds');

select is((select count(*) from public.search_published_content('zqxdraft', 'en')),
  0::bigint, 'anon call never returns drafts');

reset role;

select * from finish();
rollback;
