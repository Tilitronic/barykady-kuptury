#!/usr/bin/env bun
/**
 * `pnpm demo:stop` — stop the demo processes and the local Supabase stack.
 *
 * Safe by construction:
 * - missing PID files, dead PIDs and foreign PIDs (checked against `/proc`)
 *   are removed without killing an unrelated process;
 * - `supabase stop` runs only when `supabase status` reports a running stack, so
 *   calling this twice is not an error.
 *
 * `--dry-run` prints what would be stopped and changes nothing. It exists so a
 * busy workstation (e.g. another lane using the local stack) can inspect the
 * shutdown plan without disrupting it.
 *
 * Design authority: docs/tickets/T-037-demo-environment.md,
 * docs/tickets/HANDOFF-S8-2026-10-19.md §8.
 */
import {
  REPO_ROOT,
  MOCK_MARKER,
  DEV_MARKER,
  assertSupabaseCli,
  readStatus,
  stopPidFile,
  supabase
} from "./demo-lib.mjs";

function usage() {
  console.log(`Usage: pnpm demo:stop [--dry-run]

Stops the demo calendar mock and Quasar dev server (tracked in
.demo/pids/), then stops the local Supabase stack.

Options:
  --dry-run    show what would be stopped; change nothing
  -h, --help   show this help
`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    usage();
    return;
  }
  const dryRun = args.includes("--dry-run");

  console.log(`demo:stop: ${dryRun ? "inspecting" : "stopping"} demo processes…`);

  const mockStopped = await stopPidFile("calendar-mock", MOCK_MARKER, {
    dryRun,
    cwd: REPO_ROOT
  });
  const devStopped = await stopPidFile("dev", DEV_MARKER, { dryRun, cwd: REPO_ROOT });

  // A missing CLI must not make `demo:stop` fail when nothing demo-related is
  // running; report it as a note instead.
  try {
    assertSupabaseCli();
  } catch (error) {
    console.log(
      `  Supabase: skipped (${error instanceof Error ? error.message : String(error)})`
    );
    console.log(dryRun ? "\n(dry run: nothing changed)" : "\n✔ demo stopped");
    return;
  }

  const status = readStatus();
  if (!status) {
    console.log("  Supabase: already stopped");
  } else if (dryRun) {
    console.log(`  Supabase: would stop the stack at ${status.apiUrl}`);
  } else {
    console.log("  Supabase: stopping the local stack…");
    supabase(["stop"], { inherit: true, timeout: 300_000 });
    console.log("  Supabase: stopped");
  }

  if (dryRun) {
    console.log(
      `\n(dry run: nothing changed${mockStopped || devStopped ? "; processes above would be stopped" : ""})`
    );
  } else {
    console.log("\n✔ demo stopped");
  }
}

main().catch(error => {
  console.error(
    `\n✖ demo:stop: ${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exit(1);
});
