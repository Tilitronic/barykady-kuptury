-- T-012 seed fixtures.
--
-- The site_pages block below contains verified organization facts only
-- (T-016). Other tables hold clearly fictional sample fixtures to exercise the
-- schema (docs/TESTING.md §6) and are replaced by verified content in later
-- tickets (T-017/T-018/T-020).
--
-- Idempotent: fixed UUIDs + ON CONFLICT DO NOTHING, so re-running never
-- duplicates rows. Seeds execute as the migration superuser and bypass RLS.

-- ---------------------------------------------------------------------------
-- Site page: verified EN content; PL/UK titles only, flagged for review
-- ---------------------------------------------------------------------------

insert into public.site_pages (id, page_key, status, sort_order, published_at)
values ('00000000-0000-4000-8000-000000000101', 'about', 'published', 1, '2026-01-05T12:00:00Z')
on conflict (id) do nothing;

insert into public.site_page_translations (id, page_id, locale, slug, title, body, meta_description, needs_review)
values
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000101', 'en',
   'about', 'About us',
   E'## Mission\n\nTo expand Ukrainian culture beyond borders and give it the space it deserves.\n\n## History\n\nThe association was founded by Daria Yakovleva in Poznań.\n\n## Values\n\n- Identity\n- Education\n- Support\n- Community\n\n## Aims\n\nThe aims of the Association are:\n\n- Cultural diplomacy: acting as a "cultural bridge" between Ukrainians, Poles, and the international community.\n- Non-formal, educational and upbringing activities: popularizing knowledge, developing soft and civic skills, as well as raising youth awareness of democratic political processes.\n- Development of critical thinking and countering propaganda and disinformation.\n- Human rights protection, promoting gender equality, protecting women''s rights and the dignity of migrants and refugees.\n- Integration and support: activities for national and ethnic minorities, supporting the adaptation processes of Ukrainians and other foreigners in Poland.\n- National heritage and historical memory: protection of cultural assets and the restoration and cultivation of historical memory, with particular emphasis on the care of Ukrainian graves and memorial sites in Poland.\n- Environmental protection: initiating and supporting research on the impact of the Russian war on the ecology.\n- Promotion and organization of volunteering, as well as charitable activities.\n- Promotion and popularization of Ukrainian culture in Poland and worldwide.\n- Initiating public actions, assemblies, and protests in defense of human rights and democratic values.',
   'About the Barykady Kultury association.', false),
  ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000101', 'pl',
   'o-nas', 'O nas', null, null, true),
  ('00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000101', 'uk',
   'pro-nas', 'Про нас', null, null, true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Projects: one published+complete (featured, covered), one draft+incomplete
-- ---------------------------------------------------------------------------

insert into public.projects (
  id, status, featured_rank, cover_path, start_date, end_date, published_at
)
values (
  '00000000-0000-4000-8000-000000000201',
  'published',
  1,
  'fixtures/projects/sample-cover.webp',
  '2026-01-10',
  '2026-03-20',
  '2026-01-05T12:00:00Z'
)
on conflict (id) do nothing;

insert into public.project_translations (id, project_id, locale, slug, title, summary, body)
values
  ('00000000-0000-4000-8000-000000000211', '00000000-0000-4000-8000-000000000201', 'en',
   'sample-community-workshop', 'Sample Community Workshop (Fictional)',
   'A fictional summary used only by local development fixtures.',
   'A fictional description used only by local development fixtures.'),
  ('00000000-0000-4000-8000-000000000212', '00000000-0000-4000-8000-000000000201', 'pl',
   'przykladowy-warsztat-spoleczny', 'Przykladowy warsztat spoleczny (fikcyjny)',
   'Fikcyjne podsumowanie uzywane wylacznie w lokalnych danych testowych.',
   'Fikcyjny opis uzywany wylacznie w lokalnych danych testowych.'),
  ('00000000-0000-4000-8000-000000000213', '00000000-0000-4000-8000-000000000201', 'uk',
   'zrazkova-hromadska-maisternia', 'Zrazkova hromadska maisternia (fiktyvna)',
   'Fiktyvnyi korotkyi opys dlia lokalnykh testovykh danykh.',
   'Fiktyvnyi opys dlia lokalnykh testovykh danykh.')
on conflict (id) do nothing;

insert into public.projects (id, status)
values ('00000000-0000-4000-8000-000000000202', 'draft')
on conflict (id) do nothing;

insert into public.project_translations (id, project_id, locale, slug, title, summary)
values (
  '00000000-0000-4000-8000-000000000221',
  '00000000-0000-4000-8000-000000000202',
  'en',
  'sample-draft-project',
  'Sample Draft Project (Fictional)',
  'Draft fixture: Polish and Ukrainian translations are intentionally absent.'
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Team member: published, optional portrait absent, roles/bios partial flags
-- ---------------------------------------------------------------------------

insert into public.team_members (id, name, status, sort_order, published_at)
values ('00000000-0000-4000-8000-000000000301', 'Sample Person (Fictional)', 'published', 1, '2026-01-05T12:00:00Z')
on conflict (id) do nothing;

insert into public.team_member_translations (id, member_id, locale, slug, role, bio, needs_review)
values
  ('00000000-0000-4000-8000-000000000311', '00000000-0000-4000-8000-000000000301', 'en',
   'sample-person', 'Sample Role (Fictional)',
   'Fictional fixture biography used only by local development.', false),
  ('00000000-0000-4000-8000-000000000312', '00000000-0000-4000-8000-000000000301', 'pl',
   'przykladowa-osoba', 'Przykladowa rola (fikcyjna)',
   'Fikcyjna biografia uzywana wylacznie w lokalnym rozwoju.', true),
  ('00000000-0000-4000-8000-000000000313', '00000000-0000-4000-8000-000000000301', 'uk',
   'zrazkova-osoba', 'Zrazkova rol (fiktyvna)',
   'Fiktyvna biohrafiia dlia lokalnoi rozrobky.', true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Publications: one with files (EN+PL), one external URL with optional fields missing
-- ---------------------------------------------------------------------------

insert into public.publications (id, status, language, publication_date, external_url, sort_order, published_at)
values
  ('00000000-0000-4000-8000-000000000401', 'published', 'en', '2026-02-01', null, 1, '2026-02-01T09:00:00Z'),
  ('00000000-0000-4000-8000-000000000402', 'published', 'en', null,
   'https://example.org/fictional-sample-publication', 2, '2026-02-02T09:00:00Z')
on conflict (id) do nothing;

insert into public.publication_translations (id, publication_id, locale, slug, title, abstract, authors, needs_review)
values
  ('00000000-0000-4000-8000-000000000411', '00000000-0000-4000-8000-000000000401', 'en',
   'sample-publication', 'Sample Publication (Fictional)',
   'A fictional abstract for local development fixtures.', 'Sample Author (Fictional)', false),
  ('00000000-0000-4000-8000-000000000412', '00000000-0000-4000-8000-000000000401', 'pl',
   'przykladowa-publikacja', 'Przykladowa publikacja (fikcyjna)',
   'Fikcyjne streszczenie na potrzeby lokalnego rozwoju.', 'Przykladowy autor (fikcyjny)', false),
  ('00000000-0000-4000-8000-000000000413', '00000000-0000-4000-8000-000000000401', 'uk',
   'zrazkova-publikatsiia', 'Zrazkova publikatsiia (fiktyvna)',
   'Fiktyvne reziume dlia lokalnoi rozrobky.', 'Zrazkovyi avtor (fiktyvnyi)', false),
  ('00000000-0000-4000-8000-000000000421', '00000000-0000-4000-8000-000000000402', 'en',
   'sample-external-publication', 'Sample External Publication (Fictional)',
   null, null, false)
on conflict (id) do nothing;

insert into public.publication_files (id, publication_id, locale, label, storage_path, mime_type, file_size_bytes)
values
  ('00000000-0000-4000-8000-000000000431', '00000000-0000-4000-8000-000000000401', 'en',
   'Sample PDF (English, fictional)', 'fixtures/publications/sample-publication-en.pdf',
   'application/pdf', 12345),
  ('00000000-0000-4000-8000-000000000432', '00000000-0000-4000-8000-000000000401', 'pl',
   'Sample PDF (Polish, fictional)', 'fixtures/publications/sample-publication-pl.pdf',
   'application/pdf', 23456)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Calendar event links: linked to published, unlinked, linked to a draft
-- ---------------------------------------------------------------------------

insert into public.calendar_event_links (id, calendar_id, google_event_id, project_id)
values
  ('00000000-0000-4000-8000-000000000501', 'sample-calendar@example.org',
   'fictional-event-linked-published', '00000000-0000-4000-8000-000000000201'),
  ('00000000-0000-4000-8000-000000000502', 'sample-calendar@example.org',
   'fictional-event-unlinked', null),
  ('00000000-0000-4000-8000-000000000503', 'sample-calendar@example.org',
   'fictional-event-linked-draft', '00000000-0000-4000-8000-000000000202')
on conflict (id) do nothing;
