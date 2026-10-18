import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

/**
 * Public-read URL resolution for team portraits (T-018).
 *
 * The database stores only the object path; portraits live in the
 * `public-media` bucket created by T-014 (public read, admin write). This is
 * the single place that turns a path into a URL so no component builds raw
 * storage requests (docs/architecture.md §3). A missing client (unconfigured
 * production build) or a missing path yields `null`, and the card falls back
 * to the neutral monogram — never a fabricated photo (DESIGN_SYSTEM.md §3).
 */
export const TEAM_PORTRAIT_BUCKET = "public-media";

export function teamPortraitUrl(
  supabase: SupabaseClient<Database> | null,
  portraitPath: string | null
): string | null {
  if (!supabase || !portraitPath) return null;

  return supabase.storage.from(TEAM_PORTRAIT_BUCKET).getPublicUrl(portraitPath)
    .data.publicUrl;
}
