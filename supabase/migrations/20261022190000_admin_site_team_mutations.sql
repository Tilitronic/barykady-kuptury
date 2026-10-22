-- T-028 — atomic admin site-page and team mutations, plus the ordering and
-- publication invariants those editors rely on.
--
-- Design authority:
--   * docs/tickets/T-028-admin-site-team.md — site pages: pick an existing
--     page, edit per-locale title/body, publish/unpublish; team: create/edit/
--     reorder/delete, optional portrait, per-locale role/bio, publish toggle.
--   * docs/architecture.md §4 — root rows own lifecycle/order; translations are
--     one row per (parent, locale); `site_pages.page_key` is the stable
--     identity (D-24/T-038 removed localized slugs).
--   * docs/architecture.md §6.1 — `pages:write` and `team:write` are the
--     capability scopes; RPCs re-check `is_admin() OR has_capability(...)`
--     exactly like the T-045/T-046 project family.
--   * T-045 — copy the paired transactional RPC pattern per entity rather than
--     inventing a generic mutation framework (architector decision). One
--     statement per logical mutation = one transaction = all-or-nothing.
--
-- Why SECURITY INVOKER:
--   The caller already holds the RLS policies these statements need. Invoker
--   rights keep RLS as a second independent boundary; the explicit capability
--   check exists because RLS silently affects zero rows on a denied UPDATE
--   instead of producing a clear denial.
--
-- Scope enforcement:
--   `save_site_page_v1` requires a non-null id. T-028 explicitly excludes
--   arbitrary page creation, so the database refuses to invent a page row even
--   if a future client tries.
--
-- Team ordering:
--   `reorder_team_members_v1` writes a dense 1..n sequence in one transaction.
--   A DEFERRABLE unique constraint makes transient duplicates legal inside the
--   transaction but illegal at commit, so a crash cannot leave two members on
--   the same position.

begin;

-- ---------------------------------------------------------------------------
-- Lifecycle invariants (same forward implication as T-045 projects)
-- ---------------------------------------------------------------------------
-- A draft/archived row may keep a historical timestamp; the state that must
-- never exist is "visible to the public but with no publication date".

alter table public.site_pages
  add constraint site_pages_published_at_check
  check (status <> 'published' or published_at is not null);

comment on constraint site_pages_published_at_check on public.site_pages is
  'T-028: status=published requires published_at for every write path.';

alter table public.team_members
  add constraint team_members_published_at_check
  check (status <> 'published' or published_at is not null);

comment on constraint team_members_published_at_check on public.team_members is
  'T-028: status=published requires published_at for every write path.';

-- ---------------------------------------------------------------------------
-- Collision-free team ordering
-- ---------------------------------------------------------------------------
-- DEFERRABLE INITIALLY DEFERRED is deliberate: the reorder RPC updates several
-- rows in one statement, and PostgreSQL otherwise checks the unique index
-- row-by-row. Deferral moves the check to commit, where the final 1..n state is
-- guaranteed unique. It also keeps a single-row save honest: two concurrent
-- creates computing the same max+1 cannot both commit.

alter table public.team_members
  add constraint team_members_sort_order_key
  unique (sort_order) deferrable initially deferred;

comment on constraint team_members_sort_order_key on public.team_members is
  'T-028: positions are unique at commit; deferral permits atomic reordering.';

-- ---------------------------------------------------------------------------
-- save_site_page_v1 — existing page + complete translation set
-- ---------------------------------------------------------------------------
-- p_translations is the complete intended set:
--   [{"locale":"en","title":"…","body":"…"|null,
--     "metaDescription":"…"|null}, …]
-- Locales absent from the array are deleted: an omitted locale is a deliberate
-- clear. The editor always sends the whole map, built from immutable per-locale
-- drafts, so editing one tab cannot overwrite another locale.

create or replace function public.save_site_page_v1(
  p_id uuid,
  p_status public.content_status,
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
    or public.has_capability('pages:write')
  ) then
    raise exception 'admin role or pages:write capability required'
      using errcode = '42501',
            hint = 'Caller must carry app_metadata.role=admin or pages:write.';
  end if;

  -- T-028 scope: edit an existing organization page, never create one.
  if v_id is null then
    raise exception 'site page id is required'
      using errcode = '22023',
            hint = 'T-028 edits existing pages only; page creation is out of scope.';
  end if;

  if p_translations is null or jsonb_typeof(p_translations) <> 'array' then
    raise exception 'p_translations must be a JSON array'
      using errcode = '22023';
  end if;

  update public.site_pages
     set status = p_status,
         published_at = p_published_at
   where id = v_id;

  -- A missing id (or a row RLS hides) is a hard failure, not a silent no-op.
  if not found then
    raise exception 'site page not found'
      using errcode = 'P0002',
            hint = 'No site page row is visible for this id.';
  end if;

  delete from public.site_page_translations
   where page_id = v_id
     and locale not in (
       select (entry ->> 'locale')::public.content_locale
         from jsonb_array_elements(p_translations) as entry
     );

  insert into public.site_page_translations (
    page_id, locale, title, body, meta_description
  )
  select
    v_id,
    (entry ->> 'locale')::public.content_locale,
    entry ->> 'title',
    nullif(btrim(coalesce(entry ->> 'body', '')), ''),
    nullif(btrim(coalesce(entry ->> 'metaDescription', '')), '')
  from jsonb_array_elements(p_translations) as entry
  on conflict (page_id, locale) do update
     set title = excluded.title,
         body = excluded.body,
         meta_description = excluded.meta_description;

  return v_id;
end;
$$;

comment on function public.save_site_page_v1(
  uuid, public.content_status, timestamptz, jsonb
) is
  'T-028: atomic site-page save (existing page + full translation set + lifecycle). SECURITY INVOKER, re-checks is_admin() or pages:write.';

-- ---------------------------------------------------------------------------
-- transition_site_page_v1 — publish / unpublish / archive atomically
-- ---------------------------------------------------------------------------

create or replace function public.transition_site_page_v1(
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
    or public.has_capability('pages:write')
  ) then
    raise exception 'admin role or pages:write capability required'
      using errcode = '42501',
            hint = 'Caller must carry app_metadata.role=admin or pages:write.';
  end if;

  update public.site_pages
     set status = p_status,
         published_at = case
           when p_status = 'published'
             then coalesce(p_published_at, clock_timestamp())
           else null
         end
   where id = p_id;

  if not found then
    raise exception 'site page not found'
      using errcode = 'P0002',
            hint = 'No site page row is visible for this id.';
  end if;
end;
$$;

comment on function public.transition_site_page_v1(
  uuid, public.content_status, timestamptz
) is
  'T-028: atomic site-page lifecycle; publish stamps published_at, draft/archived clear it. SECURITY INVOKER, re-checks is_admin() or pages:write.';

-- ---------------------------------------------------------------------------
-- save_team_member_v1 — root + complete translation set
-- ---------------------------------------------------------------------------
-- p_sort_order NULL on insert asks the function to assign max(sort_order)+1 in
-- the same transaction, so a create cannot pick a position a human did not
-- intend. On update, NULL keeps the current position; reordering is owned by
-- reorder_team_members_v1.
--
-- A team translation has no required text (role/bio are optional). The editor
-- always sends an English row, which is what the public mapper needs to resolve
-- a card.

create or replace function public.save_team_member_v1(
  p_id uuid,
  p_name text,
  p_status public.content_status,
  p_sort_order integer,
  p_portrait_path text,
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
  v_sort_order integer;
begin
  if not (
    public.is_admin()
    or public.has_capability('team:write')
  ) then
    raise exception 'admin role or team:write capability required'
      using errcode = '42501',
            hint = 'Caller must carry app_metadata.role=admin or team:write.';
  end if;

  if p_translations is null or jsonb_typeof(p_translations) <> 'array' then
    raise exception 'p_translations must be a JSON array'
      using errcode = '22023';
  end if;

  if v_id is null then
    v_sort_order := coalesce(
      p_sort_order,
      (select coalesce(max(sort_order), 0) + 1 from public.team_members)
    );

    insert into public.team_members (
      name, status, sort_order, portrait_path, published_at
    )
    values (
      p_name,
      p_status,
      v_sort_order,
      nullif(btrim(coalesce(p_portrait_path, '')), ''),
      p_published_at
    )
    returning id into v_id;
  else
    update public.team_members
       set name = p_name,
           status = p_status,
           sort_order = coalesce(p_sort_order, sort_order),
           portrait_path = nullif(btrim(coalesce(p_portrait_path, '')), ''),
           published_at = p_published_at
     where id = v_id;

    if not found then
      raise exception 'team member not found'
        using errcode = 'P0002',
              hint = 'No team member row is visible for this id.';
    end if;
  end if;

  delete from public.team_member_translations
   where member_id = v_id
     and locale not in (
       select (entry ->> 'locale')::public.content_locale
         from jsonb_array_elements(p_translations) as entry
     );

  insert into public.team_member_translations (
    member_id, locale, role, bio
  )
  select
    v_id,
    (entry ->> 'locale')::public.content_locale,
    nullif(btrim(coalesce(entry ->> 'role', '')), ''),
    nullif(btrim(coalesce(entry ->> 'bio', '')), '')
  from jsonb_array_elements(p_translations) as entry
  on conflict (member_id, locale) do update
     set role = excluded.role,
         bio = excluded.bio;

  return v_id;
end;
$$;

comment on function public.save_team_member_v1(
  uuid, text, public.content_status, integer, text, timestamptz, jsonb
) is
  'T-028: atomic team-member save (root + full translation set + lifecycle). SECURITY INVOKER, re-checks is_admin() or team:write.';

-- ---------------------------------------------------------------------------
-- transition_team_member_v1 — per-member publish toggle
-- ---------------------------------------------------------------------------

create or replace function public.transition_team_member_v1(
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
    or public.has_capability('team:write')
  ) then
    raise exception 'admin role or team:write capability required'
      using errcode = '42501',
            hint = 'Caller must carry app_metadata.role=admin or team:write.';
  end if;

  update public.team_members
     set status = p_status,
         published_at = case
           when p_status = 'published'
             then coalesce(p_published_at, clock_timestamp())
           else null
         end
   where id = p_id;

  if not found then
    raise exception 'team member not found'
      using errcode = 'P0002',
            hint = 'No team member row is visible for this id.';
  end if;
end;
$$;

comment on function public.transition_team_member_v1(
  uuid, public.content_status, timestamptz
) is
  'T-028: per-member lifecycle; publish stamps published_at, draft/archived clear it. SECURITY INVOKER, re-checks is_admin() or team:write.';

-- ---------------------------------------------------------------------------
-- reorder_team_members_v1 — dense 1..n order in one transaction
-- ---------------------------------------------------------------------------
-- p_ids is the complete desired prefix. Every step is one statement:
--   1. validate the array (non-null, no duplicate ids, every id visible);
--   2. assign 1..n to exactly the supplied ids;
--   3. append any unlisted rows after the prefix in their current order, so a
--      partial call can never collide with the supplied prefix.
-- Deferring the unique constraint makes the intermediate state legal; the final
-- state is guaranteed collision-free at commit.

create or replace function public.reorder_team_members_v1(
  p_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_missing uuid;
begin
  if not (
    public.is_admin()
    or public.has_capability('team:write')
  ) then
    raise exception 'admin role or team:write capability required'
      using errcode = '42501',
            hint = 'Caller must carry app_metadata.role=admin or team:write.';
  end if;

  if p_ids is null then
    raise exception 'p_ids must be an array of team member ids'
      using errcode = '22023';
  end if;

  if exists (select 1 from unnest(p_ids) as candidate(id) where id is null) then
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
    into v_missing
    from unnest(p_ids) as candidate(id)
   where not exists (
     select 1 from public.team_members as member where member.id = candidate.id
   )
   limit 1;

  if v_missing is not null then
    raise exception 'team member not found'
      using errcode = 'P0002',
            hint = 'Every supplied id must be a visible team member.';
  end if;

  update public.team_members as member
     set sort_order = desired.position
    from (
      select id, position
        from unnest(p_ids) with ordinality as supplied(id, position)
    ) as desired
   where member.id = desired.id;

  -- Any member not named in the prefix keeps a deterministic place after it.
  update public.team_members as member
     set sort_order = prefix.max_position + ranked.position
    from (
      select id,
             row_number() over (order by sort_order, created_at, id) as position
        from public.team_members
       where id <> all (p_ids)
    ) as ranked,
    (
      select coalesce(max(sort_order), 0) as max_position
        from public.team_members
       where id = any (p_ids)
    ) as prefix
   where member.id = ranked.id;
end;
$$;

comment on function public.reorder_team_members_v1(uuid[]) is
  'T-028: atomic dense 1..n team order; duplicates/unknown ids fail loudly. SECURITY INVOKER, re-checks is_admin() or team:write.';

-- ---------------------------------------------------------------------------
-- Privileges: authenticated API role only (no service-role caller-rights path)
-- ---------------------------------------------------------------------------

revoke all on function public.save_site_page_v1(
  uuid, public.content_status, timestamptz, jsonb
) from public, anon, authenticated, service_role;
revoke all on function public.transition_site_page_v1(
  uuid, public.content_status, timestamptz
) from public, anon, authenticated, service_role;
revoke all on function public.save_team_member_v1(
  uuid, text, public.content_status, integer, text, timestamptz, jsonb
) from public, anon, authenticated, service_role;
revoke all on function public.transition_team_member_v1(
  uuid, public.content_status, timestamptz
) from public, anon, authenticated, service_role;
revoke all on function public.reorder_team_members_v1(uuid[])
  from public, anon, authenticated, service_role;

grant execute on function public.save_site_page_v1(
  uuid, public.content_status, timestamptz, jsonb
) to authenticated;
grant execute on function public.transition_site_page_v1(
  uuid, public.content_status, timestamptz
) to authenticated;
grant execute on function public.save_team_member_v1(
  uuid, text, public.content_status, integer, text, timestamptz, jsonb
) to authenticated;
grant execute on function public.transition_team_member_v1(
  uuid, public.content_status, timestamptz
) to authenticated;
grant execute on function public.reorder_team_members_v1(uuid[])
  to authenticated;

commit;
