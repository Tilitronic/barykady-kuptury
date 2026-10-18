-- T-012 — V1 content model.
--
-- Single source of schema truth (AGENTS.md rule 5). Design authority:
--   * docs/architecture.md §4 — entities, lifecycle, normalized translation
--     tables, event-project relation and stable Google event identity.
--   * docs/architecture.md §6 — security enforced at the data boundary.
--   * docs/tickets/DECISIONS.md D-12 (regulation documents are .docx files),
--     D-17 (canonical admin claim; policies arrive in T-013).
--
-- Deliberately NOT in this migration:
--   * RLS policies — T-013. Tables are created with RLS *enabled* and zero
--     policies so they start closed (deny-by-default) and can never leak
--     because a later ticket "forgot" to enable RLS.
--   * Storage buckets — T-014.
--   * Cross-table invariants such as "publication has URL XOR files"; the
--     single-table declarative rules live here, the cross-table rule is owned
--     by T-029 where the write path exists.

-- ---------------------------------------------------------------------------
-- Enumerated domains
-- ---------------------------------------------------------------------------

create type public.content_status as enum ('draft', 'published', 'archived');
comment on type public.content_status is
  'Publishing lifecycle for content roots (docs/architecture.md §4).';

create type public.content_locale as enum ('en', 'pl', 'uk');
comment on type public.content_locale is
  'Supported locales. English is the fallback locale (docs/architecture.md §8).';

-- ---------------------------------------------------------------------------
-- Shared updated_at trigger
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  -- clock_timestamp(), not now(): now() is fixed for the whole transaction, so
  -- two updates in one transaction would not advance updated_at. Content is
  -- edited through short admin transactions but tests and RPCs may batch
  -- writes; a monotonic timestamp is the honest value.
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Advances updated_at to clock_timestamp() on each UPDATE (T-012). '
  'Precondition: may only be bound as a BEFORE UPDATE row trigger on tables that '
  'declare a non-null updated_at timestamptz column. The body assigns '
  'NEW.updated_at unconditionally, so binding it to a table without that column '
  'fails at UPDATE time rather than at CREATE TRIGGER time.';

-- ---------------------------------------------------------------------------
-- Site pages
-- ---------------------------------------------------------------------------

create table public.site_pages (
  id uuid primary key default gen_random_uuid(),
  page_key text not null,
  status public.content_status not null default 'draft',
  sort_order integer not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_pages_page_key_unique unique (page_key),
  constraint site_pages_page_key_check check (page_key ~ '^[a-z][a-z0-9-]*$')
);

comment on table public.site_pages is
  'Editable organization pages; translations hold localized title/body.';
comment on column public.site_pages.page_key is
  'Stable logical page identity (e.g. "about"), independent of locale.';
comment on column public.site_pages.sort_order is
  'Predictable display order; independent of locale (T-028).';

create table public.site_page_translations (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.site_pages (id) on delete cascade,
  locale public.content_locale not null,
  slug text not null,
  title text not null,
  body text,
  meta_description text,
  needs_review boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_page_translations_page_id_locale_key unique (page_id, locale),
  constraint site_page_translations_locale_slug_key unique (locale, slug),
  constraint site_page_translations_slug_check check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint site_page_translations_title_check check (length(btrim(title)) > 0)
);

comment on table public.site_page_translations is
  'One localized variant per page and locale; cascades with its page.';
comment on column public.site_page_translations.needs_review is
  'Marks unapproved machine/seed translations so T-031 can flag them.';
comment on column public.site_page_translations.body is
  'Nullable so an incomplete draft translation can be saved; publish gates it.';

-- ---------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  status public.content_status not null default 'draft',
  featured_rank integer,
  cover_path text,
  start_date date,
  end_date date,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_featured_rank_check check (featured_rank is null or featured_rank > 0),
  constraint projects_dates_check check (end_date is null or start_date is null or end_date >= start_date),
  constraint projects_cover_path_check check (
    cover_path is null
    or (length(btrim(cover_path)) > 0 and cover_path !~* '^https?://')
  )
);

comment on table public.projects is
  'Shared project lifecycle/media metadata; localized text in project_translations.';
comment on column public.projects.featured_rank is
  'Optional homepage slot. NULL = not featured; ordering handled by T-030.';
comment on column public.projects.cover_path is
  'Storage object path (never a URL); a check constraint enforces that.';

create table public.project_translations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  locale public.content_locale not null,
  slug text not null,
  title text not null,
  summary text,
  body text,
  needs_review boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_translations_project_id_locale_key unique (project_id, locale),
  constraint project_translations_locale_slug_key unique (locale, slug),
  constraint project_translations_slug_check check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint project_translations_title_check check (length(btrim(title)) > 0)
);

comment on table public.project_translations is
  'One localized variant per project and locale; slug is unique inside a locale.';
comment on column public.project_translations.summary is
  'Nullable: T-027 blocks publish until the fallback locale is complete.';

-- ---------------------------------------------------------------------------
-- Team members
-- ---------------------------------------------------------------------------

create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status public.content_status not null default 'draft',
  sort_order integer not null default 0,
  portrait_path text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_members_name_check check (length(btrim(name)) > 0),
  constraint team_members_portrait_path_check check (
    portrait_path is null
    or (length(btrim(portrait_path)) > 0 and portrait_path !~* '^https?://')
  )
);

comment on table public.team_members is
  'Published team entries with locale-independent name and ordering.';
comment on column public.team_members.portrait_path is
  'Storage object path (never a URL), optional.';

create table public.team_member_translations (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.team_members (id) on delete cascade,
  locale public.content_locale not null,
  slug text not null,
  role text,
  bio text,
  needs_review boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_member_translations_member_id_locale_key unique (member_id, locale),
  constraint team_member_translations_locale_slug_key unique (locale, slug),
  constraint team_member_translations_slug_check check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

comment on table public.team_member_translations is
  'Localized role/bio per member; both optional (docs/architecture.md §4).';
comment on column public.team_member_translations.role is
  'Optional; a member with no role still renders (T-018).';

-- ---------------------------------------------------------------------------
-- Publications
-- ---------------------------------------------------------------------------

create table public.publications (
  id uuid primary key default gen_random_uuid(),
  status public.content_status not null default 'draft',
  language public.content_locale,
  publication_date date,
  external_url text,
  sort_order integer not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint publications_external_url_check check (
    external_url is null
    or (length(btrim(external_url)) > 0 and external_url ~* '^https?://')
  )
);

comment on table public.publications is
  'Shared publication metadata; localized title/abstract/authors in translations.';
comment on column public.publications.external_url is
  'Optional external link; a publication may instead have rows in publication_files.';
comment on column public.publications.language is
  'Primary language of the publication itself, where it is meaningful.';

create table public.publication_translations (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.publications (id) on delete cascade,
  locale public.content_locale not null,
  slug text not null,
  title text not null,
  abstract text,
  authors text,
  needs_review boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint publication_translations_publication_id_locale_key unique (publication_id, locale),
  constraint publication_translations_locale_slug_key unique (locale, slug),
  constraint publication_translations_slug_check check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint publication_translations_title_check check (length(btrim(title)) > 0)
);

comment on table public.publication_translations is
  'Localized publication metadata; optional fields collapse in the UI (T-020).';

create table public.publication_files (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.publications (id) on delete cascade,
  locale public.content_locale not null,
  label text,
  storage_path text not null,
  mime_type text,
  file_size_bytes bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint publication_files_publication_id_locale_key unique (publication_id, locale),
  constraint publication_files_storage_path_check check (
    length(btrim(storage_path)) > 0 and storage_path !~* '^https?://'
  ),
  constraint publication_files_file_size_bytes_check check (
    file_size_bytes is null or file_size_bytes >= 0
  )
);

comment on table public.publication_files is
  'One file version per publication and locale; cascades with the publication.';
comment on column public.publication_files.storage_path is
  'Storage object path (never a URL); T-020 builds the public URL at read time.';

-- ---------------------------------------------------------------------------
-- Organization documents
-- ---------------------------------------------------------------------------

create table public.organization_documents (
  id uuid primary key default gen_random_uuid(),
  status public.content_status not null default 'draft',
  document_type text not null,
  language public.content_locale not null,
  publication_date date,
  storage_path text not null,
  mime_type text,
  file_size_bytes bigint,
  sort_order integer not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_documents_document_type_check check (length(btrim(document_type)) > 0),
  constraint organization_documents_storage_path_check check (
    length(btrim(storage_path)) > 0 and storage_path !~* '^https?://'
  ),
  constraint organization_documents_file_size_bytes_check check (
    file_size_bytes is null or file_size_bytes >= 0
  )
);

comment on table public.organization_documents is
  'Approved public files such as statute/annual/financial reports (D-12, T-017).';
comment on column public.organization_documents.document_type is
  'Free-form type label resolved to a localized name in the UI.';
comment on column public.organization_documents.language is
  'Language of the file itself, distinct from the UI locale.';

create table public.organization_document_translations (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.organization_documents (id) on delete cascade,
  locale public.content_locale not null,
  slug text not null,
  title text not null,
  description text,
  needs_review boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_document_translations_document_id_locale_key unique (document_id, locale),
  constraint organization_document_translations_locale_slug_key unique (locale, slug),
  constraint organization_document_translations_slug_check check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint organization_document_translations_title_check check (length(btrim(title)) > 0)
);

comment on table public.organization_document_translations is
  'Localized document metadata; cascades with its document.';

-- ---------------------------------------------------------------------------
-- Google Calendar event <-> project relation (docs/architecture.md §4)
-- ---------------------------------------------------------------------------

create table public.calendar_event_links (
  id uuid primary key default gen_random_uuid(),
  calendar_id text not null,
  google_event_id text not null,
  project_id uuid references public.projects (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_event_links_calendar_id_google_event_id_key
    unique (calendar_id, google_event_id),
  constraint calendar_event_links_calendar_id_check check (length(btrim(calendar_id)) > 0),
  constraint calendar_event_links_google_event_id_check check (length(btrim(google_event_id)) > 0)
);

comment on table public.calendar_event_links is
  'Maps a Google event identity to zero or one project. Never keyed by title/date.';
comment on column public.calendar_event_links.google_event_id is
  'Stable Google Calendar event ID; the calendar may change title/time freely.';
comment on column public.calendar_event_links.project_id is
  'NULL = unlinked. ON DELETE SET NULL keeps the event valid after project deletion.';

-- ---------------------------------------------------------------------------
-- Indexes for published listing, featured ordering, and event lookup
-- ---------------------------------------------------------------------------

create index site_pages_published_order_idx
  on public.site_pages (sort_order, published_at desc)
  where status = 'published';

-- Covers the public project listing (newest published / recently updated).
create index projects_published_order_idx
  on public.projects (published_at desc nulls last, updated_at desc)
  where status = 'published';

-- Featured ordering: ranks are unique and gap-free (T-030 enforces density).
create unique index projects_featured_rank_unique_idx
  on public.projects (featured_rank)
  where featured_rank is not null;

create index team_members_published_order_idx
  on public.team_members (sort_order)
  where status = 'published';

create index publications_published_order_idx
  on public.publications (publication_date desc nulls last, sort_order)
  where status = 'published';

create index organization_documents_published_order_idx
  on public.organization_documents (sort_order, publication_date desc nulls last)
  where status = 'published';

-- Event lookup by project (the calendar_id + google_event_id lookup is already
-- served by the unique constraint's index).
create index calendar_event_links_project_id_idx
  on public.calendar_event_links (project_id)
  where project_id is not null;

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

create trigger site_pages_set_updated_at
  before update on public.site_pages
  for each row execute function public.set_updated_at();

create trigger site_page_translations_set_updated_at
  before update on public.site_page_translations
  for each row execute function public.set_updated_at();

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

create trigger project_translations_set_updated_at
  before update on public.project_translations
  for each row execute function public.set_updated_at();

create trigger team_members_set_updated_at
  before update on public.team_members
  for each row execute function public.set_updated_at();

create trigger team_member_translations_set_updated_at
  before update on public.team_member_translations
  for each row execute function public.set_updated_at();

create trigger publications_set_updated_at
  before update on public.publications
  for each row execute function public.set_updated_at();

create trigger publication_translations_set_updated_at
  before update on public.publication_translations
  for each row execute function public.set_updated_at();

create trigger publication_files_set_updated_at
  before update on public.publication_files
  for each row execute function public.set_updated_at();

create trigger organization_documents_set_updated_at
  before update on public.organization_documents
  for each row execute function public.set_updated_at();

create trigger organization_document_translations_set_updated_at
  before update on public.organization_document_translations
  for each row execute function public.set_updated_at();

create trigger calendar_event_links_set_updated_at
  before update on public.calendar_event_links
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: enabled, zero policies (deny-by-default)
-- ---------------------------------------------------------------------------
-- Policies are authored in T-013. Enabling RLS here (rather than there) means
-- a table can never be exposed by an accidentally unprotected SELECT before
-- its policies land. Seed runs as the migration superuser and bypasses RLS.

alter table public.site_pages enable row level security;
alter table public.site_page_translations enable row level security;
alter table public.projects enable row level security;
alter table public.project_translations enable row level security;
alter table public.team_members enable row level security;
alter table public.team_member_translations enable row level security;
alter table public.publications enable row level security;
alter table public.publication_translations enable row level security;
alter table public.publication_files enable row level security;
alter table public.organization_documents enable row level security;
alter table public.organization_document_translations enable row level security;
alter table public.calendar_event_links enable row level security;
