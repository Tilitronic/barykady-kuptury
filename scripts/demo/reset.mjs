#!/usr/bin/env bun
/**
 * `pnpm demo:reset` — deterministic demo re-seed (T-037).
 *
 * `supabase db reset` drops the local database, reapplies every migration and
 * runs `supabase/seed.sql` (the base seed listed in `config.toml`). Then Lane A
 * reapplies `supabase/seed.demo.sql`, regenerates the assets, uploads them and
 * recreates the demo users. Fixed UUIDs make the result identical on every run.
 *
 * The demo seed is deliberately NOT part of `config.toml`'s seed glob, so
 * `db reset` and CI remain hermetic; this script is the explicit opt-in.
 *
 * Design authority: docs/tickets/T-037-demo-environment.md,
 * docs/tickets/HANDOFF-S8-2026-10-19.md §3/§5, docs/TESTING.md §6.
 */
import { join } from "node:path";
import {
  REPO_ROOT,
  assertBun,
  assertLoopbackApiUrl,
  ensureSupabase,
  readStatus,
  run,
  supabase,
  writeEnvLocal
} from "./demo-lib.mjs";

const SETUP_SCRIPT = join(REPO_ROOT, "scripts", "demo", "setup-demo.ts");

function usage() {
  console.log(`Usage: pnpm demo:reset

Drops the local database, reapplies migrations + supabase/seed.sql, then
reapplies the demo dataset, assets and users. Destroys all local database
state — local demo use only.

Options:
  -h, --help   show this help and exit without changing anything
`);
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    usage();
    return;
  }

  assertBun();

  console.log("demo:reset: ensuring the local Supabase stack is running…");
  const runningStatus = ensureSupabase({ start: true });
  assertLoopbackApiUrl(runningStatus.apiUrl);

  console.log(
    "\ndemo:reset: dropping the local database and replaying migrations + base seed…\n"
  );
  supabase(["db", "reset"], { inherit: true, timeout: 600_000 });

  console.log("\ndemo:reset: replaying the demo dataset, assets and users…\n");
  run("bun", [SETUP_SCRIPT], { inherit: true, timeout: 600_000 });

  const status = readStatus();
  if (!status) {
    throw new Error(
      "the local stack stopped responding after the reset. Run `pnpm demo` to restart it."
    );
  }
  writeEnvLocal(status);

  console.log(
    [
      "",
      "✔ demo:reset finished — the deterministic demo state is restored.",
      `  API: ${status.apiUrl}`,
      "  If the dev server is already running, reload the browser; otherwise run `pnpm demo`.",
      "  Demo content is fictional and local-only — never migrate or deploy it.",
      ""
    ].join("\n")
  );
}

main().catch(error => {
  console.error(
    `\n✖ demo:reset: ${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exit(1);
});
