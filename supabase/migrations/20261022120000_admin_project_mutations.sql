-- T-045 — atomic admin project save + lifecycle transition, and the
-- status ↔ published_at invariant.
--
-- Design authority:
--   * docs/tickets/T-045-admin-mutation-hardening.md — T-027 wrote the root,
--     translation upserts, per-locale deletes and publish/unpublish/archive as
--     separate PostgREST requests. A failure after the first request could
--     leave partial state. One PL/pgSQL function per logical mutation moves
--     every step into a single statement, therefore a single transaction: a
--     raised error rolls the whole mutation back.
--   * docs/architecture.md §3 — feature data access stays behind a module seam;
--     the browser now calls one RPC instead of orchestrating four table
--     requests. The page contract is unchanged (the TypeScript module still
--     returns its discriminated result union).
--   * docs/architecture.md §4 — draft/published/archived lifecycle; a published
--     row must carry published_at. The constraint below makes this true for
--     every write path, including future admin features (T-028/T-029).
--   * docs/architecture.md §6 — authorization belongs at the data boundary.
--     Both functions are SECURITY INVOKER, pin search_path, and re-check
--     public.is_admin() inside. RLS policies remain a second independent
--     boundary; neither function trusts a client-supplied identity, role or
--     "am I allowed" flag.
--   * docs/tickets/DECISIONS.md D-17 — only the verified JWT's
--     app_metadata.role='admin' grants admin; user_metadata is never read.
--
-- Why SECURITY INVOKER rather than DEFINER:
--   The caller already has the RLS grant the function needs (projects and
--   project_translations insert/update/delete admin policies). Invoker rights
--   keep those policies in force for every statement inside the function, so a
--   future policy tightening cannot be bypassed by calling the RPC. The
--   explicit is_admin() check exists because RLS alone silently affects zero
--   rows on a non-admin update instead of producing a clear denial; the
--   function must fail loudly and write nothing.
--
-- Why the check constraint is validated now:
--   The migration aborts if any existing published row lacks published_at,
--   because silently "fixing" data would hide a product defect. The local and
--   production-shaped data sets were verified clean before this migration.
--
-- Expected RED before this migration: supabase/tests/admin_project_mutations_test.sql
-- fails all RPC assertions with "function ... does not exist".

begin;

-- ---------------------------------------------------------------------------
-- Lifecycle invariant: published rows always have a publication timestamp
-- ---------------------------------------------------------------------------
-- Only the forward implication is constrained: a draft/archived row may keep a
-- historical timestamp (the app clears it today, but historical data is not
-- invalid). The state that must never exist is "visible to the public but with
-- no publication date".

alter table public.projects
  add constraint projects_published_at_check
  check (status <> 'published' or published_at is not null);

comment on constraint projects_published_at_check on public.projects is
  'T-045: status=published requires published_at; enforced for every write path, not only the admin client.';

-- ---------------------------------------------------------------------------
-- save_project_v1 — root + translations + lifecycle in one transaction
-- ---------------------------------------------------------------------------
-- p_translations is the complete intended translation set:
--   [{"locale":"en","title":"…","summary":"…"|null,"body":"…"|null}, …]
-- Locales absent from the array are deleted. An empty array clears every
-- translation. Titles are passed through untrimmed on purpose: the table's
-- NOT NULL + non-blank CHECK raises 23514 for a blank title, and because this
-- is one statement the caller gets the same all-or-nothing behaviour as any
-- other SQL error.
--
-- Inserts and updates share one code path so the "new project" and "edit
-- project" semantics cannot drift. featured_rank, published_at and the cover
-- path are caller-computed (the editor preserves the T-030 slot and the
-- original publication time), but the database remains the authority for
-- uniqueness and for the published_at invariant.

create or replace function public.save_project_v1(
  p_id uuid,
  p_slug text,
  p_status public.content_status,
  p_featured_rank integer,
  p_cover_path text,
  p_start_date date,
  p_end_date date,
  p_published_at timestamptz,
  p_translations jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := p_id;
begin
  if not public.is_admin() then
    raise exception 'admin role required'
      using errcode = '42501', hint = 'Caller must carry app_metadata.role=admin.';
  end if;

  if p_translations is null or jsonb_typeof(p_translations) <> 'array' then
    raise exception 'p_translations must be a JSON array'
      using errcode = '22023';
  end if;

  if v_id is null then
    insert into public.projects (
      slug, status, featured_rank, cover_path, start_date, end_date, published_at
    )
    values (
      p_slug, p_status, p_featured_rank, p_cover_path,
      p_start_date, p_end_date, p_published_at
    )
    returning id into v_id;
  else
    update public.projects
       set slug = p_slug,
           status = p_status,
           featured_rank = p_featured_rank,
           cover_path = p_cover_path,
           start_date = p_start_date,
           end_date = p_end_date,
           published_at = p_published_at
     where id = v_id;

    -- A missing id (or a row RLS hides) is a hard failure, never a silent
    -- no-op that the editor would report as a successful save.
    if not found then
      raise exception 'project not found'
        using errcode = 'P0002', hint = 'No project row is visible for this id.';
    end if;
  end if;

  -- Delete first: the payload is the complete intended set, so an omitted
  -- locale is a deliberate clear. Doing this before the upsert also means the
  -- rollback proof covers a deletion that had already executed.
  delete from public.project_translations
   where project_id = v_id
     and locale not in (
       select (entry ->> 'locale')::public.content_locale
         from jsonb_array_elements(p_translations) as entry
     );

  -- One INSERT ... ON CONFLICT statement: every supplied locale is written or
  -- updated together. Blank titles (and any other table constraint) abort the
  -- whole function, which rolls the root update and the delete back too.
  insert into public.project_translations (
    project_id, locale, title, summary, body
  )
  select
    v_id,
    (entry ->> 'locale')::public.content_locale,
    entry ->> 'title',
    case
      when entry ->> 'summary' is null
        or btrim(entry ->> 'summary') = '' then null
      else entry ->> 'summary'
    end,
    case
      when entry ->> 'body' is null
        or btrim(entry ->> 'body') = '' then null
      else entry ->> 'body'
    end
  from jsonb_array_elements(p_translations) as entry
  on conflict (project_id, locale) do update
     set title = excluded.title,
         summary = excluded.summary,
         body = excluded.body;

  return v_id;
end;
$$;

comment on function public.save_project_v1(
  uuid, text, public.content_status, integer, text, date, date, timestamptz, jsonb
) is
  'T-045: atomic admin project save (root + full translation set + lifecycle). SECURITY INVOKER, search_path pinned, re-checks is_admin().';

-- ---------------------------------------------------------------------------
-- transition_project_v1 — publish / unpublish / archive in one statement
-- ---------------------------------------------------------------------------
-- The caller supplies the transition, not a partially updated row: status and
-- published_at are computed together so the invariant cannot be violated by a
-- two-request editor flow. p_published_at lets the editor preserve a known
-- publication time; when omitted, publish stamps the database clock. Any
-- non-published status clears the timestamp.

create or replace function public.transition_project_v1(
  p_id uuid,
  p_status public.content_status,
  p_published_at timestamptz default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admin role required'
      using errcode = '42501', hint = 'Caller must carry app_metadata.role=admin.';
  end if;

  update public.projects
     set status = p_status,
         published_at = case
           when p_status = 'published'
             then coalesce(p_published_at, clock_timestamp())
           else null
         end
   where id = p_id;

  if not found then
    raise exception 'project not found'
      using errcode = 'P0002', hint = 'No project row is visible for this id.';
  end if;
end;
$$;

comment on function public.transition_project_v1(
  uuid, public.content_status, timestamptz
) is
  'T-045: atomic admin lifecycle transition; publish stamps published_at, draft/archived clear it. SECURITY INVOKER, re-checks is_admin().';

-- ---------------------------------------------------------------------------
-- Privileges: admins call this through the authenticated API role only
-- ---------------------------------------------------------------------------
-- Postgres grants EXECUTE to PUBLIC by default, and the local Supabase
-- environment additionally installs default function privileges for anon,
-- authenticated and service_role. Revoke every non-admin role explicitly: the
-- service role is intentionally not granted because these are caller-rights
-- admin operations, not server integrations. Then grant exactly the API role
-- the browser uses.

revoke all on function public.save_project_v1(
  uuid, text, public.content_status, integer, text, date, date, timestamptz, jsonb
) from public, anon, authenticated, service_role;
revoke all on function public.transition_project_v1(
  uuid, public.content_status, timestamptz
) from public, anon, authenticated, service_role;

grant execute on function public.save_project_v1(
  uuid, text, public.content_status, integer, text, date, date, timestamptz, jsonb
) to authenticated;
grant execute on function public.transition_project_v1(
  uuid, public.content_status, timestamptz
) to authenticated;

commit;
