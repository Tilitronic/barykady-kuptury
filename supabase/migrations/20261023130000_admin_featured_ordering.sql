-- T-030 — administrator-controlled homepage featured ordering.
--
-- Design authority:
--   * docs/PRODUCT_REQUIREMENTS.md §5 — the homepage shows "featured projects
--     selected by an administrator; if none are selected, use the most recently
--     updated published projects". §6 lists "manage available homepage
--     featured projects and their order" as an MVP admin capability.
--   * docs/architecture.md §4 — `projects` is the root lifecycle row and
--     `featured_rank` is locale-independent ordering. "Predictable ordering"
--     means one deterministic editorial sequence, not a per-locale list.
--   * docs/tickets/T-030-admin-featured-ordering.md — dense, gap-free,
--     deterministic ranks; only published projects may be featured; an
--     unpublish/delete removes the project without breaking the sequence.
--   * docs/architecture.md §6.1 / T-046 — the write boundary re-checks
--     `is_admin() OR has_capability('projects:write')`, exactly like the
--     T-045 project RPC family. RLS remains the second boundary because every
--     function is SECURITY INVOKER.
--
-- Reuses the T-028 ordering contract: positions are 1..n, assigned from the
-- complete desired id sequence, and a transient duplicate inside a statement
-- is legal because the uniqueness check is deferred to commit.
--
-- Expected RED before this migration: `set_project_featured_v1` and
-- `reorder_featured_projects_v1` do not exist, the unique index is not
-- deferrable, and unpublishing a featured project leaves its rank behind.

begin;

-- ---------------------------------------------------------------------------
-- Collision-free, atomically reorderable ranks
-- ---------------------------------------------------------------------------
-- The original partial unique index checked uniqueness row-by-row. A reorder
-- necessarily produces transient duplicates (for example 1,2,3 → 3,1,2), so
-- the index is replaced by a DEFERRABLE unique constraint whose final check
-- happens at commit. NULL ranks stay allowed and are distinct (PostgreSQL's
-- default), which is exactly "not featured".

drop index if exists public.projects_featured_rank_unique_idx;

alter table public.projects
  add constraint projects_featured_rank_key
  unique (featured_rank) deferrable initially deferred;

comment on constraint projects_featured_rank_key on public.projects is
  'T-030: featured ranks are unique at commit; deferral permits atomic reorder.';

create index projects_featured_order_idx
  on public.projects (featured_rank)
  where featured_rank is not null and status = 'published';

comment on index public.projects_featured_order_idx is
  'T-030: the homepage/admin featured reads order by this dense sequence.';

-- ---------------------------------------------------------------------------
-- Only published projects may carry a featured rank
-- ---------------------------------------------------------------------------
-- A BEFORE trigger is the last line of defence for every write path, including
-- a future direct table update. It silently clears a rank on a non-published
-- row rather than failing the whole project save: the service still rejects
-- "feature this draft" with a localized message, but a stale checkbox must not
-- corrupt the homepage or block an unrelated edit.

create or replace function public.enforce_featured_rank_published_v1()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.featured_rank is not null and new.status <> 'published' then
    new.featured_rank := null;
  end if;
  return new;
end;
$$;

comment on function public.enforce_featured_rank_published_v1() is
  'T-030: featured_rank may exist only while status = published.';

revoke all on function public.enforce_featured_rank_published_v1()
  from public, anon, authenticated, service_role;

create trigger projects_featured_rank_published_guard
before insert or update of status, featured_rank on public.projects
for each row execute function public.enforce_featured_rank_published_v1();

-- ---------------------------------------------------------------------------
-- Dense gap closure after removal
-- ---------------------------------------------------------------------------
-- Any path that drops a rank (unpublish transition, delete, or a project save
-- that unchecks "featured") must renumber the remaining rows. Renumbering by
-- the current rank keeps the editorial order; created_at/id break impossible
-- ties deterministically.
--
-- SECURITY DEFINER is deliberate: this is invariant maintenance, not user
-- content. A scoped `projects:write` editor may unpublish a project, and the
-- closing UPDATE must not be silently filtered by RLS on the sibling rows.

create or replace function public.densify_featured_ranks_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  with ranked as (
    select
      id,
      row_number() over (order by featured_rank, created_at, id) as position
    from public.projects
    where featured_rank is not null
      and status = 'published'
  )
  update public.projects as project
     set featured_rank = ranked.position
    from ranked
   where project.id = ranked.id
     and project.featured_rank is distinct from ranked.position;

  return null;
end;
$$;

comment on function public.densify_featured_ranks_v1() is
  'T-030: renumbers featured published projects to dense 1..n after a removal.';

revoke all on function public.densify_featured_ranks_v1()
  from public, anon, authenticated, service_role;

create trigger projects_featured_rank_close_gaps_on_update
after update of status, featured_rank on public.projects
for each row
when (
  old.featured_rank is not null
  and (new.featured_rank is null or new.status <> 'published')
)
execute function public.densify_featured_ranks_v1();

create trigger projects_featured_rank_close_gaps_on_delete
after delete on public.projects
for each row
when (old.featured_rank is not null)
execute function public.densify_featured_ranks_v1();

-- ---------------------------------------------------------------------------
-- set_project_featured_v1 — add/remove one project
-- ---------------------------------------------------------------------------
-- The featured admin view calls this instead of writing `featured_rank`
-- directly, so "next free slot" and "published only" are decided in one place.
-- Adding an already-featured project is a no-op; removing renumbers via the
-- AFTER trigger above.

create or replace function public.set_project_featured_v1(
  p_id uuid,
  p_featured boolean
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_status public.content_status;
  v_rank integer;
begin
  if not (
    public.is_admin()
    or public.has_capability('projects:write')
  ) then
    raise exception 'admin role or projects:write capability required'
      using errcode = '42501',
            hint = 'Caller must carry app_metadata.role=admin or projects:write.';
  end if;

  select status, featured_rank
    into v_status, v_rank
    from public.projects
   where id = p_id;

  if not found then
    raise exception 'project not found'
      using errcode = 'P0002',
            hint = 'No project row is visible for this id.';
  end if;

  if p_featured then
    if v_status <> 'published' then
      raise exception 'only published projects can be featured'
        using errcode = '23514',
              hint = 'Publish the project before adding it to the homepage order.';
    end if;

    if v_rank is null then
      update public.projects
         set featured_rank = (
           select coalesce(max(featured_rank), 0) + 1
             from public.projects
            where featured_rank is not null
         )
       where id = p_id;
    end if;
  else
    update public.projects
       set featured_rank = null
     where id = p_id;
  end if;
end;
$$;

comment on function public.set_project_featured_v1(uuid, boolean) is
  'T-030: add (append dense slot) or remove one featured project. SECURITY INVOKER, re-checks is_admin() or projects:write.';

-- ---------------------------------------------------------------------------
-- reorder_featured_projects_v1 — complete dense 1..n order
-- ---------------------------------------------------------------------------
-- p_ids is the complete desired featured list. Every id must be a featured,
-- published project. Any featured project omitted from the prefix is appended
-- in its current order, so a stale admin tab can never make a row disappear.
-- The deferred unique constraint allows the intermediate duplicate state.

create or replace function public.reorder_featured_projects_v1(
  p_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_invalid uuid;
begin
  if not (
    public.is_admin()
    or public.has_capability('projects:write')
  ) then
    raise exception 'admin role or projects:write capability required'
      using errcode = '42501',
            hint = 'Caller must carry app_metadata.role=admin or projects:write.';
  end if;

  if p_ids is null then
    raise exception 'p_ids must be an array of featured project ids'
      using errcode = '22023';
  end if;

  if exists (
    select 1 from unnest(p_ids) as candidate(id) where id is null
  ) then
    raise exception 'p_ids must not contain null ids'
      using errcode = '22023';
  end if;

  if (
    select count(*) from unnest(p_ids) as candidate(id)
  ) <> (
    select count(distinct candidate.id) from unnest(p_ids) as candidate(id)
  ) then
    raise exception 'p_ids must not contain duplicate ids'
      using errcode = '22023';
  end if;

  select candidate.id
    into v_invalid
    from unnest(p_ids) as candidate(id)
   where not exists (
     select 1 from public.projects as project where project.id = candidate.id
   )
   limit 1;

  if v_invalid is not null then
    raise exception 'project not found'
      using errcode = 'P0002',
            hint = 'Every supplied id must be a visible project.';
  end if;

  select candidate.id
    into v_invalid
    from unnest(p_ids) as candidate(id)
   where not exists (
     select 1
       from public.projects as project
      where project.id = candidate.id
        and project.status = 'published'
        and project.featured_rank is not null
   )
   limit 1;

  if v_invalid is not null then
    raise exception 'every id must be a featured published project'
      using errcode = '23514',
            hint = 'Add the project through set_project_featured_v1 first.';
  end if;

  update public.projects as project
     set featured_rank = desired.position
    from (
      select id, position
        from unnest(p_ids) with ordinality as supplied(id, position)
    ) as desired
   where project.id = desired.id;

  -- Featured rows omitted from a partial prefix keep a deterministic place
  -- after it, exactly like the T-028 team prefix rule.
  update public.projects as project
     set featured_rank = prefix.max_position + ranked.position
    from (
      select
        id,
        row_number() over (order by featured_rank, created_at, id) as position
      from public.projects
      where featured_rank is not null
        and status = 'published'
        and id <> all (p_ids)
    ) as ranked,
    (
      select coalesce(max(featured_rank), 0) as max_position
      from public.projects
      where id = any (p_ids)
    ) as prefix
   where project.id = ranked.id;
end;
$$;

comment on function public.reorder_featured_projects_v1(uuid[]) is
  'T-030: atomic dense 1..n featured order; duplicates/unknown ids fail loudly. SECURITY INVOKER, re-checks is_admin() or projects:write.';

-- ---------------------------------------------------------------------------
-- transition_project_v1 — unpublish clears the featured slot
-- ---------------------------------------------------------------------------
-- Re-created (not replaced in place) to keep the T-046 capability guard and to
-- make the removal explicit in the lifecycle statement. The BEFORE trigger
-- would clear it anyway; being explicit documents the product rule and lets a
-- reader see that publish keeps the existing rank.

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
         featured_rank = case
           when p_status = 'published' then featured_rank
           else null
         end,
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
  'T-045/T-046/T-030: lifecycle transition; non-published clears featured_rank, publish stamps published_at. SECURITY INVOKER, re-checks is_admin() or projects:write.';

-- ---------------------------------------------------------------------------
-- save_project_v1 — the legacy project-editor checkbox stays rank-safe
-- ---------------------------------------------------------------------------
-- T-027's editor still carries a "Feature on the homepage" checkbox. That flag
-- must not be able to invent a colliding rank (for example rank 1 while rank 1
-- exists) or reorder the list. The save therefore normalizes it:
--   * non-published status → NULL (the BEFORE trigger is the second guard);
--   * request not featured → NULL (removal; gaps close via the AFTER trigger);
--   * already featured → keep the current rank (order is owned by
--     reorder_featured_projects_v1);
--   * newly featured → append max(rank)+1.
-- The signature and the T-046 capability check are unchanged.

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
  v_featured_rank integer;
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

  if p_status <> 'published' or p_featured_rank is null then
    v_featured_rank := null;
  else
    select coalesce(
      (select featured_rank from public.projects where id = v_id),
      (select coalesce(max(featured_rank), 0) + 1
         from public.projects
        where featured_rank is not null)
    )
    into v_featured_rank;
  end if;

  if v_id is null then
    insert into public.projects (
      slug, status, featured_rank, cover_path, start_date, end_date, published_at
    )
    values (
      p_slug, p_status, v_featured_rank, p_cover_path,
      p_start_date, p_end_date, p_published_at
    )
    returning id into v_id;
  else
    update public.projects
       set slug = p_slug,
           status = p_status,
           featured_rank = v_featured_rank,
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
  'T-045/T-046/T-030: atomic project save; featured_rank is normalized to keep the homepage order collision-free. SECURITY INVOKER, re-checks is_admin() or projects:write.';

-- ---------------------------------------------------------------------------
-- Privileges: authenticated API role only (caller-rights admin operations)
-- ---------------------------------------------------------------------------

revoke all on function public.set_project_featured_v1(uuid, boolean)
  from public, anon, authenticated, service_role;
revoke all on function public.reorder_featured_projects_v1(uuid[])
  from public, anon, authenticated, service_role;
revoke all on function public.save_project_v1(
  uuid, text, public.content_status, integer, text, date, date, timestamptz, jsonb
) from public, anon, authenticated, service_role;
revoke all on function public.transition_project_v1(
  uuid, public.content_status, timestamptz
) from public, anon, authenticated, service_role;

grant execute on function public.set_project_featured_v1(uuid, boolean)
  to authenticated;
grant execute on function public.reorder_featured_projects_v1(uuid[])
  to authenticated;
grant execute on function public.save_project_v1(
  uuid, text, public.content_status, integer, text, date, date, timestamptz, jsonb
) to authenticated;
grant execute on function public.transition_project_v1(
  uuid, public.content_status, timestamptz
) to authenticated;

commit;
