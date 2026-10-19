/**
 * Database access for demo seeding and verification.
 *
 * The seed runs as the PostgreSQL superuser through psql inside the running
 * database container, matching `scripts/verify-seed-idempotency.mjs`. That is
 * intentional: the seed is trusted local fixture data and must bypass RLS, but
 * the service-role key still never leaves the host process for database work.
 */

export interface DbReference {
  readonly bucket: "public-media" | "public-documents";
  readonly path: string;
}

const CONTENT_TABLES = [
  "site_pages",
  "site_page_translations",
  "projects",
  "project_translations",
  "team_members",
  "team_member_translations",
  "publications",
  "publication_translations",
  "publication_files",
  "organization_documents",
  "organization_document_translations",
  "calendar_event_links"
] as const;

/** `project_id` in supabase/config.toml drives the deterministic container name. */
export function readProjectId(configText: string): string {
  const match = configText.match(/^\s*project_id\s*=\s*"([^"]+)"/m);
  if (!match) {
    throw new Error("could not read project_id from supabase/config.toml");
  }
  return match[1]!;
}

/** Every public object path referenced by demo content, with its bucket. */
export function buildDbReferenceQuery(): string {
  return `
select 'public-media' as bucket, cover_path as path
  from public.projects
 where cover_path is not null
union all
select 'public-media', portrait_path
  from public.team_members
 where portrait_path is not null
union all
select 'public-documents', storage_path
  from public.publication_files
 where storage_path is not null
union all
select 'public-documents', storage_path
  from public.organization_documents
 where storage_path is not null
order by 1, 2
`.trim();
}

export function parseDbReferenceRows(output: string): DbReference[] {
  return output
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [bucket, path] = line.split("|");
      if (
        (bucket !== "public-media" && bucket !== "public-documents") ||
        !path
      ) {
        throw new Error(`unexpected database reference row: ${line}`);
      }
      return { bucket, path };
    });
}

/** Row counts + featured ranks used by the setup verification. */
export function buildCountQuery(): string {
  return `
select 'projects' as key, count(*)::text as value from public.projects
union all
select 'featured_ranks', coalesce(string_agg(featured_rank::text, ',' order by featured_rank), '')
  from public.projects where featured_rank is not null
union all
select 'published_projects', count(*)::text from public.projects where status = 'published'
union all
select 'home_translations', count(*)::text
  from public.site_page_translations t
  join public.site_pages p on p.id = t.page_id
 where p.page_key = 'home'
union all
select 'about_translations', count(*)::text
  from public.site_page_translations t
  join public.site_pages p on p.id = t.page_id
 where p.page_key = 'about'
union all
select 'publications', count(*)::text from public.publications
union all
select 'publication_files', count(*)::text from public.publication_files
union all
select 'team_members', count(*)::text from public.team_members
union all
select 'organization_documents', count(*)::text from public.organization_documents
union all
select 'calendar_event_links', count(*)::text from public.calendar_event_links
union all
select 'draft_project_translations', count(*)::text
  from public.project_translations
 where project_id = '00000000-0000-4000-8000-000000000202'
order by 1
`.trim();
}

export function parseCountRows(output: string): Map<string, string> {
  const counts = new Map<string, string>();
  for (const line of output.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [key, value] = line.split("|");
    if (!key || value === undefined) {
      throw new Error(`unexpected count row: ${line}`);
    }
    counts.set(key, value);
  }
  return counts;
}

/** Full-row digest of every content table, same shape as the base seed gate. */
export function buildDemoDigestQuery(): string {
  return (
    CONTENT_TABLES.map(
      table =>
        `select '${table}' as table_name, count(*)::text as row_count, ` +
        `coalesce(md5(string_agg(row_to_json(t)::text, ',' order by t.id::text)), '') as digest ` +
        `from public.${table} t`
    ).join("\nunion all\n") + "\norder by 1"
  );
}
