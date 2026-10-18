import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

/**
 * Public-read URL resolution for project covers (T-019).
 *
 * Mirrors the T-018 portrait seam: the database stores only the object path
 * (`projects.cover_path`), covers live in the `public-media` bucket created by
 * T-014, and this is the single place that turns a path into a public URL —
 * resolved in the feature layer (hook), never in a component
 * (AGENTS.md coding conventions). A missing client or path yields `null`, and
 * the card/detail simply omit the image: no broken frames, no invented
 * covers (docs/DESIGN_SYSTEM.md §3).
 */
export const PROJECT_COVER_BUCKET = "public-media";

export function projectCoverUrl(
  supabase: SupabaseClient<Database> | null,
  coverPath: string | null
): string | null {
  if (!supabase || !coverPath) return null;

  return supabase.storage.from(PROJECT_COVER_BUCKET).getPublicUrl(coverPath)
    .data.publicUrl;
}
