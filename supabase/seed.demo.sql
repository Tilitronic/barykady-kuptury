-- T-037 — local demo dataset (Session 8, Lane A).
--
-- DEMO ONLY. This file is intentionally NOT listed in supabase/config.toml
-- `db.seed.sql_paths`: `supabase db reset` and CI stay hermetic. It is applied
-- explicitly by `bun scripts/demo/setup-demo.ts` (and therefore by the
-- one-command `pnpm demo` workflow owned by Lane C).
--
-- Design authority:
--   * docs/tickets/HANDOFF-S8-2026-10-19.md §3 — the demo dataset contract.
--   * docs/tickets/T-037-demo-environment.md — demo-only fixtures, clearly
--     fictional copy, generated assets, demo auth users.
--   * docs/TESTING.md §6 — fixtures are fictional and contain no personal
--     data or production credentials.
--   * docs/architecture.md §3/§6 — demo data lives in the same schema and RLS
--     boundary as production; this file runs as the migration superuser only
--     so it can populate content before the admin UI exists.
--   * docs/tickets/DECISIONS.md D-12 (documents may be files or in-app text),
--     D-17 (admin claim is `app_metadata.role = "admin"`).
--
-- IDEMPOTENCY
-- -----------
-- Every row has a fixed UUID. Demo-only rows use `on conflict (id) do nothing`.
-- Rows shared with the base seed (`00000000-…`) are loaded with
-- `on conflict (id) do update … where (old columns) is distinct from (new)`;
-- the WHERE keeps a second run from touching `updated_at` via the trigger.
-- Base-seed fixture rows are left in place, so re-applying `supabase/seed.sql`
-- after this file remains a no-op too. Net effect: applying this file twice is
-- a no-op, and the base-seed idempotency gate stays green in the demo state.
--
-- UUID NAMESPACE
-- --------------
-- Base seed: 00000000-0000-4000-8000-000000000NNN
-- Demo seed: 10000000-0000-4000-8000-000000000NNN
--
-- Reused base rows keep their 000… ids so the base seed remains idempotent in
-- a base-only database. Everything new is in the 100… namespace.

-- ===========================================================================
-- Site pages: home (new; fills the empty mission) + about (base row, demo PL/UK)
-- ===========================================================================

insert into public.site_pages (id, page_key, status, sort_order, published_at, created_at, updated_at)
values (
  '10000000-0000-4000-8000-000000000001', 'home', 'published', 0,
  '2026-10-19T08:00:00Z', '2026-10-19T08:00:00Z', '2026-10-19T08:00:00Z'
)
on conflict (id) do nothing;

insert into public.site_page_translations (
  id, page_id, locale, title, body, meta_description, needs_review, created_at, updated_at
)
values
  (
    '10000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001', 'en', 'Home — demo preview',
    $demo_home_en$## Demo preview

This is **fictional demo content** for the local design environment. It is not the organization's real mission or history.

## Mission

A fictional demo mission: culture, education, and community across borders.

[Read the demo About page](/en/about) to see longer fixture copy.$demo_home_en$,
    'Fictional home page used only by the local demo environment.', false,
    '2026-10-19T08:00:00Z', '2026-10-19T08:00:00Z'
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001', 'pl', 'Strona główna — podgląd demo',
    $demo_home_pl$## Podgląd demonstracyjny

To **fikcyjna treść demonstracyjna** dla lokalnego środowiska projektowego. Nie jest to prawdziwa misja ani historia organizacji.

## Misja

Fikcyjna misja demonstracyjna: kultura, edukacja i społeczność ponad granicami.

[Zobacz demonstracyjną stronę „O nas”](/pl/about), aby przeczytać dłuższy tekst przykładowy.$demo_home_pl$,
    'Fikcyjna strona główna używana wyłącznie w lokalnym środowisku demonstracyjnym.', false,
    '2026-10-19T08:00:00Z', '2026-10-19T08:00:00Z'
  ),
  (
    '10000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000001', 'uk', 'Головна — демонстраційний перегляд',
    $demo_home_uk$## Демонстраційний перегляд

Це **вигаданий демонстраційний вміст** для локального середовища проєктування. Це не справжня місія чи історія організації.

## Місія

Вигадана демонстраційна місія: культура, освіта та спільнота поза кордонами.

[Переглянути демонстраційну сторінку «Про нас»](/uk/about), щоб побачити довший приклад тексту.$demo_home_uk$,
    'Вигадана головна сторінка, що використовується лише в локальному демонстраційному середовищі.', false,
    '2026-10-19T08:00:00Z', '2026-10-19T08:00:00Z'
  )
on conflict (id) do nothing;

-- The base seed's About row stays the verified EN copy. Demo fills the two
-- partial locales so every locale has a readable About page during design work.
insert into public.site_page_translations (
  id, page_id, locale, title, body, meta_description, needs_review, created_at, updated_at
)
values
  (
    '00000000-0000-4000-8000-000000000103',
    '00000000-0000-4000-8000-000000000101', 'pl', 'O nas',
    $demo_about_pl$## Wersja demonstracyjna

To **fikcyjny tekst demonstracyjny** używany wyłącznie w lokalnym środowisku projektowym. Prawdziwa treść strony „O nas” zostanie dodana przez panel administracyjny.

## Wartości demo

- Tożsamość
- Edukacja
- Wsparcie
- Społeczność$demo_about_pl$,
    'Fikcyjna strona „O nas” używana wyłącznie w lokalnym środowisku demonstracyjnym.', false,
    '2026-01-05T12:00:00Z', '2026-01-05T12:00:00Z'
  ),
  (
    '00000000-0000-4000-8000-000000000104',
    '00000000-0000-4000-8000-000000000101', 'uk', 'Про нас',
    $demo_about_uk$## Демонстраційна версія

Це **вигаданий демонстраційний текст**, що використовується лише в локальному середовищі проєктування. Справжній вміст сторінки «Про нас» буде додано через адміністративну панель.

## Демонстраційні цінності

- Ідентичність
- Освіта
- Підтримка
- Спільнота$demo_about_uk$,
    'Вигадана сторінка «Про нас», що використовується лише в локальному демонстраційному середовищі.', false,
    '2026-01-05T12:00:00Z', '2026-01-05T12:00:00Z'
  )
on conflict (id) do update
  set locale = excluded.locale,
      title = excluded.title,
      body = excluded.body,
      meta_description = excluded.meta_description,
      needs_review = excluded.needs_review
where (
  public.site_page_translations.locale,
  public.site_page_translations.title,
  public.site_page_translations.body,
  public.site_page_translations.meta_description,
  public.site_page_translations.needs_review
) is distinct from (
  excluded.locale,
  excluded.title,
  excluded.body,
  excluded.meta_description,
  excluded.needs_review
);

-- ===========================================================================
-- Projects: 8 total = 2 reused base fixtures + 6 new demo fixtures
-- Published (6): ranks 1, 2 and 5 featured; one missing PL/UK translation.
-- Draft (1) and archived (1) exercise the lifecycle and hidden states.
-- ===========================================================================

-- P1 — published, featured rank 1 (reuses base project …201)
insert into public.projects (
  id, slug, status, featured_rank, cover_path, start_date, end_date, published_at, created_at, updated_at
)
values (
  '00000000-0000-4000-8000-000000000201', 'demo-cultural-bridge', 'published', 1,
  'demo/projects/demo-cultural-bridge-cover.png',
  '2026-01-10', '2026-03-20', '2026-01-05T12:00:00Z',
  '2026-01-05T12:00:00Z', '2026-01-05T12:00:00Z'
)
on conflict (id) do update
  set slug = excluded.slug,
      status = excluded.status,
      featured_rank = excluded.featured_rank,
      cover_path = excluded.cover_path,
      start_date = excluded.start_date,
      end_date = excluded.end_date,
      published_at = excluded.published_at
where (
  public.projects.slug,
  public.projects.status,
  public.projects.featured_rank,
  public.projects.cover_path,
  public.projects.start_date,
  public.projects.end_date,
  public.projects.published_at
) is distinct from (
  excluded.slug,
  excluded.status,
  excluded.featured_rank,
  excluded.cover_path,
  excluded.start_date,
  excluded.end_date,
  excluded.published_at
);

insert into public.project_translations (
  id, project_id, locale, title, summary, body, needs_review, created_at, updated_at
)
values
  (
    '00000000-0000-4000-8000-000000000211',
    '00000000-0000-4000-8000-000000000201', 'en',
    'Cultural Bridge Workshop (Fictional Demo)',
    'A fictional workshop summary for the local demo environment.',
    $demo_p1_en$## Demo project

This is fictional demo content used only for local design testing.

- Cross-border cultural exchange
- Non-formal education
- Community support$demo_p1_en$, false,
    '2026-01-05T12:00:00Z', '2026-01-05T12:00:00Z'
  ),
  (
    '00000000-0000-4000-8000-000000000212',
    '00000000-0000-4000-8000-000000000201', 'pl', 'Warsztat mostów kulturowych (fikcyjna wersja demo)',
    'Fikcyjne podsumowanie warsztatu dla lokalnego środowiska demonstracyjnego.',
    $demo_p1_pl$## Projekt demonstracyjny

To fikcyjna treść używana wyłącznie do lokalnego testowania projektu.

- Międzykulturowa wymiana
- Edukacja pozaformalna
- Wsparcie społeczności$demo_p1_pl$, false,
    '2026-01-05T12:00:00Z', '2026-01-05T12:00:00Z'
  ),
  (
    '00000000-0000-4000-8000-000000000213',
    '00000000-0000-4000-8000-000000000201', 'uk', 'Майстерня культурного мосту (фіктивна демоверсія)',
    'Фіктивний опис майстерні для локального демонстраційного середовища.',
    $demo_p1_uk$## Демонстраційний проєкт

Це вигаданий вміст, що використовується лише для локального тестування дизайну.

- Міжкультурний обмін
- Неформальна освіта
- Підтримка спільноти$demo_p1_uk$, false,
    '2026-01-05T12:00:00Z', '2026-01-05T12:00:00Z'
  )
on conflict (id) do update
  set locale = excluded.locale,
      title = excluded.title,
      summary = excluded.summary,
      body = excluded.body,
      needs_review = excluded.needs_review
where (
  public.project_translations.locale,
  public.project_translations.title,
  public.project_translations.summary,
  public.project_translations.body,
  public.project_translations.needs_review
) is distinct from (
  excluded.locale,
  excluded.title,
  excluded.summary,
  excluded.body,
  excluded.needs_review
);

-- P2 — published, featured rank 2, long PL/UK titles
insert into public.projects (
  id, slug, status, featured_rank, cover_path, start_date, end_date, published_at, created_at, updated_at
)
values (
  '10000000-0000-4000-8000-000000000210', 'demo-language-lab', 'published', 2,
  'demo/projects/demo-language-lab-cover.png',
  '2026-02-01', '2026-05-30', '2026-02-01T09:00:00Z',
  '2026-02-01T09:00:00Z', '2026-02-01T09:00:00Z'
)
on conflict (id) do nothing;

insert into public.project_translations (
  id, project_id, locale, title, summary, body, needs_review, created_at, updated_at
)
values
  (
    '10000000-0000-4000-8000-000000002201',
    '10000000-0000-4000-8000-000000000210', 'en', 'Language Lab (Fictional Demo)',
    'A fictional language-lab summary for local design testing.',
    $demo_p2_en$## Demo project

A fictional language lab used to exercise the featured-project layout.

- Conversation circles
- Family learning
- Volunteer-led sessions$demo_p2_en$, false,
    '2026-02-01T09:00:00Z', '2026-02-01T09:00:00Z'
  ),
  (
    '10000000-0000-4000-8000-000000002202',
    '10000000-0000-4000-8000-000000000210', 'pl', 'Laboratorium językowe dla rodzin — długa demonstracyjna nazwa projektu (fikcyjna)',
    'Fikcyjne podsumowanie laboratorium językowego dla lokalnego środowiska demonstracyjnego.',
    $demo_p2_pl$## Projekt demonstracyjny

Długi tytuł i opis służą sprawdzeniu zawijania tekstu w kartach i nagłówkach.

- Kręgi konwersacyjne
- Nauka rodzinna
- Zajęcia prowadzone przez wolontariuszy$demo_p2_pl$, false,
    '2026-02-01T09:00:00Z', '2026-02-01T09:00:00Z'
  ),
  (
    '10000000-0000-4000-8000-000000002203',
    '10000000-0000-4000-8000-000000000210', 'uk', 'Мовна лабораторія для родин — довга демонстраційна назва проєкту (фіктивна)',
    'Фіктивний опис мовної лабораторії для локального демонстраційного середовища.',
    $demo_p2_uk$## Демонстраційний проєкт

Довга назва й опис перевіряють перенесення тексту в картках і заголовках.

- Розмовні кола
- Родинне навчання
- Заняття за участі волонтерів$demo_p2_uk$, false,
    '2026-02-01T09:00:00Z', '2026-02-01T09:00:00Z'
  )
on conflict (id) do nothing;

-- P3 — published, featured rank 5 (non-contiguous on purpose), long PL/UK titles
insert into public.projects (
  id, slug, status, featured_rank, cover_path, start_date, end_date, published_at, created_at, updated_at
)
values (
  '10000000-0000-4000-8000-000000000211', 'demo-memory-archive', 'published', 5,
  'demo/projects/demo-memory-archive-cover.png',
  '2026-03-01', null, '2026-03-01T09:00:00Z',
  '2026-03-01T09:00:00Z', '2026-03-01T09:00:00Z'
)
on conflict (id) do nothing;

insert into public.project_translations (
  id, project_id, locale, title, summary, body, needs_review, created_at, updated_at
)
values
  (
    '10000000-0000-4000-8000-000000002211',
    '10000000-0000-4000-8000-000000000211', 'en', 'Memory Archive (Fictional Demo)',
    'A fictional documentation project summary.',
    $demo_p3_en$## Demo project

A fictional archive project used to prove non-contiguous featured ranks.

- Oral-history interviews
- Community mapping
- Digital preservation$demo_p3_en$, false,
    '2026-03-01T09:00:00Z', '2026-03-01T09:00:00Z'
  ),
  (
    '10000000-0000-4000-8000-000000002212',
    '10000000-0000-4000-8000-000000000211', 'pl', 'Archiwum pamięci — wielojęzyczny projekt dokumentacyjny o bardzo długiej nazwie (fikcyjny)',
    'Fikcyjne podsumowanie projektu dokumentacyjnego.',
    $demo_p3_pl$## Projekt demonstracyjny

Fikcyjny projekt archiwalny sprawdzający porządek wyróżnionych pozycji.

- Wywiady historii mówionej
- Mapowanie społeczności
- Cyfrowe zabezpieczanie zbiorów$demo_p3_pl$, false,
    '2026-03-01T09:00:00Z', '2026-03-01T09:00:00Z'
  ),
  (
    '10000000-0000-4000-8000-000000002213',
    '10000000-0000-4000-8000-000000000211', 'uk', 'Архів пам’яті — багатомовний документаційний проєкт із дуже довгою назвою (фіктивний)',
    'Фіктивний опис документаційного проєкту.',
    $demo_p3_uk$## Демонстраційний проєкт

Вигаданий архівний проєкт перевіряє порядок рекомендованих позицій.

- Інтерв’ю усної історії
- Картування спільноти
- Цифрове збереження$demo_p3_uk$, false,
    '2026-03-01T09:00:00Z', '2026-03-01T09:00:00Z'
  )
on conflict (id) do nothing;

-- P4 — published, not featured
insert into public.projects (
  id, slug, status, featured_rank, cover_path, start_date, end_date, published_at, created_at, updated_at
)
values (
  '10000000-0000-4000-8000-000000000212', 'demo-youth-media', 'published', null,
  'demo/projects/demo-youth-media-cover.png',
  '2026-04-01', '2026-06-15', '2026-04-01T09:00:00Z',
  '2026-04-01T09:00:00Z', '2026-04-01T09:00:00Z'
)
on conflict (id) do nothing;

insert into public.project_translations (
  id, project_id, locale, title, summary, body, needs_review, created_at, updated_at
)
values
  (
    '10000000-0000-4000-8000-000000002221',
    '10000000-0000-4000-8000-000000000212', 'en', 'Youth Media Lab (Fictional Demo)',
    'A fictional media-literacy project summary.',
    $demo_p4_en$## Demo project

A fictional youth media project for the public listing.

- Media literacy
- Storytelling
- Peer editing$demo_p4_en$, false,
    '2026-04-01T09:00:00Z', '2026-04-01T09:00:00Z'
  ),
  (
    '10000000-0000-4000-8000-000000002222',
    '10000000-0000-4000-8000-000000000212', 'pl', 'Laboratorium mediów młodzieżowych (fikcyjna wersja demo)',
    'Fikcyjne podsumowanie projektu edukacji medialnej.',
    $demo_p4_pl$## Projekt demonstracyjny

Fikcyjny projekt młodzieżowy widoczny na publicznej liście.

- Edukacja medialna
- Opowiadanie historii
- Wzajemna redakcja$demo_p4_pl$, false,
    '2026-04-01T09:00:00Z', '2026-04-01T09:00:00Z'
  ),
  (
    '10000000-0000-4000-8000-000000002223',
    '10000000-0000-4000-8000-000000000212', 'uk', 'Лабораторія молодіжних медіа (фіктивна демоверсія)',
    'Фіктивний опис проєкту медіаосвіти.',
    $demo_p4_uk$## Демонстраційний проєкт

Вигаданий молодіжний проєкт у публічному переліку.

- Медіаграмотність
- Розповідання історій
- Взаємне редагування$demo_p4_uk$, false,
    '2026-04-01T09:00:00Z', '2026-04-01T09:00:00Z'
  )
on conflict (id) do nothing;

-- P5 — published, not featured
insert into public.projects (
  id, slug, status, featured_rank, cover_path, start_date, end_date, published_at, created_at, updated_at
)
values (
  '10000000-0000-4000-8000-000000000213', 'demo-eco-workshop', 'published', null,
  'demo/projects/demo-eco-workshop-cover.png',
  '2026-05-01', '2026-07-01', '2026-05-01T09:00:00Z',
  '2026-05-01T09:00:00Z', '2026-05-01T09:00:00Z'
)
on conflict (id) do nothing;

insert into public.project_translations (
  id, project_id, locale, title, summary, body, needs_review, created_at, updated_at
)
values
  (
    '10000000-0000-4000-8000-000000002231',
    '10000000-0000-4000-8000-000000000213', 'en', 'Ecology Workshop (Fictional Demo)',
    'A fictional ecology workshop summary.',
    $demo_p5_en$## Demo project

A fictional ecology workshop for local design testing.

- Urban ecology
- Repair culture
- Community gardens$demo_p5_en$, false,
    '2026-05-01T09:00:00Z', '2026-05-01T09:00:00Z'
  ),
  (
    '10000000-0000-4000-8000-000000002232',
    '10000000-0000-4000-8000-000000000213', 'pl', 'Warsztat ekologiczny (fikcyjna wersja demo)',
    'Fikcyjne podsumowanie warsztatu ekologicznego.',
    $demo_p5_pl$## Projekt demonstracyjny

Fikcyjny warsztat ekologiczny dla lokalnego testowania projektu.

- Ekologia miejska
- Kultura naprawy
- Ogrody społecznościowe$demo_p5_pl$, false,
    '2026-05-01T09:00:00Z', '2026-05-01T09:00:00Z'
  ),
  (
    '10000000-0000-4000-8000-000000002233',
    '10000000-0000-4000-8000-000000000213', 'uk', 'Екологічна майстерня (фіктивна демоверсія)',
    'Фіктивний опис екологічної майстерні.',
    $demo_p5_uk$## Демонстраційний проєкт

Вигадана екологічна майстерня для локального тестування дизайну.

- Міська екологія
- Культура ремонту
- Громадські сади$demo_p5_uk$, false,
    '2026-05-01T09:00:00Z', '2026-05-01T09:00:00Z'
  )
on conflict (id) do nothing;

-- P6 — published with only an EN translation (PL/UK strict 404 path)
insert into public.projects (
  id, slug, status, featured_rank, cover_path, start_date, end_date, published_at, created_at, updated_at
)
values (
  '10000000-0000-4000-8000-000000000214', 'demo-fallback-story', 'published', null,
  'demo/projects/demo-fallback-story-cover.png',
  '2026-06-01', null, '2026-06-01T09:00:00Z',
  '2026-06-01T09:00:00Z', '2026-06-01T09:00:00Z'
)
on conflict (id) do nothing;

insert into public.project_translations (
  id, project_id, locale, title, summary, body, needs_review, created_at, updated_at
)
values (
  '10000000-0000-4000-8000-000000002241',
  '10000000-0000-4000-8000-000000000214', 'en', 'Fallback Story (Fictional Demo)',
  'A fictional project with no Polish or Ukrainian translation.',
  $demo_p6_en$## Demo project

This project intentionally has no PL/UK translation, so the public pages
exercise the documented English-fallback note.

- Fallback behaviour
- Missing translation state$demo_p6_en$, false,
  '2026-06-01T09:00:00Z', '2026-06-01T09:00:00Z'
)
on conflict (id) do nothing;

-- P7 — draft (reuses base project …202; must stay invisible to anon)
insert into public.projects (
  id, slug, status, featured_rank, cover_path, start_date, end_date, published_at, created_at, updated_at
)
values (
  '00000000-0000-4000-8000-000000000202', 'demo-draft-project', 'draft', null, null, null, null, null,
  '2026-01-05T12:00:00Z', '2026-01-05T12:00:00Z'
)
on conflict (id) do update
  set slug = excluded.slug,
      status = excluded.status,
      featured_rank = excluded.featured_rank,
      cover_path = excluded.cover_path,
      start_date = excluded.start_date,
      end_date = excluded.end_date,
      published_at = excluded.published_at
where (
  public.projects.slug,
  public.projects.status,
  public.projects.featured_rank,
  public.projects.cover_path,
  public.projects.start_date,
  public.projects.end_date,
  public.projects.published_at
) is distinct from (
  excluded.slug,
  excluded.status,
  excluded.featured_rank,
  excluded.cover_path,
  excluded.start_date,
  excluded.end_date,
  excluded.published_at
);

insert into public.project_translations (
  id, project_id, locale, title, summary, body, needs_review, created_at, updated_at
)
values (
  '00000000-0000-4000-8000-000000000221',
  '00000000-0000-4000-8000-000000000202', 'en', 'Draft Project (Fictional Demo)',
  'Draft fixture kept out of public views.',
  $demo_p7_en$## Draft fixture

Fictional draft body used only by the local admin design work.$demo_p7_en$, false,
  '2026-01-05T12:00:00Z', '2026-01-05T12:00:00Z'
)
on conflict (id) do update
  set locale = excluded.locale,
      title = excluded.title,
      summary = excluded.summary,
      body = excluded.body,
      needs_review = excluded.needs_review
where (
  public.project_translations.locale,
  public.project_translations.title,
  public.project_translations.summary,
  public.project_translations.body,
  public.project_translations.needs_review
) is distinct from (
  excluded.locale,
  excluded.title,
  excluded.summary,
  excluded.body,
  excluded.needs_review
);

-- P8 — archived (never listed publicly)
insert into public.projects (
  id, slug, status, featured_rank, cover_path, start_date, end_date, published_at, created_at, updated_at
)
values (
  '10000000-0000-4000-8000-000000000215', 'demo-archived-project', 'archived', null, null,
  '2025-01-01', '2025-03-01', '2025-01-01T09:00:00Z',
  '2025-01-01T09:00:00Z', '2025-01-01T09:00:00Z'
)
on conflict (id) do nothing;

insert into public.project_translations (
  id, project_id, locale, title, summary, body, needs_review, created_at, updated_at
)
values
  (
    '10000000-0000-4000-8000-000000002251',
    '10000000-0000-4000-8000-000000000215', 'en', 'Archived Project (Fictional Demo)',
    'A fictional archived project.',
    $demo_p8_en$## Archived demo project

This fictional project is archived and must not appear in public listings.$demo_p8_en$, false,
    '2025-01-01T09:00:00Z', '2025-01-01T09:00:00Z'
  ),
  (
    '10000000-0000-4000-8000-000000002252',
    '10000000-0000-4000-8000-000000000215', 'pl', 'Projekt zarchiwizowany (fikcyjna wersja demo)',
    'Fikcyjny projekt zarchiwizowany.',
    $demo_p8_pl$## Zarchiwizowany projekt demonstracyjny

Ten fikcyjny projekt jest zarchiwizowany i nie może pojawiać się na publicznych listach.$demo_p8_pl$, false,
    '2025-01-01T09:00:00Z', '2025-01-01T09:00:00Z'
  ),
  (
    '10000000-0000-4000-8000-000000002253',
    '10000000-0000-4000-8000-000000000215', 'uk', 'Архівний проєкт (фіктивна демоверсія)',
    'Фіктивний архівний проєкт.',
    $demo_p8_uk$## Архівний демонстраційний проєкт

Цей вигаданий проєкт архівовано, і він не повинен з’являтися в публічних переліках.$demo_p8_uk$, false,
    '2025-01-01T09:00:00Z', '2025-01-01T09:00:00Z'
  )
on conflict (id) do nothing;

-- ===========================================================================
-- Team: 5 members = 1 reused base fixture + 4 new; neutral generated avatars
-- ===========================================================================

insert into public.team_members (
  id, name, status, sort_order, portrait_path, published_at, created_at, updated_at
)
values
  (
    '00000000-0000-4000-8000-000000000301', 'Demo Member One (Fictional)', 'published', 1,
    'demo/team/demo-member-one.png', '2026-01-05T12:00:00Z',
    '2026-01-05T12:00:00Z', '2026-01-05T12:00:00Z'
  ),
  (
    '10000000-0000-4000-8000-000000000310', 'Demo Member Two (Fictional)', 'published', 2,
    'demo/team/demo-member-two.png', '2026-01-05T12:00:00Z',
    '2026-01-05T12:00:00Z', '2026-01-05T12:00:00Z'
  ),
  (
    '10000000-0000-4000-8000-000000000311', 'Demo Member Three (Fictional)', 'published', 3,
    'demo/team/demo-member-three.png', '2026-01-05T12:00:00Z',
    '2026-01-05T12:00:00Z', '2026-01-05T12:00:00Z'
  ),
  (
    '10000000-0000-4000-8000-000000000312', 'Demo Member Four (Fictional)', 'published', 4,
    'demo/team/demo-member-four.png', '2026-01-05T12:00:00Z',
    '2026-01-05T12:00:00Z', '2026-01-05T12:00:00Z'
  ),
  (
    '10000000-0000-4000-8000-000000000313', 'Demo Member Five (Fictional)', 'published', 5,
    'demo/team/demo-member-five.png', '2026-01-05T12:00:00Z',
    '2026-01-05T12:00:00Z', '2026-01-05T12:00:00Z'
  )
on conflict (id) do update
  set name = excluded.name,
      status = excluded.status,
      sort_order = excluded.sort_order,
      portrait_path = excluded.portrait_path,
      published_at = excluded.published_at
where (
  public.team_members.name,
  public.team_members.status,
  public.team_members.sort_order,
  public.team_members.portrait_path,
  public.team_members.published_at
) is distinct from (
  excluded.name,
  excluded.status,
  excluded.sort_order,
  excluded.portrait_path,
  excluded.published_at
);

insert into public.team_member_translations (
  id, member_id, locale, role, bio, needs_review, created_at, updated_at
)
values
  -- member one (base row)
  ('00000000-0000-4000-8000-000000000311', '00000000-0000-4000-8000-000000000301', 'en',
   'Demo Coordinator (Fictional)',
   'Fictional biography for local demo testing only.', false,
   '2026-01-05T12:00:00Z', '2026-01-05T12:00:00Z'),
  ('00000000-0000-4000-8000-000000000312', '00000000-0000-4000-8000-000000000301', 'pl',
   'Koordynatorka demonstracyjna (fikcyjna)',
   'Fikcyjna biografia używana wyłącznie w lokalnym środowisku demonstracyjnym.', false,
   '2026-01-05T12:00:00Z', '2026-01-05T12:00:00Z'),
  ('00000000-0000-4000-8000-000000000313', '00000000-0000-4000-8000-000000000301', 'uk',
   'Демонстраційна координаторка (фіктивна)',
   'Фіктивна біографія, що використовується лише в локальному демонстраційному середовищі.', false,
   '2026-01-05T12:00:00Z', '2026-01-05T12:00:00Z'),
  -- member two
  ('10000000-0000-4000-8000-000000003101', '10000000-0000-4000-8000-000000000310', 'en',
   'Demo Editor (Fictional)',
   'Fictional biography for local demo testing only.', false,
   '2026-01-05T12:00:00Z', '2026-01-05T12:00:00Z'),
  ('10000000-0000-4000-8000-000000003102', '10000000-0000-4000-8000-000000000310', 'pl',
   'Redaktorka demonstracyjna (fikcyjna)',
   'Fikcyjna biografia używana wyłącznie w lokalnym środowisku demonstracyjnym.', false,
   '2026-01-05T12:00:00Z', '2026-01-05T12:00:00Z'),
  ('10000000-0000-4000-8000-000000003103', '10000000-0000-4000-8000-000000000310', 'uk',
   'Демонстраційна редакторка (фіктивна)',
   'Фіктивна біографія, що використовується лише в локальному демонстраційному середовищі.', false,
   '2026-01-05T12:00:00Z', '2026-01-05T12:00:00Z'),
  -- member three
  ('10000000-0000-4000-8000-000000003111', '10000000-0000-4000-8000-000000000311', 'en',
   'Demo Producer (Fictional)',
   'Fictional biography for local demo testing only.', false,
   '2026-01-05T12:00:00Z', '2026-01-05T12:00:00Z'),
  ('10000000-0000-4000-8000-000000003112', '10000000-0000-4000-8000-000000000311', 'pl',
   'Producentka demonstracyjna (fikcyjna)',
   'Fikcyjna biografia używana wyłącznie w lokalnym środowisku demonstracyjnym.', false,
   '2026-01-05T12:00:00Z', '2026-01-05T12:00:00Z'),
  ('10000000-0000-4000-8000-000000003113', '10000000-0000-4000-8000-000000000311', 'uk',
   'Демонстраційна продюсерка (фіктивна)',
   'Фіктивна біографія, що використовується лише в локальному демонстраційному середовищі.', false,
   '2026-01-05T12:00:00Z', '2026-01-05T12:00:00Z'),
  -- member four
  ('10000000-0000-4000-8000-000000003121', '10000000-0000-4000-8000-000000000312', 'en',
   'Demo Researcher (Fictional)',
   'Fictional biography for local demo testing only.', false,
   '2026-01-05T12:00:00Z', '2026-01-05T12:00:00Z'),
  ('10000000-0000-4000-8000-000000003122', '10000000-0000-4000-8000-000000000312', 'pl',
   'Badaczka demonstracyjna (fikcyjna)',
   'Fikcyjna biografia używana wyłącznie w lokalnym środowisku demonstracyjnym.', false,
   '2026-01-05T12:00:00Z', '2026-01-05T12:00:00Z'),
  ('10000000-0000-4000-8000-000000003123', '10000000-0000-4000-8000-000000000312', 'uk',
   'Демонстраційна дослідниця (фіктивна)',
   'Фіктивна біографія, що використовується лише в локальному демонстраційному середовищі.', false,
   '2026-01-05T12:00:00Z', '2026-01-05T12:00:00Z'),
  -- member five
  ('10000000-0000-4000-8000-000000003131', '10000000-0000-4000-8000-000000000313', 'en',
   'Demo Volunteer (Fictional)',
   'Fictional biography for local demo testing only.', false,
   '2026-01-05T12:00:00Z', '2026-01-05T12:00:00Z'),
  ('10000000-0000-4000-8000-000000003132', '10000000-0000-4000-8000-000000000313', 'pl',
   'Wolontariuszka demonstracyjna (fikcyjna)',
   'Fikcyjna biografia używana wyłącznie w lokalnym środowisku demonstracyjnym.', false,
   '2026-01-05T12:00:00Z', '2026-01-05T12:00:00Z'),
  ('10000000-0000-4000-8000-000000003133', '10000000-0000-4000-8000-000000000313', 'uk',
   'Демонстраційна волонтерка (фіктивна)',
   'Фіктивна біографія, що використовується лише в локальному демонстраційному середовищі.', false,
   '2026-01-05T12:00:00Z', '2026-01-05T12:00:00Z')
on conflict (id) do update
  set member_id = excluded.member_id,
      locale = excluded.locale,
      role = excluded.role,
      bio = excluded.bio,
      needs_review = excluded.needs_review
where (
  public.team_member_translations.member_id,
  public.team_member_translations.locale,
  public.team_member_translations.role,
  public.team_member_translations.bio,
  public.team_member_translations.needs_review
) is distinct from (
  excluded.member_id,
  excluded.locale,
  excluded.role,
  excluded.bio,
  excluded.needs_review
);

-- ===========================================================================
-- Publications: 6 total = 2 reused base fixtures + 4 new; 7 PDF file rows
-- Across EN/PL/UK, with generated PDFs in public-documents.
-- ===========================================================================

insert into public.publications (
  id, slug, status, language, publication_date, external_url, sort_order, published_at, created_at, updated_at
)
values
  (
    '00000000-0000-4000-8000-000000000401', 'demo-cultural-bridges-report', 'published', 'en', '2026-02-01', null, 1,
    '2026-02-01T09:00:00Z', '2026-02-01T09:00:00Z', '2026-02-01T09:00:00Z'
  ),
  (
    '00000000-0000-4000-8000-000000000402', 'demo-community-zine', 'published', 'pl', '2026-02-15', null, 2,
    '2026-02-15T09:00:00Z', '2026-02-15T09:00:00Z', '2026-02-15T09:00:00Z'
  ),
  (
    '10000000-0000-4000-8000-000000000410', 'demo-poetry-anthology', 'published', 'uk', '2026-03-01', null, 3,
    '2026-03-01T09:00:00Z', '2026-03-01T09:00:00Z', '2026-03-01T09:00:00Z'
  ),
  (
    '10000000-0000-4000-8000-000000000411', 'demo-disinformation-notes', 'published', 'en', '2026-03-10', null, 4,
    '2026-03-10T09:00:00Z', '2026-03-10T09:00:00Z', '2026-03-10T09:00:00Z'
  ),
  (
    '10000000-0000-4000-8000-000000000412', 'demo-volunteer-handbook', 'published', 'pl', '2026-03-20', null, 5,
    '2026-03-20T09:00:00Z', '2026-03-20T09:00:00Z', '2026-03-20T09:00:00Z'
  ),
  (
    '10000000-0000-4000-8000-000000000413', 'demo-ecology-report', 'published', 'uk', '2026-04-01', null, 6,
    '2026-04-01T09:00:00Z', '2026-04-01T09:00:00Z', '2026-04-01T09:00:00Z'
  )
on conflict (id) do update
  set slug = excluded.slug,
      status = excluded.status,
      language = excluded.language,
      publication_date = excluded.publication_date,
      external_url = excluded.external_url,
      sort_order = excluded.sort_order,
      published_at = excluded.published_at
where (
  public.publications.slug,
  public.publications.status,
  public.publications.language,
  public.publications.publication_date,
  public.publications.external_url,
  public.publications.sort_order,
  public.publications.published_at
) is distinct from (
  excluded.slug,
  excluded.status,
  excluded.language,
  excluded.publication_date,
  excluded.external_url,
  excluded.sort_order,
  excluded.published_at
);

insert into public.publication_translations (
  id, publication_id, locale, title, abstract, authors, needs_review, created_at, updated_at
)
values
  -- P1 (base row)
  ('00000000-0000-4000-8000-000000000411', '00000000-0000-4000-8000-000000000401', 'en',
   'Cultural Bridges Report (Fictional Demo)',
   'A fictional report abstract for local design testing.',
   'Demo Author One (Fictional)', false,
   '2026-02-01T09:00:00Z', '2026-02-01T09:00:00Z'),
  ('00000000-0000-4000-8000-000000000412', '00000000-0000-4000-8000-000000000401', 'pl',
   'Raport o mostach kulturowych (fikcyjna wersja demo)',
   'Fikcyjne streszczenie raportu na potrzeby lokalnego środowiska demonstracyjnego.',
   'Autor demonstracyjny (fikcyjny)', false,
   '2026-02-01T09:00:00Z', '2026-02-01T09:00:00Z'),
  ('00000000-0000-4000-8000-000000000413', '00000000-0000-4000-8000-000000000401', 'uk',
   'Звіт про культурні мости (фіктивна демоверсія)',
   'Фіктивний огляд звіту для локального демонстраційного середовища.',
   'Демонстраційний автор (фіктивний)', false,
   '2026-02-01T09:00:00Z', '2026-02-01T09:00:00Z'),
  -- P2 (base row + two new translations)
  ('00000000-0000-4000-8000-000000000421', '00000000-0000-4000-8000-000000000402', 'en',
   'Community Zine (Fictional Demo)',
   'A fictional community zine abstract.',
   'Demo Editorial Collective (Fictional)', false,
   '2026-02-15T09:00:00Z', '2026-02-15T09:00:00Z'),
  ('10000000-0000-4000-8000-000000004220', '00000000-0000-4000-8000-000000000402', 'pl',
   'Zine społeczny (fikcyjna wersja demo)',
   'Fikcyjne streszczenie zina społecznego.',
   'Kolektyw redakcyjny (fikcyjny)', false,
   '2026-02-15T09:00:00Z', '2026-02-15T09:00:00Z'),
  ('10000000-0000-4000-8000-000000004221', '00000000-0000-4000-8000-000000000402', 'uk',
   'Громадський зін (фіктивна демоверсія)',
   'Фіктивний опис громадського зіну.',
   'Демонстраційний редакційний колектив (фіктивний)', false,
   '2026-02-15T09:00:00Z', '2026-02-15T09:00:00Z'),
  -- P3
  ('10000000-0000-4000-8000-000000004210', '10000000-0000-4000-8000-000000000410', 'en',
   'Poetry Anthology (Fictional Demo)',
   'A fictional poetry anthology abstract.',
   'Demo Poets Circle (Fictional)', false,
   '2026-03-01T09:00:00Z', '2026-03-01T09:00:00Z'),
  ('10000000-0000-4000-8000-000000004211', '10000000-0000-4000-8000-000000000410', 'pl',
   'Antologia poezji (fikcyjna wersja demo)',
   'Fikcyjne streszczenie antologii poezji.',
   'Krąg poetów demonstracyjnych (fikcyjny)', false,
   '2026-03-01T09:00:00Z', '2026-03-01T09:00:00Z'),
  ('10000000-0000-4000-8000-000000004212', '10000000-0000-4000-8000-000000000410', 'uk',
   'Антологія поезії (фіктивна демоверсія)',
   'Фіктивний опис антології поезії.',
   'Демонстраційне коло поетів (фіктивне)', false,
   '2026-03-01T09:00:00Z', '2026-03-01T09:00:00Z'),
  -- P4 (EN only; fallback exercise)
  ('10000000-0000-4000-8000-000000004230', '10000000-0000-4000-8000-000000000411', 'en',
   'Disinformation Field Notes (Fictional Demo)',
   'A fictional media-literacy field note.',
   'Demo Research Desk (Fictional)', false,
   '2026-03-10T09:00:00Z', '2026-03-10T09:00:00Z'),
  -- P5
  ('10000000-0000-4000-8000-000000004240', '10000000-0000-4000-8000-000000000412', 'en',
   'Volunteer Handbook (Fictional Demo)',
   'A fictional volunteer handbook abstract.',
   'Demo Volunteer Team (Fictional)', false,
   '2026-03-20T09:00:00Z', '2026-03-20T09:00:00Z'),
  ('10000000-0000-4000-8000-000000004241', '10000000-0000-4000-8000-000000000412', 'pl',
   'Poradnik wolontariusza (fikcyjna wersja demo)',
   'Fikcyjne streszczenie poradnika wolontariusza.',
   'Zespół wolontariuszy demonstracyjnych (fikcyjny)', false,
   '2026-03-20T09:00:00Z', '2026-03-20T09:00:00Z'),
  -- P6
  ('10000000-0000-4000-8000-000000004250', '10000000-0000-4000-8000-000000000413', 'en',
   'Ecology Listening Report (Fictional Demo)',
   'A fictional ecology listening report abstract.',
   'Demo Ecology Circle (Fictional)', false,
   '2026-04-01T09:00:00Z', '2026-04-01T09:00:00Z'),
  ('10000000-0000-4000-8000-000000004251', '10000000-0000-4000-8000-000000000413', 'uk',
   'Екологічний звіт (фіктивна демоверсія)',
   'Фіктивний опис екологічного звіту.',
   'Демонстраційне екологічне коло (фіктивне)', false,
   '2026-04-01T09:00:00Z', '2026-04-01T09:00:00Z')
on conflict (id) do update
  set publication_id = excluded.publication_id,
      locale = excluded.locale,
      title = excluded.title,
      abstract = excluded.abstract,
      authors = excluded.authors,
      needs_review = excluded.needs_review
where (
  public.publication_translations.publication_id,
  public.publication_translations.locale,
  public.publication_translations.title,
  public.publication_translations.abstract,
  public.publication_translations.authors,
  public.publication_translations.needs_review
) is distinct from (
  excluded.publication_id,
  excluded.locale,
  excluded.title,
  excluded.abstract,
  excluded.authors,
  excluded.needs_review
);

insert into public.publication_files (
  id, publication_id, locale, label, storage_path, mime_type, file_size_bytes, created_at, updated_at
)
values
  ('00000000-0000-4000-8000-000000000431', '00000000-0000-4000-8000-000000000401', 'en',
   'English PDF (fictional demo)', 'demo/publications/demo-cultural-bridges-report-en.pdf',
   'application/pdf', null, '2026-02-01T09:00:00Z', '2026-02-01T09:00:00Z'),
  ('00000000-0000-4000-8000-000000000432', '00000000-0000-4000-8000-000000000401', 'pl',
   'Polish PDF (fictional demo)', 'demo/publications/demo-cultural-bridges-report-pl.pdf',
   'application/pdf', null, '2026-02-01T09:00:00Z', '2026-02-01T09:00:00Z'),
  ('10000000-0000-4000-8000-000000000433', '00000000-0000-4000-8000-000000000402', 'pl',
   'Polish PDF (fictional demo)', 'demo/publications/demo-community-zine-pl.pdf',
   'application/pdf', null, '2026-02-15T09:00:00Z', '2026-02-15T09:00:00Z'),
  ('10000000-0000-4000-8000-000000000434', '10000000-0000-4000-8000-000000000410', 'uk',
   'Ukrainian PDF (fictional demo)', 'demo/publications/demo-poetry-anthology-uk.pdf',
   'application/pdf', null, '2026-03-01T09:00:00Z', '2026-03-01T09:00:00Z'),
  ('10000000-0000-4000-8000-000000000435', '10000000-0000-4000-8000-000000000411', 'en',
   'English PDF (fictional demo)', 'demo/publications/demo-disinformation-notes-en.pdf',
   'application/pdf', null, '2026-03-10T09:00:00Z', '2026-03-10T09:00:00Z'),
  ('10000000-0000-4000-8000-000000000436', '10000000-0000-4000-8000-000000000412', 'pl',
   'Polish PDF (fictional demo)', 'demo/publications/demo-volunteer-handbook-pl.pdf',
   'application/pdf', null, '2026-03-20T09:00:00Z', '2026-03-20T09:00:00Z'),
  ('10000000-0000-4000-8000-000000000437', '10000000-0000-4000-8000-000000000413', 'uk',
   'Ukrainian PDF (fictional demo)', 'demo/publications/demo-ecology-report-uk.pdf',
   'application/pdf', null, '2026-04-01T09:00:00Z', '2026-04-01T09:00:00Z')
on conflict (id) do update
  set publication_id = excluded.publication_id,
      locale = excluded.locale,
      label = excluded.label,
      storage_path = excluded.storage_path,
      mime_type = excluded.mime_type,
      file_size_bytes = excluded.file_size_bytes
where (
  public.publication_files.publication_id,
  public.publication_files.locale,
  public.publication_files.label,
  public.publication_files.storage_path,
  public.publication_files.mime_type,
  public.publication_files.file_size_bytes
) is distinct from (
  excluded.publication_id,
  excluded.locale,
  excluded.label,
  excluded.storage_path,
  excluded.mime_type,
  excluded.file_size_bytes
);

-- ===========================================================================
-- Organization documents: 3 file-based PDFs (EN/PL/UK editions).
-- The base `regulations` row (id …601) is the D-12 in-app reader and is left
-- untouched; demo documents use their own UUID namespace. Each demo document
-- keeps all three translations so every UI locale resolves a title.
-- ===========================================================================

insert into public.organization_documents (
  id, slug, status, document_type, language, publication_date, storage_path, mime_type,
  file_size_bytes, sort_order, published_at, created_at, updated_at
)
values
  (
    '10000000-0000-4000-8000-000000000610', 'demo-statute-en', 'published', 'statute', 'en', '2026-01-15',
    'demo/documents/demo-statute-en.pdf', 'application/pdf', null, 10,
    '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'
  ),
  (
    '10000000-0000-4000-8000-000000000620', 'demo-statute-pl', 'published', 'statute', 'pl', '2026-01-15',
    'demo/documents/demo-statute-pl.pdf', 'application/pdf', null, 11,
    '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'
  ),
  (
    '10000000-0000-4000-8000-000000000621', 'demo-statute-uk', 'published', 'statute', 'uk', '2026-01-15',
    'demo/documents/demo-statute-uk.pdf', 'application/pdf', null, 12,
    '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'
  )
on conflict (id) do update
  set slug = excluded.slug,
      status = excluded.status,
      document_type = excluded.document_type,
      language = excluded.language,
      publication_date = excluded.publication_date,
      storage_path = excluded.storage_path,
      mime_type = excluded.mime_type,
      file_size_bytes = excluded.file_size_bytes,
      sort_order = excluded.sort_order,
      published_at = excluded.published_at
where (
  public.organization_documents.slug,
  public.organization_documents.status,
  public.organization_documents.document_type,
  public.organization_documents.language,
  public.organization_documents.publication_date,
  public.organization_documents.storage_path,
  public.organization_documents.mime_type,
  public.organization_documents.file_size_bytes,
  public.organization_documents.sort_order,
  public.organization_documents.published_at
) is distinct from (
  excluded.slug,
  excluded.status,
  excluded.document_type,
  excluded.language,
  excluded.publication_date,
  excluded.storage_path,
  excluded.mime_type,
  excluded.file_size_bytes,
  excluded.sort_order,
  excluded.published_at
);

insert into public.organization_document_translations (
  id, document_id, locale, title, description, body, needs_review, created_at, updated_at
)
values
  -- English edition (base translations repurposed)
  ('10000000-0000-4000-8000-000000006100', '10000000-0000-4000-8000-000000000610', 'en',
   'Demo Statute — English edition (Fictional)',
   'Fictional demo document for local design testing.', null, false,
   '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('10000000-0000-4000-8000-000000006101', '10000000-0000-4000-8000-000000000610', 'pl',
   'Statut demonstracyjny — wydanie angielskie (fikcyjne)',
   'Fikcyjny dokument demonstracyjny do lokalnego testowania projektu.', null, false,
   '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('10000000-0000-4000-8000-000000006102', '10000000-0000-4000-8000-000000000610', 'uk',
   'Демонстраційний статут — англійське видання (фіктивне)',
   'Фіктивний демонстраційний документ для локального тестування дизайну.', null, false,
   '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  -- Polish edition
  ('10000000-0000-4000-8000-000000006210', '10000000-0000-4000-8000-000000000620', 'en',
   'Demo Statute — Polish edition (Fictional)',
   'Fictional demo document for local design testing.', null, false,
   '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('10000000-0000-4000-8000-000000006211', '10000000-0000-4000-8000-000000000620', 'pl',
   'Statut demonstracyjny — wydanie polskie (fikcyjne)',
   'Fikcyjny dokument demonstracyjny do lokalnego testowania projektu.', null, false,
   '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('10000000-0000-4000-8000-000000006212', '10000000-0000-4000-8000-000000000620', 'uk',
   'Демонстраційний статут — польське видання (фіктивне)',
   'Фіктивний демонстраційний документ для локального тестування дизайну.', null, false,
   '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  -- Ukrainian edition
  ('10000000-0000-4000-8000-000000006220', '10000000-0000-4000-8000-000000000621', 'en',
   'Demo Statute — Ukrainian edition (Fictional)',
   'Fictional demo document for local design testing.', null, false,
   '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('10000000-0000-4000-8000-000000006221', '10000000-0000-4000-8000-000000000621', 'pl',
   'Statut demonstracyjny — wydanie ukraińskie (fikcyjne)',
   'Fikcyjny dokument demonstracyjny do lokalnego testowania projektu.', null, false,
   '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('10000000-0000-4000-8000-000000006222', '10000000-0000-4000-8000-000000000621', 'uk',
   'Демонстраційний статут — українське видання (фіктивне)',
   'Фіктивний демонстраційний документ для локального тестування дизайну.', null, false,
   '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z')
on conflict (id) do update
  set document_id = excluded.document_id,
      locale = excluded.locale,
      title = excluded.title,
      description = excluded.description,
      body = excluded.body,
      needs_review = excluded.needs_review
where (
  public.organization_document_translations.document_id,
  public.organization_document_translations.locale,
  public.organization_document_translations.title,
  public.organization_document_translations.description,
  public.organization_document_translations.body,
  public.organization_document_translations.needs_review
) is distinct from (
  excluded.document_id,
  excluded.locale,
  excluded.title,
  excluded.description,
  excluded.body,
  excluded.needs_review
);

-- ===========================================================================
-- Calendar event links: two demo events linked to featured projects.
-- The base seed's fixture rows are left untouched so re-applying seed.sql stays
-- a no-op in the demo state. Total link rows after demo setup: 3 (base row
-- …503 plus demo-evt-0001 and demo-evt-0002); only the two demo rows use
-- `demo-calendar@example.invalid` and match the mock calendar.
-- ===========================================================================

insert into public.calendar_event_links (
  id, calendar_id, google_event_id, project_id, created_at, updated_at
)
values
  (
    '00000000-0000-4000-8000-000000000501', 'demo-calendar@example.invalid',
    'demo-evt-0001', '00000000-0000-4000-8000-000000000201',
    '2026-10-19T08:00:00Z', '2026-10-19T08:00:00Z'
  ),
  (
    '00000000-0000-4000-8000-000000000502', 'demo-calendar@example.invalid',
    'demo-evt-0002', '10000000-0000-4000-8000-000000000210',
    '2026-10-19T08:00:00Z', '2026-10-19T08:00:00Z'
  )
on conflict (id) do update
  set calendar_id = excluded.calendar_id,
      google_event_id = excluded.google_event_id,
      project_id = excluded.project_id
where (
  public.calendar_event_links.calendar_id,
  public.calendar_event_links.google_event_id,
  public.calendar_event_links.project_id
) is distinct from (
  excluded.calendar_id,
  excluded.google_event_id,
  excluded.project_id
);
