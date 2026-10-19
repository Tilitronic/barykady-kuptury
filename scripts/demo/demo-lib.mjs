/**
 * Shared helpers for the one-command demo workflow (T-037, Lane C).
 *
 * WHY THIS IS A SEPARATE MODULE
 * -----------------------------
 * `demo`, `reset`, `stop` and `check` must agree on paths, ports, the Supabase
 * CLI invocation and process lifecycle. Copying that logic into four scripts
 * would let them drift — e.g. `demo` writes a PID that `stop` cannot find.
 *
 * DESIGN CONSTRAINTS
 * ------------------
 * - No new dependencies: Node built-ins only. Bun runs these scripts, but the
 *   process/port/HTTP helpers are plain Node APIs so they behave in WSL and on
 *   Linux CI (docs/tickets/T-037-demo-environment.md "One-command workflow").
 * - The service-role key is never read here. `readStatus` exposes only the API
 *   URL and the browser-safe publishable key; `setup-demo.ts` owns the trusted
 *   server key in its own process (docs/architecture.md §6).
 * - Demo data is local-only and the seed is never referenced by `pnpm build`
 *   (docs/TICKETS/T-037, HANDOFF-S8 §4).
 * - Background processes are detached into their own process group so a single
 *   PID file can stop the dev server and all of its children without leaving an
 *   orphan on port 9000.
 */
import { spawn, spawnSync } from "node:child_process";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readlinkSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { connect } from "node:net";
import { dirname, join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const APP_DIR = join(REPO_ROOT, "apps/web/barykadyKultury");
export const DEMO_DIR = join(REPO_ROOT, ".demo");
export const PID_DIR = join(DEMO_DIR, "pids");
export const LOG_DIR = join(DEMO_DIR, "logs");
export const ENV_LOCAL_PATH = join(APP_DIR, ".env.local");
export const SEED_PATH = join(REPO_ROOT, "supabase", "seed.sql");
export const CONFIG_PATH = join(REPO_ROOT, "supabase", "config.toml");

export const DEV_HOST = "127.0.0.1";
export const DEFAULT_DEV_PORT = 9000;
export const DEFAULT_MOCK_PORT = 8787;
export const CALENDAR_PATH = "/.netlify/functions/calendar-events";

export const DEMO_PASSWORD = "demo-local-2026";
export const DEMO_USERS = ["admin@demo.local", "viewer@demo.local"];

/** Marker strings used to reject a stale/reused PID before killing it. */
export const MOCK_MARKER = "mock/calendar/server.ts";
export const DEV_MARKER = "quasar";

function readPort(value, fallback) {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535
    ? parsed
    : fallback;
}

export function devPort() {
  return readPort(process.env.DEMO_DEV_PORT, DEFAULT_DEV_PORT);
}

export function mockPort() {
  return readPort(process.env.CALENDAR_MOCK_PORT, DEFAULT_MOCK_PORT);
}

export function devBaseUrl(port = devPort()) {
  return `http://${DEV_HOST}:${port}`;
}

/**
 * The base URL `demo:check` probes. `DEMO_BASE_URL` exists so a second dev
 * server (or a remote tunnel) can be smoke-tested without changing scripts.
 */
export function checkBaseUrl() {
  const explicit = process.env.DEMO_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  return devBaseUrl();
}

export function mockBaseUrl(port = mockPort()) {
  return `http://${DEV_HOST}:${port}`;
}

export function ensureRuntimeDirs() {
  mkdirSync(PID_DIR, { recursive: true });
  mkdirSync(LOG_DIR, { recursive: true });
}

function tail(text, lines) {
  const rows = text.replace(/\r\n/g, "\n").split("\n");
  return rows.slice(-lines).join("\n").trim();
}

/**
 * Runs a command synchronously and captures output unless `inherit` is set.
 * `allowFailure` is used only for probes (Docker, status, version checks) so a
 * missing prerequisite can produce one actionable message instead of a stack.
 */
export function run(command, args, options = {}) {
  const {
    cwd = REPO_ROOT,
    env,
    inherit = false,
    allowFailure = false,
    timeout = 120_000,
    input
  } = options;

  const result = spawnSync(command, args, {
    cwd,
    env: env ? { ...process.env, ...env } : process.env,
    encoding: "utf8",
    input,
    timeout,
    stdio: inherit ? "inherit" : ["pipe", "pipe", "pipe"]
  });

  if (result.error) {
    if (allowFailure) {
      return {
        status: null,
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? "",
        error: result.error
      };
    }
    throw new Error(
      `could not run \`${command} ${args.join(" ")}\`: ${result.error.message}`
    );
  }

  if (result.status !== 0 && !allowFailure) {
    const details = tail(`${result.stderr || ""}\n${result.stdout || ""}`, 14);
    throw new Error(
      `\`${command} ${args.join(" ")}\` failed (exit ${result.status})` +
        (details ? `\n${details}` : "")
    );
  }

  return result;
}

/**
 * Invokes the project-pinned Supabase CLI from the repository root.
 * `--workdir` is explicit so the command is independent of the caller's cwd
 * (the CLI otherwise searches upward from the app directory).
 */
export function supabase(args, options = {}) {
  return run(
    "pnpm",
    ["--dir", APP_DIR, "exec", "supabase", "--workdir", REPO_ROOT, ...args],
    options
  );
}

export function assertBun() {
  if (typeof Bun === "undefined") {
    throw new Error(
      "this workflow is Bun-based. Install Bun (https://bun.sh) and re-run."
    );
  }
}

export function assertDocker() {
  const result = run("docker", ["info", "--format", "{{.ServerVersion}}"], {
    allowFailure: true,
    timeout: 15_000
  });
  if (result.status !== 0) {
    throw new Error(
      "Docker is not reachable. Start Docker Desktop and enable WSL integration, " +
        "then re-run `pnpm demo` (docs/DEMO_ENVIRONMENT.md#troubleshooting)."
    );
  }
}

export function assertSupabaseCli() {
  const result = run(
    "pnpm",
    ["--dir", APP_DIR, "exec", "supabase", "--version"],
    { allowFailure: true, timeout: 60_000 }
  );
  if (result.status !== 0) {
    throw new Error(
      "the Supabase CLI is not available. Install app dependencies with " +
        "`pnpm --dir apps/web/barykadyKultury install` and re-run."
    );
  }
}

/** Parses `supabase status -o env`; ignores warnings and unrelated lines. */
export function parseStatusEnv(output) {
  const parsed = {};

  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    const trimmed = rawValue.trim();
    const quoted =
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"));
    parsed[key] = quoted ? trimmed.slice(1, -1) : trimmed;
  }

  return parsed;
}

/**
 * Reads the running stack. Returns `null` when the stack is stopped (or the
 * CLI cannot answer) so callers can print their own recovery instructions.
 *
 * Deliberately returns *only* the API URL and publishable key: the trusted
 * service-role key stays inside `setup-demo.ts` and never enters this module.
 */
export function readStatus() {
  const result = supabase(["status", "-o", "env"], {
    allowFailure: true,
    timeout: 60_000
  });
  if (result.status !== 0) return null;

  const env = parseStatusEnv(result.stdout || "");
  if (!env.API_URL) return null;

  return {
    apiUrl: env.API_URL,
    publishableKey: env.PUBLISHABLE_KEY || env.ANON_KEY || ""
  };
}

/**
 * Ensures the stack is running; `supabase start` is idempotent, so this is safe
 * both on a clean checkout and on an already-running stack.
 */
export function ensureSupabase({ start = true } = {}) {
  assertDocker();
  assertSupabaseCli();

  const running = readStatus();
  if (running) return running;

  if (!start) return null;

  console.log(
    "demo: local Supabase is not running — starting it (the first start can take a minute)…"
  );
  supabase(["start"], { inherit: true, timeout: 600_000 });

  const started = readStatus();
  if (!started) {
    throw new Error(
      "`supabase start` finished but the local API URL is still unavailable. " +
        "Check `docker ps` and re-run `pnpm demo`."
    );
  }

  return started;
}

/** Resolves the database container from the pinned project id (never guesses). */
export function findDatabaseContainer() {
  if (!existsSync(CONFIG_PATH)) {
    throw new Error(`supabase config not found at ${CONFIG_PATH}`);
  }

  const match = readFileSync(CONFIG_PATH, "utf8").match(
    /^\s*project_id\s*=\s*"([^"]+)"/m
  );
  if (!match) {
    throw new Error("could not read project_id from supabase/config.toml");
  }

  const expected = `supabase_db_${match[1]}`;
  const result = run(
    "docker",
    ["ps", "--filter", `name=^${expected}$`, "--format", "{{.Names}}"],
    { allowFailure: true }
  );
  const found = (result.stdout || "")
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)[0];

  if (found !== expected) {
    throw new Error(
      `expected database container ${expected} but it is not running. ` +
        "Start the stack with `pnpm demo`."
    );
  }

  return expected;
}

/** Applies trusted local SQL through psql inside the database container. */
export function applySql(container, sql) {
  return run(
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
    { input: sql, timeout: 300_000 }
  );
}

export function applySqlFile(container, path) {
  if (!existsSync(path)) throw new Error(`SQL file not found at ${path}`);
  return applySql(container, readFileSync(path, "utf8"));
}

/**
 * Applies pending migrations, then the base seed. Both operations are
 * idempotent: `migration up` is a no-op on a current schema and `seed.sql`
 * uses fixed UUIDs + `ON CONFLICT DO NOTHING` (verified by
 * `pnpm test:db:idempotency`, including with the demo dataset present).
 */
export function prepareDatabase() {
  console.log("demo: applying pending migrations…");
  supabase(["migration", "up", "--local"], {
    inherit: true,
    timeout: 300_000
  });

  const container = findDatabaseContainer();
  console.log("demo: applying the base seed (idempotent)…");
  applySqlFile(container, SEED_PATH);
  return container;
}

/**
 * Writes `.env.local` with the two browser-safe values only.
 *
 * The file is replaced atomically and contains no service-role/secret key, no
 * comments and no unrelated settings, so leaking the trusted key into a
 * `VITE_*` variable is structurally impossible here (AGENTS.md rule 4,
 * docs/architecture.md §6).
 */
export function writeEnvLocal(status) {
  if (!status.publishableKey) {
    throw new Error(
      "`supabase status` did not report PUBLISHABLE_KEY/ANON_KEY; refusing to " +
        "write .env.local."
    );
  }

  const content =
    `VITE_SUPABASE_URL=${status.apiUrl}\n` +
    `VITE_SUPABASE_PUBLISHABLE_KEY=${status.publishableKey}\n`;

  mkdirSync(APP_DIR, { recursive: true });
  const temporary = `${ENV_LOCAL_PATH}.tmp`;
  writeFileSync(temporary, content, { encoding: "utf8", mode: 0o600 });
  renameSync(temporary, ENV_LOCAL_PATH);
}

export function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM means the process exists but belongs to another user.
    return error.code === "EPERM";
  }
}

export function pidPath(name) {
  return join(PID_DIR, `${name}.pid`);
}

export function readPid(name) {
  const path = pidPath(name);
  if (!existsSync(path)) return null;

  const value = Number(readFileSync(path, "utf8").trim());
  return Number.isInteger(value) && value > 0 ? value : null;
}

export function writePid(name, pid) {
  ensureRuntimeDirs();
  writeFileSync(pidPath(name), `${pid}\n`, { encoding: "utf8" });
}

export function removePid(name) {
  rmSync(pidPath(name), { force: true });
}

/**
 * Guards against a stale PID file whose number now belongs to an unrelated
 * process. Identity requires BOTH a command-line marker and (when supplied)
 * the expected working directory, because a reused PID could belong to another
 * Quasar process in a different checkout.
 *
 * `/proc` is Linux-only. On other platforms there is no portable identity
 * check, so this fails CLOSED: the caller reports the PID and stops nothing.
 * That is deliberate — never kill an unverified PID. The workflow targets
 * WSL/Linux.
 */
export function pidMatches(pid, marker, expectedCwd = null) {
  if (process.platform !== "linux") return false;

  try {
    const cmdline = readFileSync(`/proc/${pid}/cmdline`, "utf8").replace(
      /\0/g,
      " "
    );
    if (!cmdline.includes(marker)) return false;

    if (expectedCwd !== null) {
      const actualCwd = readlinkSync(`/proc/${pid}/cwd`);
      if (resolve(actualCwd) !== resolve(expectedCwd)) return false;
    }

    return true;
  } catch {
    // Unreadable /proc entry: identity cannot be proven, so do not kill.
    return false;
  }
}

function signalProcess(pid, signal) {
  // Negative PID targets the detached process group so pnpm/vite children are
  // stopped together. Fall back to the leader if the group is already gone.
  try {
    process.kill(-pid, signal);
    return true;
  } catch {
    try {
      process.kill(pid, signal);
      return true;
    } catch {
      return false;
    }
  }
}

async function terminate(pid, timeoutMs = 8_000) {
  signalProcess(pid, "SIGTERM");

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isProcessAlive(pid)) return;
    await sleep(100);
  }

  signalProcess(pid, "SIGKILL");
  const killDeadline = Date.now() + 2_000;
  while (Date.now() < killDeadline && isProcessAlive(pid)) {
    await sleep(100);
  }
}

/**
 * Stops one demo process by PID file. Missing/stale/wrong-owner files are
 * removed without failing, which is what makes `pnpm demo:stop` safe when
 * nothing is running.
 */
export async function stopPidFile(
  name,
  marker,
  { dryRun = false, cwd = null } = {}
) {
  const pid = readPid(name);

  if (!pid) {
    if (!dryRun) console.log(`  ${name}: not running (no PID file)`);
    return false;
  }

  if (!isProcessAlive(pid)) {
    if (!dryRun) {
      removePid(name);
      console.log(`  ${name}: stale PID file removed (process ${pid} is gone)`);
    }
    return false;
  }

  if (!pidMatches(pid, marker, cwd)) {
    if (!dryRun) {
      removePid(name);
      console.log(
        `  ${name}: PID ${pid} identity could not be verified; ` +
          "stale file removed and the process was NOT killed"
      );
    }
    return false;
  }

  if (dryRun) {
    console.log(`  ${name}: would stop PID ${pid}`);
    return true;
  }

  console.log(`  ${name}: stopping PID ${pid}…`);
  await terminate(pid);
  removePid(name);
  return true;
}

/**
 * Starts a detached background process in its own process group and records
 * its PID. Output goes to `.demo/logs/<name>.log` so `demo:check` failures can
 * show the last useful lines without mixing them into the console.
 */
export function startDetached(name, command, args, options = {}) {
  const { env = {}, cwd = REPO_ROOT } = options;
  ensureRuntimeDirs();

  const logPath = join(LOG_DIR, `${name}.log`);
  const fd = openSync(logPath, "a");

  let child;
  try {
    child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      detached: true,
      stdio: ["ignore", fd, fd]
    });
  } finally {
    closeSync(fd);
  }

  // Without a listener, an async spawn error (e.g. command missing) would be
  // an unhandled rejection before the readiness probe produces its message.
  child.on("error", () => {});

  if (!child.pid) {
    throw new Error(`could not start ${name} (no PID assigned)`);
  }

  child.unref();
  writePid(name, child.pid);

  return { pid: child.pid, logPath };
}

export async function canConnect(port, host = DEV_HOST, timeoutMs = 750) {
  return new Promise(resolve => {
    const socket = connect({ port, host });

    const finish = value => {
      socket.destroy();
      resolve(value);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

export async function fetchWithTimeout(url, options = {}) {
  const { timeoutMs = 10_000, ...init } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function waitFor(label, predicate, options = {}) {
  const { timeoutMs = 60_000, intervalMs = 500 } = options;
  const deadline = Date.now() + timeoutMs;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      const value = await predicate();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await sleep(intervalMs);
  }

  throw new Error(
    `${label} did not become ready within ${Math.round(timeoutMs / 1000)}s` +
      (lastError ? ` (${lastError.message})` : "")
  );
}

export async function mockReady(port = mockPort()) {
  try {
    const response = await fetchWithTimeout(
      `${mockBaseUrl(port)}${CALENDAR_PATH}?scenario=default`,
      { timeoutMs: 2_500 }
    );
    if (response.status !== 200) return { ok: false, status: response.status };

    const body = await response.json();
    return {
      ok: Array.isArray(body.events) && typeof body.calendarId === "string",
      status: response.status
    };
  } catch (error) {
    return { ok: false, error };
  }
}

export async function appReady(base = devBaseUrl()) {
  try {
    const response = await fetchWithTimeout(`${base}/en`, {
      timeoutMs: 5_000
    });
    return response.status === 200;
  } catch {
    return false;
  }
}

export function tailLog(name, lines = 25) {
  const path = join(LOG_DIR, `${name}.log`);
  if (!existsSync(path)) return "";
  return tail(readFileSync(path, "utf8"), lines);
}

export function portInUseMessage(label, port, variable) {
  return (
    `port ${port} is already in use (${label}). Stop that process or pick a free port:\n` +
    `  ss -ltnp | grep :${port}\n` +
    `  ${variable}=<free-port> pnpm demo`
  );
}

export function trimBase(url) {
  return url.replace(/\/+$/, "");
}
