-- T-046 — the capability helper for D-42 (capability-scoped administration).
--
-- Design authority:
--   * docs/architecture.md §6.1 — `app_metadata.role='admin'` stays the root
--     claim (D-17); `app_metadata.scopes` is the server-controlled scope array;
--     `public.is_admin()` remains unchanged and is the root bypass. This file
--     adds the SINGLE second enforcement point, `public.has_capability(text)`.
--   * docs/architecture.md §6 — authorization lives in PostgreSQL; grants are
--     server-side only; unknown/invalid claim data must fail closed.
--   * docs/tickets/DECISIONS.md D-21 — deny-by-default. A missing, malformed or
--     empty scopes value grants nothing.
--   * ana002-admin-access-model-report.md §7 ADR-B — fixed V1 vocabulary:
--     pages:write, projects:write, publications:write, documents:write,
--     team:write, events:write, media:write, importer.
--
-- Why SECURITY INVOKER and a pinned empty search_path:
--   The function only reads the request.jwt.claims GUC, never a table, so
--   invoker rights are sufficient and avoid adding definer privilege. The empty
--   search_path plus pg_catalog qualification means a caller-controlled path
--   cannot redirect the JSON functions it calls. This mirrors is_admin().
--
-- Why the scopes key is read only from app_metadata:
--   app_metadata is writable only by the service role / Admin API. user_metadata
--   is user-editable and is deliberately never consulted: a self-granted scope
--   must not look like authorization. The array type is also checked, so a
--   string (e.g. "projects:write") fails closed rather than being treated as a
--   list of characters or a scalar grant.

begin;

create or replace function public.has_capability(p_scope text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(
    case
      when nullif(p_scope, '') is null then false
      when pg_catalog.jsonb_typeof(
        claims.value -> 'app_metadata' -> 'scopes'
      ) = 'array' then exists (
        select 1
          from pg_catalog.jsonb_array_elements_text(
            claims.value -> 'app_metadata' -> 'scopes'
          ) as scope(value)
         where scope.value = p_scope
      )
      else false
    end,
    false
  )
  from (
    select nullif(
      pg_catalog.current_setting('request.jwt.claims', true), ''
    )::jsonb as value
  ) as claims;
$$;

comment on function public.has_capability(text) is
  'T-046/D-42: true only when the verified JWT''s app_metadata.scopes is an '
  'array containing the exact requested scope. user_metadata is never read; '
  'missing/malformed/empty scopes fail closed. This is the single second '
  'enforcement point beside is_admin(). SECURITY INVOKER, search_path pinned.';

-- Policy expressions run with the caller's privileges. Grant the same API
-- roles that may read/write scoped content; service_role keeps its explicit
-- execute grant for server-side maintenance (it bypasses RLS by design).
revoke all on function public.has_capability(text) from public;
grant execute on function public.has_capability(text)
  to anon, authenticated, service_role;

commit;
