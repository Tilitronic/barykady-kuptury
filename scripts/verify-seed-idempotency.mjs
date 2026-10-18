#!/usr/bin/env node
/**
 * verify-seed-idempotency.mjs — prove that `supabase/seed.sql` is idempotent (T-012).
 *
 * WHY THIS IS A HOST SCRIPT AND NOT A pgTAP TEST
 * ----------------------------------------------
 * The T-012 acceptance criterion is "`supabase db reset` succeeds from scratch and
 * applies seed idempotently". The only rigorous proof of idempotency is to apply the
 * real seed file a second time and observe that the database is unchanged.
 *
 * `supabase test db` cannot carry that proof: it hands each test file to psql running
 * inside the `pg_prove` container, and that container mounts **only** `supabase/tests`
 * (verified by probing the container: `ls supabase` there returns just `tests`). The
 * seed at `supabase/seed.sql` — which architecture.md §2 fixes at that path — is
 * therefore unreachable from a pgTAP test (`\i ../seed.sql` fails with "No such file
 * or directory"). Rather than relocate the seed, duplicate it, or weaken the check,
 * this gate runs on the host and drives psql inside the running database container.
 *
 * WHAT IT DOES
 * ------------
 *  1. Asserts the local stack is up and the database is already seeded (guards against
 *     a vacuous pass on an empty database).
 *  2. Digests every content table (row count + a hash of the ordered primary keys).
 *  3. Applies `supabase/seed.sql` a second time through psql (stdin, so no mount or
 *     host psql is required).
 *  4. Re-digests and requires the two digests to be identical.
 *
 * USAGE
 * -----
 *   pnpm dlx supabase@2.121.0 db reset     # application #1 (migration + seed)
 *   node scripts/verify-seed-idempotency.mjs   # application #2 must be a no-op
 *
 * Requires Docker and a running local Supabase stack. Exits non-zero on any failure;
 * a green run is never reported when the prerequisites are missing.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SEED_PATH = join(REPO_ROOT, 'supabase', 'seed.sql');

/** Every content table defined by the T-012 migration. All carry an `id` PK. */
const CONTENT_TABLES = [
  'site_pages',
  'site_page_translations',
  'projects',
  'project_translations',
  'team_members',
  'team_member_translations',
  'publications',
  'publication_translations',
  'publication_files',
  'organization_documents',
  'organization_document_translations',
  'calendar_event_links',
];

/** Tables that the seed must populate; a zero row count here means the gate is vacuous. */
const SEED_MUST_POPULATE = [
  'site_pages',
  'projects',
  'project_translations',
  'publications',
  'publication_files',
  'calendar_event_links',
];

function fail(message) {
  console.error(`\n✖ seed-idempotency: ${message}\n`);
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  if (result.error) {
    fail(`could not run \`${command}\`: ${result.error.message}`);
  }
  return result;
}

/** The database container created by `supabase start` for this project. */
function findDatabaseContainer() {
  const result = run('docker', [
    'ps',
    '--filter',
    'name=supabase_db',
    '--format',
    '{{.Names}}',
  ]);
  if (result.status !== 0) {
    fail('`docker ps` failed — is Docker running?');
  }
  const name = result.stdout.split('\n').map((line) => line.trim()).filter(Boolean)[0];
  if (!name) {
    fail(
      'no local Supabase database container found.\n' +
        '  Start the stack first:  pnpm dlx supabase@2.121.0 start',
    );
  }
  return name;
}

/** Run SQL via psql inside the database container and return trimmed stdout. */
function psql(container, sql, { input } = {}) {
  const args = [
    'exec',
    '-i',
    container,
    'psql',
    '-U',
    'postgres',
    '-d',
    'postgres',
    '-v',
    'ON_ERROR_STOP=1',
    '-qAt',
  ];
  if (input === undefined) {
    args.push('-c', sql);
  } else {
    args.push('-f', '-');
  }
  const result = run('docker', args, input === undefined ? {} : { input });
  if (result.status !== 0) {
    fail(
      `psql failed (exit ${result.status}${result.status === null ? ', signal ' + result.signal : ''}).\n` +
        (result.stderr || '').trim(),
    );
  }
  return result.stdout.trim();
}

/**
 * One row per content table: `name|row_count|digest`, where digest is an md5 over the
 * ordered primary keys. Any inserted, deleted or re-keyed row changes the digest.
 */
function digestQuery() {
  return (
    CONTENT_TABLES.map(
      (table) =>
        `select '${table}' as table_name, count(*)::text as row_count, ` +
        `coalesce(md5(string_agg(id::text, ',' order by id::text)), '') as digest ` +
        `from public.${table}`,
    ).join('\nunion all\n') + '\norder by 1'
  );
}

function digest(container) {
  const output = psql(container, digestQuery());
  const map = new Map();
  for (const line of output.split('\n')) {
    if (!line.trim()) continue;
    const [table, rowCount, hash] = line.split('|');
    map.set(table, { rowCount: Number(rowCount), hash });
  }
  return map;
}

function main() {
  if (!existsSync(SEED_PATH)) {
    fail(`seed file not found at ${SEED_PATH}`);
  }
  const seedSql = readFileSync(SEED_PATH, 'utf8');
  const container = findDatabaseContainer();
  console.log(`seed-idempotency: database container ${container}`);

  // 1. Guard: the database must already hold the seed, or the comparison is vacuous.
  const before = digest(container);
  for (const table of SEED_MUST_POPULATE) {
    const entry = before.get(table);
    if (!entry) fail(`table public.${table} is missing from the schema`);
    if (entry.rowCount === 0) {
      fail(
        `public.${table} is empty — run \`supabase db reset\` first so the seed has been applied once`,
      );
    }
  }

  // 2. Second application of the real seed file.
  console.log('seed-idempotency: applying supabase/seed.sql a second time…');
  psql(container, null, { input: seedSql });

  // 3. The database must be byte-for-byte unchanged.
  const after = digest(container);
  const diffs = [];
  for (const table of CONTENT_TABLES) {
    const a = before.get(table);
    const b = after.get(table);
    if (!a || !b || a.rowCount !== b.rowCount || a.hash !== b.hash) {
      diffs.push(
        `  ${table}: before {count=${a?.rowCount ?? '?'}, hash=${a?.hash || '∅'}} ` +
          `after {count=${b?.rowCount ?? '?'}, hash=${b?.hash || '∅'}}`,
      );
    }
  }

  const total = [...after.values()].reduce((sum, entry) => sum + entry.rowCount, 0);
  if (diffs.length > 0) {
    fail(`the seed is NOT idempotent — a second application changed data:\n${diffs.join('\n')}`);
  }

  console.log(
    `✔ seed-idempotency: PASS — re-applying supabase/seed.sql changed nothing ` +
      `(${CONTENT_TABLES.length} tables, ${total} rows verified)`,
  );
}

main();
