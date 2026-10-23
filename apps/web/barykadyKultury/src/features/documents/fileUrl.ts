import type { SupabaseClient } from "@supabase/supabase-js";

import { PUBLIC_DOCUMENTS_BUCKET } from "@/features/files/buckets";
import { publicObjectUrl } from "@/features/files/publicObjectUrl";
import type { Database } from "@/types/database.types";

/**
 * Public download URL for an organization document (T-029).
 *
 * T-014 download guidance: the URL carries `?download=<safe-name>` so Storage
 * answers with `Content-Disposition: attachment`; stored content is never
 * rendered inline. The bucket is `public-documents` (PDF/DOCX) per
 * docs/architecture.md §6.1.
 */
export function documentFileUrl(
  supabase: SupabaseClient<Database> | null,
  storagePath: string | null
): string | null {
  const base = publicObjectUrl(supabase, PUBLIC_DOCUMENTS_BUCKET, storagePath);

  if (!base || !storagePath) return null;

  return `${base}?download=${safeDownloadName(storagePath)}`;
}

function safeDownloadName(path: string): string {
  const basename = path.split("/").pop() ?? "";
  const cleaned = basename
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/gu, "-")
    .replace(/^-+|-+$/gu, "");

  return cleaned === "" ? "download" : cleaned;
}
