/**
 * T-041 S4 — Netlify binding for the private original download.
 *
 * The pure policy lives in
 * `apps/web/barykadyKultury/src/features/import/originalDownloadHandler.ts`.
 * This file only wires server-side Supabase REST + Storage calls. It uses the
 * service-role key because `content-sources` is private and the reader is
 * anonymous; the key is never returned, logged or bundled into the client.
 *
 * The function redirects to a 60-second signed URL, so the public page can use
 * a plain same-origin link and no storage path/credential reaches the browser.
 */

import {
  createOriginalDownloadHandler,
  type OriginalKind,
  type OriginalDownloadTarget,
} from "../../apps/web/barykadyKultury/src/features/import/originalDownloadHandler";

const TABLE_BY_KIND: Record<OriginalKind, string> = {
  document: "organization_documents",
  publication: "publications",
};

interface SupabaseConfig {
  readonly url: string;
  readonly serviceKey: string;
}

function configFromEnv(): SupabaseConfig | null {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (url.trim() === "" || serviceKey.trim() === "") return null;
  return { url: url.replace(/\/+$/, ""), serviceKey };
}

function errorResponse(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

async function lookup(
  config: SupabaseConfig,
  kind: OriginalKind,
  slug: string,
): Promise<OriginalDownloadTarget | null> {
  const table = TABLE_BY_KIND[kind];
  const query =
    `${config.url}/rest/v1/${table}` +
    "?select=id,status,source_path,allow_original_download" +
    `&slug=eq.${encodeURIComponent(slug)}&limit=1`;

  const response = await fetch(query, {
    headers: {
      apikey: config.serviceKey,
      authorization: `Bearer ${config.serviceKey}`,
      accept: "application/json",
    },
  });

  if (!response.ok) return null;

  const rows: unknown = await response.json();
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const row = rows[0] as {
    id?: unknown;
    status?: unknown;
    source_path?: unknown;
    allow_original_download?: unknown;
  };

  if (typeof row.id !== "string" || typeof row.status !== "string") {
    return null;
  }

  return {
    id: row.id,
    status: row.status as OriginalDownloadTarget["status"],
    sourcePath: typeof row.source_path === "string" ? row.source_path : null,
    allowOriginalDownload: row.allow_original_download === true,
  };
}

async function createSignedUrl(
  config: SupabaseConfig,
  path: string,
  expiresInSeconds: number,
): Promise<string | null> {
  const encodedPath = path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  const response = await fetch(
    `${config.url}/storage/v1/object/sign/content-sources/${encodedPath}`,
    {
      method: "POST",
      headers: {
        apikey: config.serviceKey,
        authorization: `Bearer ${config.serviceKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ expiresIn: expiresInSeconds }),
    },
  );

  if (!response.ok) return null;

  const payload: unknown = await response.json();
  const signed =
    typeof payload === "object" && payload !== null
      ? ((payload as { signedURL?: unknown; signedUrl?: unknown }).signedURL ??
        (payload as { signedURL?: unknown; signedUrl?: unknown }).signedUrl)
      : null;

  if (typeof signed !== "string" || signed === "") return null;
  return signed.startsWith("/") ? `${config.url}${signed}` : signed;
}

export default async function contentOriginal(request: Request): Promise<Response> {
  const config = configFromEnv();
  if (config === null) {
    return errorResponse(500, "storage_unavailable");
  }

  return createOriginalDownloadHandler({
    lookup: (kind, slug) => lookup(config, kind, slug),
    createSignedUrl: (path, expires) => createSignedUrl(config, path, expires),
  })(request);
}
