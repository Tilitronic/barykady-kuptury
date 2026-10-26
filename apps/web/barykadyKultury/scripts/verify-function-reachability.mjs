#!/usr/bin/env node
/**
 * T-034 gate fix — deterministic reachability check for the calendar function.
 *
 * Part of `pnpm verify:deploy`. It boots the local Netlify v2 function runtime
 * (`local-function-runtime.mjs`) on an ephemeral loopback port and calls the
 * *documented* public path, so the evidence is a real HTTP response from the
 * real function binding — not a static-file existence check.
 *
 * Determinism: the Google credentials are cleared for this process only, and
 * fake `VITE_`-prefixed values are injected. A correct server-env boundary
 * therefore yields `500 calendar_unavailable` with JSON content type:
 *   - non-404 and non-HTML proves the path is routed to the function, not the
 *     SPA fallback;
 *   - ignoring the `VITE_*` values proves the function reads server env only
 *     (AGENTS.md rule 4, T-042/D-41).
 *
 * No network, no Google account, no Netlify CLI.
 */

import {
  createLocalFunctionServer,
  FUNCTIONS_URL_PREFIX
} from "./local-function-runtime.mjs";

const FUNCTION_PATH = `${FUNCTIONS_URL_PREFIX}calendar-events`;

const failures = [];
const checks = [];

function check(name, condition, detail) {
  checks.push(name);
  if (!condition) failures.push({ name, detail });
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server.address()));
  });
}

function close(server) {
  return new Promise(resolve => server.close(resolve));
}

// The function must ignore browser-prefixed config. Clear the real names and
// seed lookalike VITE_ values that would make a leaky implementation succeed.
delete process.env.GOOGLE_CALENDAR_ID;
delete process.env.GOOGLE_CALENDAR_API_KEY;
process.env.VITE_GOOGLE_CALENDAR_ID = "browser-value";
process.env.VITE_GOOGLE_CALENDAR_API_KEY = "browser-value";

const server = createLocalFunctionServer();

try {
  const address = await listen(server);
  const origin = `http://127.0.0.1:${address.port}`;
  const url = `${origin}${FUNCTION_PATH}`;

  const get = await fetch(url);
  const contentType = get.headers.get("content-type") ?? "";
  const body = await get.json().catch(() => null);

  check(
    "GET is routed to the function (not a 404)",
    get.status !== 404,
    `status ${get.status}`
  );
  check(
    "GET responds with a non-HTML JSON contract (not the SPA fallback)",
    contentType.includes("application/json") &&
      !contentType.includes("text/html"),
    contentType
  );
  check(
    "missing server config yields the fail-closed calendar_unavailable code",
    get.status === 500 && body?.error === "calendar_unavailable",
    `status ${get.status}, body ${JSON.stringify(body)}`
  );
  check(
    "VITE_-prefixed lookalikes are not read (server env boundary holds)",
    body?.error === "calendar_unavailable",
    JSON.stringify(body)
  );

  const head = await fetch(url, { method: "HEAD" });
  const headBody = await head.text();
  check(
    "HEAD returns the same status with no body",
    head.status === get.status && headBody === "",
    `status ${head.status}, body length ${headBody.length}`
  );

  const post = await fetch(url, { method: "POST" });
  const postBody = await post.json().catch(() => null);
  check(
    "POST is rejected with method_not_allowed (405)",
    post.status === 405 && postBody?.error === "method_not_allowed",
    `status ${post.status}, body ${JSON.stringify(postBody)}`
  );
} finally {
  await close(server);
}

for (const { name, detail } of failures) {
  console.error(`✗ ${name}${detail ? `\n    ${detail}` : ""}`);
}

if (failures.length > 0) {
  console.error(
    `\n[verify-function] ${failures.length}/${checks.length} reachability checks failed.`
  );
  process.exit(1);
}

console.log(
  `[verify-function] ${checks.length} reachability checks passed at ${FUNCTION_PATH} ` +
    "(non-404, JSON, server-env-only, HEAD, method rejection)."
);
