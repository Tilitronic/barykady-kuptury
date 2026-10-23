import type { SupabaseClient } from "@supabase/supabase-js";

import type { PublicBucket } from "@/features/files/buckets";
import type { Database } from "@/types/database.types";

/**
 * Shared public-object URL seam (T-020).
 *
 * The rule-of-three trigger the T-019 review documented: `team/portrait.ts`
 * and `projects/cover.ts` were two near-identical copies, so URL building
 * lives here while each feature keeps a thin wrapper that owns its bucket
 * (and, for publications, the `?download=` policy). Buckets are the two
 * public-read buckets created by T-014
 * (`supabase/migrations/20261018140000_storage_policies.sql`); the type keeps
 * call sites from inventing a third. A missing client or path yields `null`
 * so consumers omit media rather than fabricate it (DESIGN_SYSTEM.md §3).
 */
export type { PublicBucket };

export function publicObjectUrl(
  supabase: SupabaseClient<Database> | null,
  bucket: PublicBucket,
  path: string | null
): string | null {
  if (!supabase || !path) return null;

  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
