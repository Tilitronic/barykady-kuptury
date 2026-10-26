import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { ADMIN_SCOPES } from "../adminClaim";

/**
 * T-046 gate fix (architector follow-up 4) — the scope-registry drift guardrail.
 *
 * The D-42 vocabulary is expressed in four places that must never drift apart:
 *   1. the SQL helper/policies (`supabase/migrations/*.sql`,
 *      `public.has_capability('<scope>')` call sites),
 *   2. the client parser (`ADMIN_SCOPES` in `adminClaim.ts`),
 *   3. the route table (`meta.requiresCapability` in `router/routes.ts`),
 *   4. the design authority (`docs/architecture.md` §6.1 vocabulary table).
 *
 * This is the one assertion that fails the moment any of those disagree, so a
 * renamed/added/removed scope cannot ship half-wired. The canonical list is
 * hard-coded here on purpose: deriving it from one of the sources would make
 * the guardrail tautological.
 */

/** Canonical 9-scope vocabulary, sorted (see docs/architecture.md §6.1). */
const CANONICAL_VOCABULARY = [
  "documents:write",
  "events:write",
  "importer",
  "media:write",
  "pages:write",
  "projects:write",
  "publications:write",
  "settings:write",
  "team:write"
].sort();

/**
 * Vitest runs with the app directory as cwd (both `pnpm test` and the root
 * delegating script). Walk up until the design authority is found so a moved
 * checkout or a different runner cwd cannot silently disable the guardrail.
 */
function findRepoRoot(start: string): string {
  let current = resolve(start);
  for (let depth = 0; depth < 8; depth += 1) {
    if (existsSync(join(current, "docs", "architecture.md"))) return current;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  throw new Error(`scope drift guard cannot locate repo root from ${start}`);
}

const REPO_ROOT = findRepoRoot(process.cwd());

function readRepoFile(relativePath: string): string {
  const absolute = join(REPO_ROOT, relativePath);
  if (!existsSync(absolute)) {
    // Fail loudly rather than comparing empty sets: a moved repo root must not
    // silently turn the guardrail into a no-op.
    throw new Error(`scope drift guard cannot find ${absolute}`);
  }
  return readFileSync(absolute, "utf8");
}

/** Unique `has_capability('<scope>')` literals across every migration. */
function sqlScopes(): string[] {
  const migrationsDir = join(REPO_ROOT, "supabase", "migrations");
  const sql = readdirSync(migrationsDir)
    .filter(name => name.endsWith(".sql"))
    .map(name => readFileSync(join(migrationsDir, name), "utf8"))
    .join("\n");

  // Strip comments first: the design prose (and migration headers) mentions
  // the template `has_capability('<feature>:write')`, which is not a scope.
  const executableSql = sql
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  const matches = [
    ...executableSql.matchAll(/has_capability\(\s*'([^']+)'\s*\)/g)
  ];
  return [...new Set(matches.map(match => match[1] ?? ""))].sort();
}

/** Unique `requiresCapability: "<scope>"` literals in the route table. */
function routeScopes(): string[] {
  const routes = readRepoFile("apps/web/barykadyKultury/src/router/routes.ts");
  const matches = [...routes.matchAll(/requiresCapability:\s*"([^"]+)"/g)];
  return [...new Set(matches.map(match => match[1] ?? ""))].sort();
}

/** First-column scope names of the §6.1 vocabulary table. */
function documentedScopes(): string[] {
  const architecture = readRepoFile("docs/architecture.md");
  const section = architecture.split("### 6.1")[1]?.split("### 6.2")[0] ?? "";
  const matches = [...section.matchAll(/^\|\s*`([^`]+)`/gm)];
  return [...new Set(matches.map(match => match[1] ?? ""))].sort();
}

describe("scope registry drift guardrail (D-42)", () => {
  it("keeps the 9-scope vocabulary identical across SQL, client, route meta and §6.1", () => {
    const scopesInRoutes = routeScopes();

    expect({
      sql: sqlScopes(),
      client: [...ADMIN_SCOPES].sort(),
      docs: documentedScopes(),
      // Route meta may only use vocabulary members (a new T-028/T-029 route
      // must pick an existing scope, or this fails and forces the registry
      // update in all four places). Non-empty so the check is not vacuous.
      routeScopesUseVocabularyOnly:
        scopesInRoutes.length > 0 &&
        scopesInRoutes.every(scope => CANONICAL_VOCABULARY.includes(scope)),
      canonical: CANONICAL_VOCABULARY
    }).toEqual({
      sql: CANONICAL_VOCABULARY,
      client: CANONICAL_VOCABULARY,
      docs: CANONICAL_VOCABULARY,
      routeScopesUseVocabularyOnly: true,
      canonical: CANONICAL_VOCABULARY
    });
  });
});
