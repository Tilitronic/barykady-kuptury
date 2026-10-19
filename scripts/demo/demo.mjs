#!/usr/bin/env bun
/**
 * `pnpm demo` — boot a fully populated local site with one command (T-037).
 *
 * Sequence (each step is safe to re-run):
 *   1. assert Bun, Docker and the project-pinned Supabase CLI;
 *   2. start the local Supabase stack if it is stopped;
 *   3. apply pending migrations and the base seed (`supabase/seed.sql`);
 *   4. run Lane A's `setup-demo.ts` (demo seed, generated assets, Storage,
 *      demo users);
 *   5. write `.env.local` with browser-safe `VITE_*` values only;
 *   6. start the Bun calendar mock and the Quasar dev server as detached
 *      processes with PID files under `.demo/pids/`.
 *
 * The dev server is started only after `.env.local` exists, because Vite reads
 * the environment at startup. Both background processes are reused when they
 * are already healthy, so `pnpm demo` is idempotent.
 *
 * Design authority: docs/tickets/T-037-demo-environment.md,
 * docs/tickets/HANDOFF-S8-2026-10-19.md §3/§5/§8,
 * docs/architecture.md §3/§6, docs/TESTING.md §6.
 */
import { join } from "node:path";
import {
  APP_DIR,
  CALENDAR_PATH,
  DEMO_PASSWORD,
  DEMO_USERS,
  DEV_HOST,
  DEV_MARKER,
  REPO_ROOT,
  appReady,
  assertBun,
  canConnect,
  devBaseUrl,
  devPort,
  ensureSupabase,
  isProcessAlive,
  MOCK_MARKER,
  mockBaseUrl,
  mockPort,
  mockReady,
  pidMatches,
  portInUseMessage,
  prepareDatabase,
  readPid,
  removePid,
  run,
  startDetached,
  stopPidFile,
  tailLog,
  waitFor,
  writeEnvLocal
} from "./demo-lib.mjs";

const SETUP_SCRIPT = join(REPO_ROOT, "scripts", "demo", "setup-demo.ts");

function usage() {
  console.log(`Usage: pnpm demo

Starts the local Supabase stack, seeds demo data, writes .env.local and runs:
  - the Bun calendar mock on port ${mockPort()} (CALENDAR_MOCK_PORT)
  - the Quasar dev server on port ${devPort()} (DEMO_DEV_PORT)

Options:
  -h, --help   show this help and exit without changing anything

Stop everything with: pnpm demo:stop
Smoke-test a running environment with: pnpm demo:check
`);
}

/**
 * Starts (or reuses) the calendar mock. A healthy server without a PID file is
 * treated as a standalone `pnpm demo:calendar` and reused; a port held by an
 * unhealthy process is a hard error so the proxy cannot silently point at
 * nothing.
 */
async function ensureMock() {
  const port = mockPort();
  const pid = readPid("calendar-mock");

  if (pid && isProcessAlive(pid) && pidMatches(pid, MOCK_MARKER, REPO_ROOT)) {
    const ready = await mockReady(port);
    if (ready.ok) {
      console.log(`demo: calendar mock already running (PID ${pid}, port ${port})`);
      return { pid, port, reused: true };
    }

    console.log(
      "demo: calendar mock PID is alive but not answering on the configured port — restarting it…"
    );
    await stopPidFile("calendar-mock", MOCK_MARKER, { cwd: REPO_ROOT });
  } else if (pid) {
    removePid("calendar-mock");
  }

  const already = await mockReady(port);
  if (already.ok) {
    console.log(
      `demo: a calendar mock is already answering on port ${port}; reusing it ` +
        "(it is not tracked by `pnpm demo:stop`)."
    );
    return { pid: null, port, reused: true };
  }

  if (await canConnect(port)) {
    throw new Error(
      portInUseMessage("calendar mock", port, "CALENDAR_MOCK_PORT")
    );
  }
  console.log(`demo: starting the calendar mock on port ${port}…`);
  const child = startDetached(
    "calendar-mock",
    "bun",
    [join(REPO_ROOT, "mock", "calendar", "server.ts")],
    { env: { CALENDAR_MOCK_PORT: String(port) } }
  );

  try {
    await waitFor("calendar mock", async () => (await mockReady(port)).ok, {
      timeoutMs: 20_000,
      intervalMs: 300
    });
  } catch (error) {
    await stopPidFile("calendar-mock", MOCK_MARKER, { cwd: REPO_ROOT });
    throw new Error(
      `${error.message}\n--- .demo/logs/calendar-mock.log ---\n${tailLog(
        "calendar-mock"
      )}`
    );
  }

  return { pid: child.pid, port, reused: false };
}

/**
 * Starts (or reuses) the Quasar dev server. The dev server is intentionally
 * not reused when a foreign process owns the port: a server started before
 * `.env.local` was written would keep stale Supabase credentials.
 */
async function ensureDev() {
  const port = devPort();
  const base = devBaseUrl(port);
  const pid = readPid("dev");

  if (pid && isProcessAlive(pid) && pidMatches(pid, DEV_MARKER, REPO_ROOT)) {
    if (await appReady(base)) {
      console.log(`demo: Quasar dev server already running (PID ${pid}, ${base})`);
      return { pid, port, reused: true };
    }

    console.log(
      "demo: dev server PID is alive but /en is not responding — restarting it…"
    );
    await stopPidFile("dev", DEV_MARKER, { cwd: REPO_ROOT });
  } else if (pid) {
    removePid("dev");
  }

  if (await canConnect(port)) {
    throw new Error(portInUseMessage("Quasar dev server", port, "DEMO_DEV_PORT"));
  }

  console.log(`demo: starting the Quasar dev server on ${base}…`);
  const child = startDetached(
    "dev",
    "pnpm",
    [
      "--dir",
      APP_DIR,
      "exec",
      "quasar",
      "dev",
      "-p",
      String(port),
      "-H",
      DEV_HOST,
      "--no-color"
    ],
    { env: { CALENDAR_MOCK_PORT: String(mockPort()) } }
  );

  try {
    await waitFor("Quasar dev server", () => appReady(base), {
      timeoutMs: 180_000,
      intervalMs: 1_000
    });
  } catch (error) {
    await stopPidFile("dev", DEV_MARKER, { cwd: REPO_ROOT });
    throw new Error(
      `${error.message}\n--- .demo/logs/dev.log ---\n${tailLog("dev", 30)}`
    );
  }

  return { pid: child.pid, port, reused: false };
}

function printReady(status, mock, dev) {
  const lines = [
    "",
    "✔ demo environment is running",
    `  App:       ${devBaseUrl(dev.port)}/en  (also /pl, /uk)`,
    `  Supabase:  ${status.apiUrl}`,
    `  Studio:    http://127.0.0.1:54323`,
    `  Mailpit:   http://127.0.0.1:54324`,
    `  Calendar:  ${mockBaseUrl(mock.port)}${CALENDAR_PATH}`,
    `  Scenarios: ?scenario=default|empty|unavailable|dense|long|dst`,
    `  Logs:      .demo/logs/  (dev.log, calendar-mock.log)`,
    `  Demo users: ${DEMO_USERS.join(", ")}`,
    `  Password:  ${DEMO_PASSWORD}`,
    `  Stop with: pnpm demo:stop`,
    "",
    "  Demo content is fictional and local-only — never migrate or deploy it.",
    ""
  ];

  console.log(lines.join("\n"));
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    usage();
    return;
  }

  assertBun();

  console.log("demo: preparing the local environment…\n");

  const status = ensureSupabase({ start: true });
  prepareDatabase();

  console.log("\ndemo: applying the demo dataset, assets and users (idempotent)…\n");
  run("bun", [SETUP_SCRIPT], { inherit: true, timeout: 600_000 });

  writeEnvLocal(status);
  console.log("demo: wrote apps/web/barykadyKultury/.env.local (VITE_* only)\n");

  const mock = await ensureMock();
  const dev = await ensureDev();

  // A final probe makes the command truthful even if a reused server is
  // degraded between the readiness check and this summary.
  if (!(await appReady(devBaseUrl(dev.port)))) {
    throw new Error(
      `the dev server at ${devBaseUrl(dev.port)} stopped responding; see .demo/logs/dev.log`
    );
  }
  if (!(await mockReady(mock.port)).ok) {
    throw new Error(
      `the calendar mock at ${mockBaseUrl(mock.port)} stopped responding; see .demo/logs/calendar-mock.log`
    );
  }

  printReady(status, mock, dev);
}

main().catch(error => {
  console.error(
    `\n✖ demo: ${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exit(1);
});
