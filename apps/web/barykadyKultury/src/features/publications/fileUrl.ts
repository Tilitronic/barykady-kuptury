import type { SupabaseClient } from "@supabase/supabase-js";

import { publicObjectUrl } from "@/features/files/publicObjectUrl";
import type { Database } from "@/types/database.types";

/**
 * Public download URL for publication files (T-020).
 *
 * Bucket choice — documented because the row has no bucket column:
 * publication files are DOWNLOADS, and T-014 splits the two public buckets by
 * purpose (`public-documents`: PDF/DOCX; `public-media`: PNG/JPEG/WebP), so
 * `publication_files.storage_path` lives in `public-documents`
 * (supabase/migrations/20261018140000_storage_policies.sql).
 *
 * Per the T-014 download guidance, the URL carries `?download=<safe-name>`:
 * Supabase Storage then answers with `Content-Disposition: attachment`, so a
 * public link can never inline-execute stored content. The name is derived
 * from the stored path and sanitized to `[a-z0-9._-]` — never raw author text.
 */
export const PUBLICATION_FILE_BUCKET = "public-documents";

export function publicationFileUrl(
  supabase: SupabaseClient<Database> | null,
  storagePath: string | null
): string | null {
  const base = publicObjectUrl(supabase, PUBLICATION_FILE_BUCKET, storagePath);

  if (!base || !storagePath) return null;

  return `${base}?download=${safeDownloadName(storagePath)}`;
}

function safeDownloadName(path: string): string {
  const basename = path.split("/").pop() ?? "";
  const cleaned = basename
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return cleaned === "" ? "download" : cleaned;
}
