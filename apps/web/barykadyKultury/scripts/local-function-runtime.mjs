/**
 * T-034 gate fix — local equivalent runtime for Netlify Functions v2.
 *
 * WHY: ticket T-034 requires the calendar function to be *reachable* at
 * `/.netlify/functions/calendar-events`, and the SPA fallback must not mask a
 * function path. Netlify evaluates functions before redirects; the static E2E
 * server used to serve `index.html` for every extensionless path, which is a
 * false positive for reachability. This module executes the real function
 * entry (same binding file, same `process.env` boundary) and is used by:
 *   - `scripts/serve-spa.mjs` — the Playwright server, so E2E can request the
 *     documented path on the app origin;
 *   - `scripts/verify-function-reachability.mjs` — deploy-verification flow.
 *
 * Deliberately minimal: only the Web-standard `export default (Request) =>
 * Response` contract (the project uses Netlify Functions v2 and no
 * `@netlify/functions` dependency). It is test/dev tooling, not production
 * runtime, and never substitutes Netlify's routing or environment handling.
 */

import { readdir } from "node:fs/promises";
import { createServer } from "node:http";
import { register } from "node:module";
import { join, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

// Must run before the first dynamic import of a function entry. Registration is
// idempotent per process and applies to subsequent module loads.
register(new URL("./resolve-ts.mjs", import.meta.url));

const APP_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const REPO_ROOT = resolve(APP_ROOT, "../../..");
export const FUNCTIONS_DIR = join(REPO_ROOT, "netlify/functions");
export const FUNCTIONS_URL_PREFIX = "/.netlify/functions/";
export const FUNCTION_NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

/** Module cache: one evaluation per function per process, like a warm container. */
const loaded = new Map();

function jsonError(status, error, extraHeaders = {}) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders }
  });
}

/**
 * Loads a function entry by name. Returns `null` for an unknown name so the
 * caller can answer with a real 404 instead of the SPA entry point.
 */
export async function loadFunction(name) {
  if (!FUNCTION_NAME_PATTERN.test(name)) return null;
  if (loaded.has(name)) return loaded.get(name);

  let entries;
  try {
    entries = await readdir(FUNCTIONS_DIR);
  } catch {
    return null;
  }
  if (!entries.includes(`${name}.ts`)) return null;

  const module = await import(
    pathToFileURL(join(FUNCTIONS_DIR, `${name}.ts`)).href
  );
  const handler = module.default;
  if (typeof handler !== "function") {
    throw new Error(`netlify function "${name}" has no default handler`);
  }

  loaded.set(name, handler);
  return handler;
}

/** Builds a Fetch `Request` from a Node request (small body buffer is enough). */
export async function toWebRequest(request) {
  const url = new URL(
    request.url ?? "/",
    `http://${request.headers.host ?? "127.0.0.1"}`
  );
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (value !== undefined) {
      headers.set(key, Array.isArray(value) ? value.join(", ") : value);
    }
  }

  const method = (request.method ?? "GET").toUpperCase();
  let body;
  if (method !== "GET" && method !== "HEAD") {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    body = Buffer.concat(chunks);
  }

  return new Request(url, { method, headers, body });
}

/** Writes a Fetch `Response` back to a Node response. */
export async function sendWebResponse(response, nodeResponse) {
  const headers = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  nodeResponse.writeHead(response.status, headers);

  if (response.body === null) {
    nodeResponse.end();
    return;
  }
  nodeResponse.end(Buffer.from(await response.arrayBuffer()));
}

/**
 * Handles a request when it targets the functions prefix.
 *
 * Returns `false` when the path is not a function path (caller keeps its normal
 * static/SPA handling). A function path always terminates here — unknown names
 * and runtime failures never fall through to `index.html`, matching Netlify's
 * functions-before-redirects precedence.
 */
export async function handleFunctionRequest(request, response, pathname) {
  if (!pathname.startsWith(FUNCTIONS_URL_PREFIX)) return false;

  const name = pathname.slice(FUNCTIONS_URL_PREFIX.length).replace(/\/+$/, "");

  let result;
  try {
    const handler = await loadFunction(name);
    result =
      handler === null
        ? jsonError(404, "function_not_found")
        : await handler(await toWebRequest(request));
  } catch (error) {
    // Test tooling only: log the message, never a function payload/secret.
    console.error(
      `[local-functions] ${name} failed: ${
        error instanceof Error ? error.message : "unknown error"
      }`
    );
    result = jsonError(500, "function_unavailable");
  }

  await sendWebResponse(result, response);
  return true;
}

/**
 * Standalone server for the reachability verifier. Returns the Node server so
 * the caller controls the port and shutdown.
 */
export function createLocalFunctionServer() {
  return createServer(async (request, response) => {
    const pathname = new URL(
      request.url ?? "/",
      `http://${request.headers.host ?? "127.0.0.1"}`
    ).pathname;

    try {
      const handled = await handleFunctionRequest(request, response, pathname);
      if (!handled) {
        await sendWebResponse(jsonError(404, "not_found"), response);
      }
    } catch (error) {
      console.error(
        `[local-functions] request failed: ${
          error instanceof Error ? error.message : "unknown error"
        }`
      );
      if (!response.headersSent) {
        await sendWebResponse(jsonError(500, "function_unavailable"), response);
      }
    }
  });
}
