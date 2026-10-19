/**
 * Storage REST helpers for the local Supabase stack.
 *
 * We use the Storage HTTP API directly instead of adding `@supabase/supabase-js`
 * to the repository root: the demo scripts only need three calls (upsert,
 * public GET, auth admin), and a raw fetch keeps the runtime dependency-free
 * (AGENTS.md rule 7). The service-role key is supplied by the caller in memory
 * and is never logged, written, or placed in a public URL.
 *
 * Design authority: docs/architecture.md §6 — public reads are deliberate,
 * uploads are a trusted admin action, and the service key never reaches the
 * client. The buckets' MIME allow-lists live in the T-014 migration.
 */
import type { DemoAsset, DemoBucket } from "./manifest";
import type { LocalSupabaseStatus } from "./supabaseStatus";

/** Percent-encodes each segment; slashes stay path separators. */
export function encodeStoragePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

function trimBase(apiUrl: string): string {
  return apiUrl.replace(/\/+$/, "");
}

export function storageObjectUrl(
  apiUrl: string,
  bucket: DemoBucket,
  path: string
): string {
  return `${trimBase(apiUrl)}/storage/v1/object/${bucket}/${encodeStoragePath(path)}`;
}

export function publicStorageUrl(
  apiUrl: string,
  bucket: DemoBucket,
  path: string
): string {
  return `${trimBase(apiUrl)}/storage/v1/object/public/${bucket}/${encodeStoragePath(path)}`;
}

export function expectedContentType(
  bucket: DemoBucket
): "image/png" | "application/pdf" {
  return bucket === "public-media" ? "image/png" : "application/pdf";
}

async function readFailure(response: Response, label: string): Promise<never> {
  const body = await response.text().catch(() => "");
  // Never include request headers here: they carry the service-role key.
  throw new Error(
    `${label} failed (${response.status}): ${body.slice(0, 300)}`
  );
}

/** Upserts one generated object with the service-role key (local stack only). */
export async function uploadAsset(
  status: LocalSupabaseStatus,
  asset: DemoAsset,
  buffer: Buffer
): Promise<void> {
  const response = await fetch(
    storageObjectUrl(status.apiUrl, asset.bucket, asset.path),
    {
      method: "POST",
      headers: {
        apikey: status.serviceRoleKey,
        Authorization: `Bearer ${status.serviceRoleKey}`,
        "Content-Type": asset.mimeType,
        "Cache-Control": "public, max-age=3600",
        "x-upsert": "true"
      },
      body: buffer
    }
  );

  if (!response.ok) {
    await readFailure(response, `upload ${asset.bucket}/${asset.path}`);
  }
}

/**
 * Fetches the public URL anonymously and requires the expected content type.
 * This is the proof that the bucket is public-read and the object is present;
 * an HTTP 200 with the wrong type would mean a broken image/PDF in the UI.
 */
export async function verifyPublicObject(
  status: LocalSupabaseStatus,
  bucket: DemoBucket,
  path: string
): Promise<void> {
  const response = await fetch(publicStorageUrl(status.apiUrl, bucket, path));
  if (!response.ok) {
    await readFailure(response, `public URL ${bucket}/${path}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const expected = expectedContentType(bucket);
  if (!contentType.toLowerCase().startsWith(expected)) {
    throw new Error(
      `public URL ${bucket}/${path} returned "${contentType}", expected "${expected}"`
    );
  }
}
