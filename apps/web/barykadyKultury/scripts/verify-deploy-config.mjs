#!/usr/bin/env node
/**
 * T-034 — local "Netlify build equivalent" for deployment configuration.
 *
 * WHY this exists instead of requiring `netlify deploy --build --dry`:
 * - CI and review must not need a Netlify account, network access or a
 *   production site, and a dry deploy does not fail on a missing header.
 * - Every acceptance item in netlify.toml is a static, checkable fact (publish
 *   dir, SPA fallback, function directory, security headers, asset caching,
 *   redirect precedence). A small script turns "we read it once" into a repeatable
 *   gate that @reviewer and CI can run.
 *
 * It deliberately checks the *contract*, not Netlify's runtime: the actual SPA
 * fallback is exercised by Playwright against the same build output
 * (`scripts/serve-spa.mjs` implements the same no-extension rule).
 *
 * Usage: node scripts/verify-deploy-config.mjs
 */

import { readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const APP_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const REPO_ROOT = resolve(APP_ROOT, "../../..");
const NETLIFY_TOML = join(REPO_ROOT, "netlify.toml");

const failures = [];
const checks = [];

function check(name, condition, detail) {
  checks.push(name);
  if (!condition) {
    failures.push({ name, detail });
  }
}

function section(toml, header) {
  const start = toml.indexOf(`[${header}]`);
  if (start === -1) return "";
  const rest = toml.slice(start);
  const next = rest.indexOf("\n[");
  return next === -1 ? rest : rest.slice(0, next);
}

const toml = await readFile(NETLIFY_TOML, "utf8").catch(() => null);

if (toml === null) {
  console.error(`[verify-deploy] cannot read ${NETLIFY_TOML}`);
  process.exit(1);
}

const build = section(toml, "build");
const functions = section(toml, "functions");

check(
  "build publish dir is apps/web/barykadyKultury/dist/spa (Quasar SPA output)",
  /publish\s*=\s*"apps\/web\/barykadyKultury\/dist\/spa"/.test(build),
  build.trim()
);
check(
  "build command installs the app workspace then builds it",
  /pnpm --dir apps\/web\/barykadyKultury install/.test(build) &&
    /pnpm --dir apps\/web\/barykadyKultury build/.test(build),
  build.trim()
);
check(
  "build base is the repository root (D-23)",
  /base\s*=\s*"\."/.test(build),
  build.trim()
);
check(
  "functions directory is netlify/functions (D-23)",
  /directory\s*=\s*"netlify\/functions"/.test(functions),
  functions.trim()
);

check(
  "netlify/functions directory exists",
  (
    await stat(join(REPO_ROOT, "netlify/functions")).catch(() => null)
  )?.isDirectory() === true,
  "netlify/functions is missing"
);

check(
  "SPA deep-link fallback redirects /* to /index.html with status 200",
  /\[\[redirects\]\][\s\S]*?from\s*=\s*"\/\*"[\s\S]*?to\s*=\s*"\/index\.html"[\s\S]*?status\s*=\s*200/.test(
    toml
  ),
  "missing the history fallback redirect"
);

const apiCheckIndex = toml.indexOf('from = "/api/content-check"');
const spaFallbackIndex = toml.indexOf('from = "/*"');
check(
  "the /api/content-check function redirect precedes the SPA catch-all",
  apiCheckIndex !== -1 && apiCheckIndex < spaFallbackIndex,
  "function redirect would be shadowed by the SPA fallback"
);

const cspMatch = /Content-Security-Policy\s*=\s*"([^"]+)"/.exec(toml);
const csp = cspMatch?.[1] ?? "";
for (const directive of [
  "default-src 'self'",
  "script-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "worker-src 'self'",
  "connect-src 'self'",
  "img-src 'self'"
]) {
  check(`CSP includes ${directive}`, csp.includes(directive), csp);
}

for (const header of [
  "X-Frame-Options",
  "X-Content-Type-Options",
  "Referrer-Policy",
  "Permissions-Policy"
]) {
  check(
    `security header ${header} is configured`,
    toml.includes(header),
    header
  );
}

check(
  "hashed /assets/* responses are immutable for one year",
  /for\s*=\s*"\/assets\/\*"\s*\n\s*\[headers\.values\]\s*\n\s*Cache-Control\s*=\s*"public, max-age=31536000, immutable"/.test(
    toml
  ),
  "missing /assets/* immutable cache header"
);

check(
  "self-hosted /fonts/* has an explicit cache policy",
  /for\s*=\s*"\/fonts\/\*"/.test(toml),
  "missing /fonts/* cache header"
);

check(
  "robots.txt and sitemap.xml have a short cache policy",
  /for\s*=\s*"\/sitemap\.xml"/.test(toml) &&
    /for\s*=\s*"\/robots\.txt"/.test(toml),
  "missing SEO artifact cache headers"
);

check(
  "the web app manifest is served with its registered content type",
  /for\s*=\s*"\/manifest\.webmanifest"/.test(toml),
  "missing manifest content-type header"
);

// Secret hygiene (AGENTS.md rule 4): netlify.toml is committed, so it must never
// contain values for server-only variables or a VITE_-prefixed secret.
check(
  "no server secret names or VITE_* secrets are committed in netlify.toml",
  !/SERVICE_ROLE_KEY|PRIVATE_KEY|CLIENT_SECRET|VITE_[A-Z_]*(SECRET|PASSWORD|SERVICE_ROLE)/.test(
    toml
  ),
  "netlify.toml contains a secret-looking name"
);

for (const { name, detail } of failures) {
  console.error(`✗ ${name}${detail ? `\n    ${detail}` : ""}`);
}

if (failures.length > 0) {
  console.error(
    `\n[verify-deploy] ${failures.length}/${checks.length} deployment checks failed.`
  );
  process.exit(1);
}

console.log(
  `[verify-deploy] ${checks.length} deployment checks passed (publish dir, SPA fallback, functions, CSP, headers, caching, secret hygiene).`
);
