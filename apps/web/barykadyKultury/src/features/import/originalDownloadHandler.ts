/**
 * T-041 S4 — short-lived original download policy.
 *
 * Originals live in the private `content-sources` bucket (D-30). A public
 * request cannot create a signed URL directly, so the Netlify binding uses a
 * server-only key and this pure handler owns every policy gate:
 *
 *   - only a published row may be downloaded;
 *   - `allow_original_download` must be true (default false);
 *   - a non-empty private `source_path` must exist;
 *   - the signed URL expires quickly and is never cached or logged.
 *
 * The handler receives lookup/signing functions, so tests exercise the full
 * matrix without Supabase, storage or credentials.
 */

export type OriginalKind = "document" | "publication";

export interface OriginalDownloadTarget {
  readonly id: string;
  readonly status: "draft" | "published" | "archived";
  readonly sourcePath: string | null;
  readonly allowOriginalDownload: boolean;
}

export interface OriginalDownloadDependencies {
  readonly lookup: (
    kind: OriginalKind,
    slug: string
  ) => Promise<OriginalDownloadTarget | null>;
  readonly createSignedUrl: (
    path: string,
    expiresInSeconds: number
  ) => Promise<string | null>;
}

export const ORIGINAL_SIGNED_URL_TTL_SECONDS = 60;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type ErrorCode =
  | "invalid_request"
  | "method_not_allowed"
  | "not_found"
  | "download_disabled"
  | "storage_unavailable";

function jsonError(code: ErrorCode, status: number, extra = {}): Response {
  return new Response(JSON.stringify({ error: code }), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extra
    }
  });
}

function parseRequest(url: URL): { kind: OriginalKind; slug: string } | null {
  const kind = url.searchParams.get("kind");
  const slug = url.searchParams.get("slug")?.trim() ?? "";

  if (kind !== "document" && kind !== "publication") return null;
  if (!SLUG_PATTERN.test(slug)) return null;

  return { kind, slug };
}

export function createOriginalDownloadHandler(
  dependencies: OriginalDownloadDependencies
): (request: Request) => Promise<Response> {
  return async request => {
    const method = request.method.toUpperCase();
    if (method !== "GET" && method !== "HEAD") {
      return jsonError("method_not_allowed", 405, { allow: "GET, HEAD" });
    }

    const parsed = parseRequest(new URL(request.url));
    if (parsed === null) return jsonError("invalid_request", 400);

    let target: OriginalDownloadTarget | null;
    try {
      target = await dependencies.lookup(parsed.kind, parsed.slug);
    } catch {
      return jsonError("storage_unavailable", 502);
    }

    if (target === null || target.status !== "published") {
      return jsonError("not_found", 404);
    }
    if (
      !target.allowOriginalDownload ||
      target.sourcePath === null ||
      target.sourcePath.trim() === ""
    ) {
      return jsonError("download_disabled", 403);
    }

    let signedUrl: string | null;
    try {
      signedUrl = await dependencies.createSignedUrl(
        target.sourcePath,
        ORIGINAL_SIGNED_URL_TTL_SECONDS
      );
    } catch {
      return jsonError("storage_unavailable", 502);
    }
    if (signedUrl === null || signedUrl.trim() === "") {
      return jsonError("storage_unavailable", 502);
    }

    return new Response(null, {
      status: 302,
      headers: {
        location: signedUrl,
        "cache-control": "no-store",
        "referrer-policy": "no-referrer"
      }
    });
  };
}
