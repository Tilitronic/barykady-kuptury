-- T-039 — published-content search RPC (D-26).
--
-- Design authority:
--   * docs/tickets/DECISIONS.md D-26 — the site search runs two sources at
--     once: an instant client-side navigation index and this Postgres content
--     search over published pages/projects/publications/documents/team.
--     Calendar events are merged client-side (there is no event table).
--   * docs/tickets/T-039-consolidated-pages-search.md §"Search contract" —
--     exact signature, requested-locale-with-English-fallback, literal
--     substring matching, rank 3/2/1, limit 1–50, 180-character excerpt, and
--     `slug`/`page_key` output so the client builds locale-prefixed routes.
--   * docs/architecture.md §6 — RLS remains the data boundary. The function is
--     SECURITY INVOKER (no privilege escalation) and repeats
--     `status = 'published'` on every source so a future policy mistake cannot
--     widen public search.
--   * docs/tickets/DECISIONS.md D-24 — the canonical slug lives on the root
--     row for projects/publications/documents; pages use `page_key`; team
--     members use their name and the About `#team` section.
--
-- Why `strpos(lower(...), lower(query))` and not ILIKE:
--   The query is user input. ILIKE would treat `%` and `_` as wildcards, so a
--   visitor (or a fuzzer) could turn an ordinary search into a table scan or a
--   pattern injection. `strpos` performs a literal, case-insensitive substring
--   match and still uses `lower()` so Polish/Ukrainian case pairs match.
--
-- Why no index:
--   The published corpus is small (tens to low hundreds of rows). The ticket
--   explicitly defers trigram/tsvector indexes; revisit when volume justifies
--   it rather than adding write overhead and migration surface now (AGENTS.md
--   rule 7).
--
-- Why `stable`:
--   The function only reads committed data. `stable` lets the planner treat it
--   as a single snapshot inside a statement, and correctly forbids use in
--   contexts that require `immutable`.

create or replace function public.search_published_content(
  search_query text,
  result_locale public.content_locale,
  result_kinds text[] default null,
  result_limit integer default 20
)
returns table (
  kind text,
  entity_id uuid,
  title text,
  excerpt text,
  slug text,
  page_key text,
  rank integer
)
language sql
stable
security invoker
set search_path = public
as $$
  with params as (
    select
      lower(btrim(search_query)) as q,
      -- The ticket's public contract is 1–50; clamping (rather than raising)
      -- keeps the RPC total for every caller while still bounding the payload.
      least(greatest(coalesce(result_limit, 20), 1), 50) as max_rows
    where search_query is not null
      and length(btrim(search_query)) >= 2
      -- An explicitly empty kind array means "no source selected", which is a
      -- real empty result, not "all kinds". NULL keeps the default (all).
      and (result_kinds is null or cardinality(result_kinds) > 0)
  ),

  -- -------------------------------------------------------------------------
  -- One branch per source. Every branch:
  --   * selects the requested-locale translation, then English (T-038
  --     guarantees English exists for published project/publication/document
  --     rows; pages and team must have a translation to carry any text),
  --   * computes the highest-priority matching field as `rank`,
  --   * emits a whitespace-collapsed 180-character excerpt,
  --   * is filtered by an explicit published status and the kind list.
  -- -------------------------------------------------------------------------

  matches as (
    -- Site pages: title, meta description, body.
    select
      'page'::text as kind,
      p.id as entity_id,
      t.title,
      nullif(
        left(
          btrim(regexp_replace(
            coalesce(nullif(t.meta_description, ''), t.body, ''),
            '\s+', ' ', 'g'
          )),
          180
        ),
        ''
      ) as excerpt,
      null::text as slug,
      p.page_key,
      case
        when strpos(lower(t.title), prm.q) > 0 then 3
        when strpos(lower(coalesce(t.meta_description, '')), prm.q) > 0 then 2
        when strpos(lower(coalesce(t.body, '')), prm.q) > 0 then 1
        else 0
      end as rank
    from public.site_pages p
    cross join params prm
    join lateral (
      select tr.title, tr.meta_description, tr.body
      from public.site_page_translations tr
      where tr.page_id = p.id
        and tr.locale in (result_locale, 'en')
      -- TRUE sorts first: the requested locale wins over English.
      order by (tr.locale = result_locale) desc
      limit 1
    ) t on true
    where p.status = 'published'
      and (result_kinds is null or 'page' = any(result_kinds))

    union all

    -- Projects: title, summary, body.
    select
      'project'::text,
      p.id,
      t.title,
      nullif(
        left(
          btrim(regexp_replace(
            coalesce(nullif(t.summary, ''), t.body, ''),
            '\s+', ' ', 'g'
          )),
          180
        ),
        ''
      ),
      p.slug,
      null::text,
      case
        when strpos(lower(t.title), prm.q) > 0 then 3
        when strpos(lower(coalesce(t.summary, '')), prm.q) > 0 then 2
        when strpos(lower(coalesce(t.body, '')), prm.q) > 0 then 1
        else 0
      end
    from public.projects p
    cross join params prm
    join lateral (
      select tr.title, tr.summary, tr.body
      from public.project_translations tr
      where tr.project_id = p.id
        and tr.locale in (result_locale, 'en')
      order by (tr.locale = result_locale) desc
      limit 1
    ) t on true
    where p.status = 'published'
      and (result_kinds is null or 'project' = any(result_kinds))

    union all

    -- Publications: title, abstract (no body column).
    select
      'publication'::text,
      p.id,
      t.title,
      nullif(
        left(
          btrim(regexp_replace(
            coalesce(t.abstract, ''),
            '\s+', ' ', 'g'
          )),
          180
        ),
        ''
      ),
      p.slug,
      null::text,
      case
        when strpos(lower(t.title), prm.q) > 0 then 3
        when strpos(lower(coalesce(t.abstract, '')), prm.q) > 0 then 2
        else 0
      end
    from public.publications p
    cross join params prm
    join lateral (
      select tr.title, tr.abstract
      from public.publication_translations tr
      where tr.publication_id = p.id
        and tr.locale in (result_locale, 'en')
      order by (tr.locale = result_locale) desc
      limit 1
    ) t on true
    where p.status = 'published'
      and (result_kinds is null or 'publication' = any(result_kinds))

    union all

    -- Organization documents: title, description, readable body (T-017).
    select
      'document'::text,
      p.id,
      t.title,
      nullif(
        left(
          btrim(regexp_replace(
            coalesce(nullif(t.description, ''), t.body, ''),
            '\s+', ' ', 'g'
          )),
          180
        ),
        ''
      ),
      p.slug,
      null::text,
      case
        when strpos(lower(t.title), prm.q) > 0 then 3
        when strpos(lower(coalesce(t.description, '')), prm.q) > 0 then 2
        when strpos(lower(coalesce(t.body, '')), prm.q) > 0 then 1
        else 0
      end
    from public.organization_documents p
    cross join params prm
    join lateral (
      select tr.title, tr.description, tr.body
      from public.organization_document_translations tr
      where tr.document_id = p.id
        and tr.locale in (result_locale, 'en')
      order by (tr.locale = result_locale) desc
      limit 1
    ) t on true
    where p.status = 'published'
      and (result_kinds is null or 'document' = any(result_kinds))

    union all

    -- Team members: the name is locale-independent on the root row; role and
    -- bio are optional translations (D-24: team has no slug — the route is
    -- the About #team section). LEFT JOIN LATERAL keeps a published member
    -- with no translation searchable by name.
    select
      'team'::text,
      m.id,
      m.name,
      nullif(
        left(
          btrim(regexp_replace(
            coalesce(nullif(t.role, ''), t.bio, ''),
            '\s+', ' ', 'g'
          )),
          180
        ),
        ''
      ),
      null::text,
      null::text,
      case
        when strpos(lower(m.name), prm.q) > 0 then 3
        when strpos(lower(coalesce(t.role, '')), prm.q) > 0 then 2
        when strpos(lower(coalesce(t.bio, '')), prm.q) > 0 then 1
        else 0
      end
    from public.team_members m
    cross join params prm
    left join lateral (
      select tr.role, tr.bio
      from public.team_member_translations tr
      where tr.member_id = m.id
        and tr.locale in (result_locale, 'en')
      order by (tr.locale = result_locale) desc
      limit 1
    ) t on true
    where m.status = 'published'
      and (result_kinds is null or 'team' = any(result_kinds))
  )

  select
    m.kind,
    m.entity_id,
    m.title,
    m.excerpt,
    m.slug,
    m.page_key,
    m.rank
  from matches m
  cross join params prm
  where m.rank > 0
  -- Contract order: strongest field first, then stable alphabetical titles.
  order by m.rank desc, m.title asc
  limit (select max_rows from params);
$$;

comment on function public.search_published_content(text, public.content_locale, text[], integer) is
  'T-039/D-26: literal, case-insensitive substring search over published site '
  'pages, projects, publications, organization documents and team members. '
  'Selects the requested locale with English fallback, ranks title matches 3, '
  'summary/abstract/description/role matches 2 and body/bio matches 1, and '
  'returns slug/page_key for client-built locale routes. SECURITY INVOKER so '
  'RLS remains the boundary; every source also filters status = ''published''.';

-- Function execution is an explicit grant: the RPC is part of the public read
-- contract (anon and authenticated), while PUBLIC keeps its PostgreSQL default
-- grant for the same reason. service_role is listed so an admin-side caller
-- keeps working after a future REVOKE from PUBLIC.
revoke all on function public.search_published_content(
  text, public.content_locale, text[], integer
) from public;

grant execute on function public.search_published_content(
  text, public.content_locale, text[], integer
) to anon, authenticated, service_role;
