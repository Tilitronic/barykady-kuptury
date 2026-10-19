#!/usr/bin/env bun
/**
 * setup-demo.ts — the single idempotent entrypoint for the local demo dataset.
 *
 * Lane C calls exactly:
 *
 *   bun scripts/demo/setup-demo.ts
 *
 * It is safe to run against an already-running stack and against a stack that
 * was only started with `supabase start` (migrations + base seed already
 * applied). Sequence:
 *
 *   1. read local API URL + service-role key from `supabase status -o env`
 *      (never written to disk, never logged, never a VITE_* value);
 *   2. generate deterministic geometric PNG covers/avatars and small PDFs
 *      under the git-ignored `.demo/assets/`;
 *   3. apply `supabase/seed.demo.sql` as the database superuser via psql inside
 *      the project's database container (same resolution as the base-seed
 *      idempotency gate);
 *   4. upsert every asset through the Storage API;
 *   5. create/update `admin@demo.local` and `viewer@demo.local` through the
 *      Auth admin API;
 *   6. assert the demo row counts and verify every database-referenced public
 *      URL returns 200 with the expected content type.
 *
 * Re-running is a no-op for content tables: the seed uses fixed UUIDs and
 * conditional upserts (see `supabase/seed.demo.sql`). Storage upserts and auth
 * updates are idempotent by construction.
 *
 * Design authority: docs/tickets/T-037-demo-environment.md,
 * docs/tickets/HANDOFF-S8-2026-10-19.md §3/§5/§9, docs/architecture.md §6,
 * docs/TESTING.md §6, docs/tickets/DECISIONS.md D-17.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { writeDemoAssets, type GeneratedAsset } from "./assets";
import {
  buildCountQuery,
  buildDbReferenceQuery,
  parseCountRows,
  parseDbReferenceRows,
  readProjectId
} from "./db";
import { buildAssetManifest, type DemoAsset } from "./manifest";
import { uploadAsset, verifyPublicObject } from "./storage";
import {
  parseStatusEnv,
  selectLocalStatus,
  type LocalSupabaseStatus
} from "./supabaseStatus";
import { DEMO_PASSWORD, ensureDemoUsers } from "./users";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const APP_DIR = join(REPO_ROOT, "apps/web/barykadyKultury");
const ASSETS_ROOT = join(REPO_ROOT, ".demo", "assets");
const SEED_PATH = join(REPO_ROOT, "supabase", "seed.demo.sql");
const CONFIG_PATH = join(REPO_ROOT, "supabase", "config.toml");

function run(
  command: string,
  args: readonly string[],
  options: { readonly input?: string; readonly inherit?: boolean } = {}
) {
  const result = spawnSync(command, [...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    input: options.input,
    stdio: options.inherit ? "inherit" : ["pipe", "pipe", "pipe"]
  });

  if (result.error) {
    throw new Error(`could not run ${command}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const details = (result.stderr || result.stdout || "")
      .trim()
      .split("\n")
      .slice(-12)
      .join("\n");
    throw new Error(
      `${command} ${args.join(" ")} failed (exit ${result.status})${details ? `\n${details}` : ""}`
    );
  }

  return result;
}

function readStatus(): LocalSupabaseStatus {
  const result = spawnSync(
    "pnpm",
    ["--dir", APP_DIR, "exec", "supabase", "status", "-o", "env"],
    { cwd: REPO_ROOT, encoding: "utf8" }
  );

  if (result.error) {
    throw new Error(`could not run the Supabase CLI: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(
      `\`supabase status\` failed. Is Docker running?\n${(result.stderr || "").trim()}`
    );
  }

  return selectLocalStatus(parseStatusEnv(result.stdout));
}

/** Starts the local stack if it is not already up; `supabase start` is idempotent. */
function ensureStack(): LocalSupabaseStatus {
  try {
    return readStatus();
  } catch {
    console.log(
      "setup-demo: local Supabase stack is not running — starting it…"
    );
    run("pnpm", ["--dir", APP_DIR, "exec", "supabase", "start"], {
      inherit: true
    });
    return readStatus();
  }
}

/** The database container for THIS project, resolved from config project_id. */
function findDatabaseContainer(): string {
  if (!existsSync(CONFIG_PATH)) {
    throw new Error(`supabase config not found at ${CONFIG_PATH}`);
  }

  const projectId = readProjectId(readFileSync(CONFIG_PATH, "utf8"));
  const expected = `supabase_db_${projectId}`;
  const result = run("docker", [
    "ps",
    "--filter",
    `name=^${expected}$`,
    "--format",
    "{{.Names}}"
  ]);
  const found = result.stdout
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)[0];

  if (found !== expected) {
    throw new Error(
      `expected database container ${expected} (from project_id "${projectId}") but it is not running`
    );
  }

  return expected;
}

function query(container: string, sql: string): string {
  const result = run("docker", [
    "exec",
    "-i",
    container,
    "psql",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
    "-qAt",
    "-c",
    sql
  ]);
  return result.stdout.trim();
}

function applySql(container: string, sql: string): void {
  run(
    "docker",
    [
      "exec",
      "-i",
      container,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-qAt",
      "-f",
      "-"
    ],
    { input: sql }
  );
}

function applyDemoSeed(container: string): void {
  if (!existsSync(SEED_PATH)) {
    throw new Error(`demo seed not found at ${SEED_PATH}`);
  }
  applySql(container, readFileSync(SEED_PATH, "utf8"));
}

async function uploadAssets(
  status: LocalSupabaseStatus,
  generated: readonly GeneratedAsset[]
): Promise<void> {
  for (const item of generated) {
    await uploadAsset(status, item.asset, item.buffer);
  }
}

function verifyCounts(container: string): Map<string, string> {
  const counts = parseCountRows(query(container, buildCountQuery()));
  const expected: Record<string, string> = {
    projects: "8",
    featured_ranks: "1,2,5",
    published_projects: "6",
    home_translations: "3",
    about_translations: "3",
    publications: "6",
    publication_files: "7",
    team_members: "5",
    organization_documents: "3",
    calendar_event_links: "3",
    draft_project_translations: "1"
  };

  const failures = Object.entries(expected)
    .filter(([key, value]) => counts.get(key) !== value)
    .map(
      ([key, value]) =>
        `  ${key}: expected ${value}, got ${counts.get(key) ?? "<missing>"}`
    );

  if (failures.length > 0) {
    throw new Error(
      `demo dataset verification failed:\n${failures.join("\n")}`
    );
  }

  return counts;
}

/**
 * Cross-checks the TypeScript manifest against the paths actually referenced
 * by the database, then verifies each public URL anonymously.
 *
 * Drift between `manifest.ts` and `seed.demo.sql` is a hard failure here, so a
 * missing upload cannot hide behind an unexercised UI route.
 */
async function verifyReferences(
  status: LocalSupabaseStatus,
  container: string,
  manifest: readonly DemoAsset[]
): Promise<number> {
  const references = parseDbReferenceRows(
    query(container, buildDbReferenceQuery())
  );
  const expected = new Set(
    manifest.map(asset => `${asset.bucket}|${asset.path}`)
  );
  const actual = new Set(
    references.map(reference => `${reference.bucket}|${reference.path}`)
  );

  const missing = [...expected].filter(key => !actual.has(key));
  const extra = [...actual].filter(key => !expected.has(key));
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `manifest/database asset drift:\n` +
        (missing.length ? `  missing from DB: ${missing.join(", ")}\n` : "") +
        (extra.length ? `  extra in DB: ${extra.join(", ")}` : "")
    );
  }

  for (const reference of references) {
    await verifyPublicObject(status, reference.bucket, reference.path);
  }

  return references.length;
}

function printSummary(
  status: LocalSupabaseStatus,
  generated: readonly GeneratedAsset[],
  counts: Map<string, string>,
  verifiedUrls: number,
  users: readonly {
    email: string;
    label: string;
    action: string;
    role: string | null;
  }[]
): void {
  const featured = counts.get("featured_ranks") ?? "";
  console.log(
    `
✔ demo environment ready
  API: ${status.apiUrl}
  Assets: ${generated.length} generated/uploaded; ${verifiedUrls} public URLs verified (200)
  Content: ${counts.get("projects")} projects (featured ranks ${featured}), ` +
      `${counts.get("publications")} publications / ${counts.get("publication_files")} files, ` +
      `${counts.get("team_members")} team members, ${counts.get("organization_documents")} documents, ` +
      `${counts.get("calendar_event_links")} calendar links
  Demo users (LOCAL ONLY):
${users.map(user => `    ${user.email} — ${user.role ? `app_metadata.role = "${user.role}"` : "no admin claim"} (${user.action})`).join("\n")}
    Password: ${DEMO_PASSWORD}
  Note: these credentials and all demo content must never be deployed or migrated.
`
  );
}

/**
 * Demo tooling may only touch a loopback Supabase stack.
 *
 * The demo seed, demo users and generated assets must never reach a hosted
 * project. Refusing a non-local API URL is a cheap, fail-closed guard against
 * a misconfigured `supabase status` / stray environment. It is not a
 * substitute for the deployment warnings, but it makes accidental promotion
 * require a deliberate code change.
 */
function assertLocalStack(status: LocalSupabaseStatus): void {
  const host = new URL(status.apiUrl).hostname;
  if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(host)) {
    throw new Error(
      `refusing to run the demo setup against a non-local Supabase API ` +
        `(${status.apiUrl}). Demo data and demo users are local-only.`
    );
  }
}

async function main(): Promise<void> {
  const status = ensureStack();
  assertLocalStack(status);

  const manifest = buildAssetManifest();
  console.log(
    `setup-demo: generating ${manifest.length} deterministic assets under .demo/assets/…`
  );
  const generated = writeDemoAssets(ASSETS_ROOT, manifest);

  const container = findDatabaseContainer();
  console.log(
    `setup-demo: applying supabase/seed.demo.sql through ${container}…`
  );
  applyDemoSeed(container);

  console.log(
    `setup-demo: uploading ${generated.length} assets to local Storage…`
  );
  await uploadAssets(status, generated);

  console.log("setup-demo: creating/updating demo auth users…");
  const users = await ensureDemoUsers(status);

  const counts = verifyCounts(container);
  const verifiedUrls = await verifyReferences(status, container, manifest);

  printSummary(status, generated, counts, verifiedUrls, users);
}

main().catch(error => {
  console.error(
    `\n✖ setup-demo: ${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exit(1);
});
