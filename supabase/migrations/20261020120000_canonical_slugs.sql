-- T-038 — one canonical slug per entity across all locales (D-24).
--
-- Design authority:
--   * docs/tickets/DECISIONS.md D-24 — every content URL uses ONE shared slug
--     under the existing /{locale}/ prefix. A localized slug is not a
--     translation of identity, so it cannot live on a translation row.
--   * docs/architecture.md §4 — root rows carry shared, locale-independent
--     metadata; translation rows carry localized text. The slug is identity,
--     therefore it belongs on the root.
--   * docs/architecture.md §8 — the locale is a URL prefix; switching language
--     is a pure prefix swap and must never rewrite the entity segment.
--   * docs/tickets/T-038-canonical-slugs.md — only projects, publications and
--     organization documents are slug-routed. site_pages keep page_key and
--     team_members keep name as their stable identity, but their unused
--     translation slugs are dropped as well so the ambiguity class does not
--     survive in any table.
--
-- Backfill source: the English translation slug. There is deliberately NO
-- coalesce fallback to another locale: English is the documented fallback
-- locale (architecture §8) and T-038 requires every row to have an English
-- translation. A row without one is a data defect, so the migration aborts
-- loudly below instead of silently inventing an identity from pl/uk.
--
-- Explicit transaction boundaries (not a runner guarantee): Supabase CLI
-- 2.115+ pipelines a migration file's statements, and a pipeline is not a
-- transaction block (supabase/cli#6347). Without this wrapper a failed
-- statement could leave the new columns half-populated or translation slugs
-- partially dropped. BEGIN/COMMIT is safe under both the pipeline and a
-- runner that already wraps the file: the nested BEGIN is a no-op warning and
-- the final COMMIT ends the same unit of work.
begin;

-- ---------------------------------------------------------------------------
-- Add the canonical slug columns (nullable until the verified backfill)
-- ---------------------------------------------------------------------------

alter table public.projects add column slug text;
alter table public.publications add column slug text;
alter table public.organization_documents add column slug text;

-- ---------------------------------------------------------------------------
-- Fail loudly if any row lacks an English translation
-- ---------------------------------------------------------------------------

do $$
declare
  missing_projects uuid[];
  missing_publications uuid[];
  missing_documents uuid[];
begin
  select array_agg(p.id order by p.id) into missing_projects
    from public.projects p
   where not exists (
     select 1
       from public.project_translations t
      where t.project_id = p.id
        and t.locale = 'en'
   );

  select array_agg(p.id order by p.id) into missing_publications
    from public.publications p
   where not exists (
     select 1
       from public.publication_translations t
      where t.publication_id = p.id
        and t.locale = 'en'
   );

  select array_agg(p.id order by p.id) into missing_documents
    from public.organization_documents p
   where not exists (
     select 1
       from public.organization_document_translations t
      where t.document_id = p.id
        and t.locale = 'en'
   );

  if missing_projects is not null
     or missing_publications is not null
     or missing_documents is not null then
    raise exception
      'T-038 backfill aborted: rows without an English translation slug — projects=%, publications=%, organization_documents=%',
      missing_projects, missing_publications, missing_documents;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Backfill from the English translation slug
-- ---------------------------------------------------------------------------

update public.projects p
   set slug = t.slug
  from public.project_translations t
 where t.project_id = p.id
   and t.locale = 'en';

update public.publications p
   set slug = t.slug
  from public.publication_translations t
 where t.publication_id = p.id
   and t.locale = 'en';

update public.organization_documents p
   set slug = t.slug
  from public.organization_document_translations t
 where t.document_id = p.id
   and t.locale = 'en';

-- ---------------------------------------------------------------------------
-- Enforce the canonical identity contract on the root tables
-- ---------------------------------------------------------------------------

alter table public.projects alter column slug set not null;
alter table public.projects
  add constraint projects_slug_key unique (slug),
  add constraint projects_slug_check check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');

alter table public.publications alter column slug set not null;
alter table public.publications
  add constraint publications_slug_key unique (slug),
  add constraint publications_slug_check check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');

alter table public.organization_documents alter column slug set not null;
alter table public.organization_documents
  add constraint organization_documents_slug_key unique (slug),
  add constraint organization_documents_slug_check check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');

comment on column public.projects.slug is
  'Canonical URL slug shared by every locale (D-24); unique across projects and stable across title edits.';
comment on column public.publications.slug is
  'Canonical URL slug shared by every locale (D-24); unique across publications and stable across title edits.';
comment on column public.organization_documents.slug is
  'Canonical URL slug shared by every locale (D-24); unique across documents and stable across title edits.';

comment on table public.project_translations is
  'One localized variant per project and locale; the canonical slug lives on projects (D-24).';
comment on table public.site_page_translations is
  'One localized variant per page and locale; the stable identity is site_pages.page_key (D-24).';

-- ---------------------------------------------------------------------------
-- Drop every per-locale slug, and its uniqueness/format constraints
-- ---------------------------------------------------------------------------
-- Dropping the column would remove the dependent constraints automatically;
-- they are named explicitly so the intent stays visible in review and no
-- database-specific implicit name is relied upon.

alter table public.project_translations
  drop constraint project_translations_locale_slug_key,
  drop constraint project_translations_slug_check,
  drop column slug;

alter table public.publication_translations
  drop constraint publication_translations_locale_slug_key,
  drop constraint publication_translations_slug_check,
  drop column slug;

alter table public.organization_document_translations
  drop constraint organization_document_translations_locale_slug_key,
  drop constraint organization_document_translations_slug_check,
  drop column slug;

alter table public.site_page_translations
  drop constraint site_page_translations_locale_slug_key,
  drop constraint site_page_translations_slug_check,
  drop column slug;

alter table public.team_member_translations
  drop constraint team_member_translations_locale_slug_key,
  drop constraint team_member_translations_slug_check,
  drop column slug;
commit;
