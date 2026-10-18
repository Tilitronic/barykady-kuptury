import type { SupabaseClient } from "@supabase/supabase-js";

import { publicObjectUrl } from "@/features/files/publicObjectUrl";
import type { Database } from "@/types/database.types";

/**
 * Public-read URL resolution for project covers (T-019).
 *
 * Thin per-feature wrapper: owns the bucket (`public-media`, T-014) and
 * delegates URL building to the shared `publicObjectUrl` seam — the
 * rule-of-three extraction the T-019 review anticipated, triggered by the
 * third media seam in T-020. Resolved in the feature layer (hook), never in
 * a component (AGENTS.md coding conventions). A missing client or path
 * yields `null`, and the card/detail simply omit the image: no broken
 * frames, no invented covers (docs/DESIGN_SYSTEM.md §3).
 */
export const PROJECT_COVER_BUCKET = "public-media";

export function projectCoverUrl(
  supabase: SupabaseClient<Database> | null,
  coverPath: string | null
): string | null {
  return publicObjectUrl(supabase, PROJECT_COVER_BUCKET, coverPath);
}
