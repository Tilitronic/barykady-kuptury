-- T-012 seed fixtures.
--
-- Every value here is a clearly fictional sample. There is no real person,
-- organization fact, credential, URL or document. These fixtures exist to
-- exercise the schema (docs/TESTING.md §6) and are replaced by verified
-- content in later tickets (T-016/T-017/T-018/T-020).
--
-- Idempotent: fixed UUIDs + ON CONFLICT DO NOTHING, so re-running never
-- duplicates rows. Seeds execute as the migration superuser and bypass RLS.

-- ---------------------------------------------------------------------------
-- Site page: complete EN, PL present but flagged for review, UK missing
-- ---------------------------------------------------------------------------

insert into public.site_pages (id, page_key, status, sort_order, published_at)
values ('00000000-0000-4000-8000-000000000101', 'about', 'published', 1, '2026-01-05T12:00:00Z')
on conflict (id) do nothing;

insert into public.site_page_translations (id, page_id, locale, slug, title, body, needs_review)
values
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000101', 'en',
   'sample-about', 'Sample About Page (Fictional)',
   'Fictional fixture text for local development only. This is not approved organization content.', false),
  ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000101', 'pl',
   'przykladowa-o-nas', 'Przykladowa strona o nas (fikcyjna)',
   'Fikcyjny tekst na potrzeby lokalnego rozwoju. To nie jest zatwierdzona tresc organizacji.', true)
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
