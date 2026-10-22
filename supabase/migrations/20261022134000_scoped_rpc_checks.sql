-- T-046 — scoped re-checks inside the T-045 project RPCs (D-42).
--
-- Design authority:
--   * docs/architecture.md §6.1 — RPCs re-check the same predicate as RLS:
--     `public.is_admin() OR public.has_capability('projects:write')`. A scoped
--     editor's call must succeed; another scope's call must fail loudly with
--     42501 instead of silently affecting zero rows.
--   * docs/architecture.md §3 / §6 — feature data access stays behind the RPC
--     seam; authorization belongs at the data boundary. SECURITY INVOKER is
--     kept so the policies remain a second independent boundary.
--   * docs/tickets/T-045-admin-mutation-hardening.md — the function bodies and
--     all-or-nothing semantics are unchanged; only the authorization guard is
--     widened from "root only" to "root or projects:write".
--
-- Expected RED before this migration: a projects:write token fails both RPCs
-- with "admin role required" (42501) even though the projects policies allow
-- the write. After it, the scoped call succeeds and a publications:write token
-- still fails.

begin;

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
  if not (
    public.is_admin()
    or public.has_capability('projects:write')
  ) then
    raise exception 'admin role or projects:write capability required'
      using errcode = '42501',
            hint = 'Caller must carry app_metadata.role=admin or projects:write.';
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

    if not found then
      raise exception 'project not found'
        using errcode = 'P0002', hint = 'No project row is visible for this id.';
    end if;
  end if;

  delete from public.project_translations
   where project_id = v_id
     and locale not in (
       select (entry ->> 'locale')::public.content_locale
         from jsonb_array_elements(p_translations) as entry
     );

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
  'T-045/T-046: atomic admin project save (root + full translation set + lifecycle). SECURITY INVOKER, search_path pinned, re-checks is_admin() or projects:write.';

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
  if not (
    public.is_admin()
    or public.has_capability('projects:write')
  ) then
    raise exception 'admin role or projects:write capability required'
      using errcode = '42501',
            hint = 'Caller must carry app_metadata.role=admin or projects:write.';
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
  'T-045/T-046: atomic admin lifecycle transition; publish stamps published_at, draft/archived clear it. SECURITY INVOKER, re-checks is_admin() or projects:write.';

-- Privileges are unchanged from T-045: authenticated only; service_role is
-- deliberately excluded because this is a caller-rights operation.
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
