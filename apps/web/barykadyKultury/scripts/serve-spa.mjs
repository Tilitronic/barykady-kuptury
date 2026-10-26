#!/usr/bin/env node
/**
 * Dependency-free static file server for the built Quasar SPA (`dist/spa`).
 *
 * Why this exists: `@quasar/app-vite` v3 has no `quasar serve` command, and the
 * E2E ticket (T-003) requires Playwright to start the *production build* on a
 * fixed port without a pre-running server. A tiny Node server keeps the harness
 * free of an extra runtime dependency while giving us full control over the
 * single-page-application history fallback that the deployed Netlify SPA also
 * uses (architecture.md §9).
 *
 * History fallback rule: a request for a path that maps to no file is served
 * `index.html` when it has no file extension (client-side route). Requests for
 * a missing file that *do* have an extension return a real 404 so typos and
 * broken asset references are not masked.
 *
 * Usage: node scripts/serve-spa.mjs [--port 4173] [--host 127.0.0.1] [--root dist/spa]
 */

import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const APP_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  // T-034: generated SEO artifacts must not fall back to octet-stream; some
  // validators and crawlers reject a sitemap served with the wrong type.
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8"
};

/** Reads `--name value` / `--name=value` from argv, falling back when absent. */
function readFlag(name, fallback) {
  const inline = process.argv.find(arg => arg.startsWith(`--${name}=`));
  if (inline) {
    return inline.slice(name.length + 3);
  }

  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) {
    return fallback;
  }

  return process.argv[index + 1] ?? fallback;
}

const host = readFlag("host", process.env.HOST ?? "127.0.0.1");
const port = Number(readFlag("port", process.env.PORT ?? 4173));
const root = resolve(APP_ROOT, readFlag("root", "dist/spa"));

if (!Number.isInteger(port) || port <= 0) {
  console.error(`[serve-spa] invalid port: ${port}`);
  process.exit(1);
}

/** Resolves a URL pathname inside `root`, rejecting path traversal attempts. */
function resolveWithinRoot(pathname) {
  const candidate = resolve(root, `.${pathname}`);
  if (candidate !== root && !candidate.startsWith(root + sep)) {
    return null;
  }
  return candidate;
}

async function findFile(pathname) {
  const candidate = resolveWithinRoot(pathname);
  if (candidate === null) {
    return null;
  }

  const stats = await stat(candidate).catch(() => null);
  if (stats?.isFile()) {
    return candidate;
  }
  if (stats?.isDirectory()) {
    const indexPath = join(candidate, "index.html");
    const indexStats = await stat(indexPath).catch(() => null);
    if (indexStats?.isFile()) {
      return indexPath;
    }
  }
  return null;
}

function send(res, status, filePath) {
  res.writeHead(status, {
    "Content-Type": MIME_TYPES[extname(filePath)] ?? "application/octet-stream"
  });
  createReadStream(filePath).pipe(res);
}

const server = createServer(async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" });
    res.end();
    return;
  }

  const requestUrl = new URL(
    req.url ?? "/",
    `http://${req.headers.host ?? host}`
  );
  let pathname;
  try {
    pathname = decodeURIComponent(requestUrl.pathname);
  } catch {
    res.writeHead(400);
    res.end();
    return;
  }

  const filePath = await findFile(pathname);
  if (filePath !== null) {
    send(res, 200, filePath);
    return;
  }

  // Unknown path without an extension → SPA client-side route.
  const hasExtension = extname(pathname) !== "";
  const fallback = join(root, "index.html");
  if (!hasExtension && (await stat(fallback).catch(() => null))?.isFile()) {
    send(res, 200, fallback);
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not found");
});

server.listen(port, host, () => {
  console.log(`[serve-spa] serving ${root} on http://${host}:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
