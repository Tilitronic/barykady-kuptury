import type { SupabaseClient } from "@supabase/supabase-js";

import { PUBLIC_MEDIA_BUCKET } from "@/features/files/buckets";
import { publicObjectUrl } from "@/features/files/publicObjectUrl";
import type { Database } from "@/types/database.types";

/**
 * Public-read URL resolution for team portraits (T-018).
 *
 * Thin per-feature wrapper: owns the bucket (`public-media`, T-014) and
 * delegates URL building to the shared `publicObjectUrl` seam (extracted at
 * T-020 when the third media seam appeared). A missing client or path yields
 * `null`, and the card falls back to the neutral monogram — never a
 * fabricated photo (DESIGN_SYSTEM.md §3).
 */
export const TEAM_PORTRAIT_BUCKET = PUBLIC_MEDIA_BUCKET;

export function teamPortraitUrl(
  supabase: SupabaseClient<Database> | null,
  portraitPath: string | null
): string | null {
  return publicObjectUrl(supabase, TEAM_PORTRAIT_BUCKET, portraitPath);
}
