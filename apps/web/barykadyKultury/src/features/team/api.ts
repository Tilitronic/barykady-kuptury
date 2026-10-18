import type { SupabaseClient } from "@supabase/supabase-js";

import type { Locale } from "@/features/i18n/locales";
import { selectTranslation } from "@/shared/content/selectTranslation";
import {
  fromRows,
  unavailable,
  type ContentResult
} from "@/shared/content/result";
import type { Database } from "@/types/database.types";

/**
 * Team members data access (T-015; consumed by T-018).
 *
 * Only this module builds `team_members` queries (docs/architecture.md §3). The
 * member name is locale-independent; role and bio are optional, so a translation
 * is usable as soon as it exists (docs/PRODUCT_REQUIREMENTS.md §4).
 */

type TeamMemberStatus = Database["public"]["Enums"]["content_status"];

type TeamMemberRow = Database["public"]["Tables"]["team_members"]["Row"];
type TeamMemberTranslationRow =
  Database["public"]["Tables"]["team_member_translations"]["Row"];

export interface TeamMemberRowWithTranslations extends TeamMemberRow {
  readonly team_member_translations: readonly TeamMemberTranslationRow[];
}

/** Locale-independent member name plus the localized slug/role/bio. */
export interface TeamMember {
  readonly id: string;
  readonly status: TeamMemberStatus;
  readonly name: string;
  readonly slug: string;
  readonly role: string | null;
  readonly bio: string | null;
  readonly portraitPath: string | null;
  readonly sortOrder: number;
  readonly isFallback: boolean;
  readonly updatedAt: string;
}

/**
 * No field is required: the migration comment states role and bio are both
 * optional ("a member with no role still renders"), so a present translation is
 * already complete.
 */
export const TEAM_MEMBER_REQUIRED_FIELDS =
  [] as const satisfies readonly (keyof TeamMemberTranslationRow)[];

const TEAM_MEMBER_SELECT =
  "id, name, status, sort_order, portrait_path, updated_at, team_member_translations(locale, slug, role, bio)";

/** Maps one joined row to a domain model, or `null` without a usable translation. */
export function mapTeamMember(
  row: TeamMemberRowWithTranslations,
  locale: Locale
): TeamMember | null {
  const selected = selectTranslation(
    { status: row.status, translations: row.team_member_translations },
    locale,
    { requiredFields: TEAM_MEMBER_REQUIRED_FIELDS }
  );

  if (!selected) return null;

  const translation = selected.value;

  return {
    id: row.id,
    status: row.status,
    name: row.name,
    slug: translation.slug,
    role: translation.role,
    bio: translation.bio,
    portraitPath: row.portrait_path,
    sortOrder: row.sort_order,
    isFallback: selected.isFallback,
    updatedAt: row.updated_at
  };
}

/** Published team members for a locale (by `sort_order`), or an explicit state. */
export async function fetchPublishedTeamMembers(
  supabase: SupabaseClient<Database> | null,
  locale: Locale
): Promise<ContentResult<TeamMember>> {
  if (!supabase) return unavailable();

  const query = supabase.from("team_members");
  const { data, error } = await query
    .select(TEAM_MEMBER_SELECT)
    .eq("status", "published")
    .order("sort_order", { ascending: true })
    .overrideTypes<TeamMemberRowWithTranslations[], { merge: false }>();

  if (error) return unavailable();

  return fromRows(data ?? [], row => mapTeamMember(row, locale));
}
