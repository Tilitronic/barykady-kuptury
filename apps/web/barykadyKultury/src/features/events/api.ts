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
 * Event↔project link data access (T-015; consumed by T-024).
 *
 * Google Calendar is the source of event content; Supabase only stores the
 * optional link from a calendar event identity to a project
 * (docs/architecture.md §4–§5). The public policy on `calendar_event_links`
 * already hides mappings to unpublished projects (T-013); the mapper applies the
 * same rule so a link is emitted only when the project *and* its selected
 * translation are public.
 */

type ProjectStatus = Database["public"]["Enums"]["content_status"];

type CalendarEventLinkRow =
  Database["public"]["Tables"]["calendar_event_links"]["Row"];
type ProjectTranslationRow =
  Database["public"]["Tables"]["project_translations"]["Row"];

/** The embedded project of a link (to-one relation). */
interface LinkedProject {
  readonly status: ProjectStatus;
  readonly project_translations: readonly ProjectTranslationRow[];
}

export interface CalendarEventLinkRowWithProject extends CalendarEventLinkRow {
  readonly projects: LinkedProject | null;
}

/** A published-project link for one Google Calendar event. */
export interface EventProjectLink {
  readonly calendarId: string;
  readonly googleEventId: string;
  readonly projectId: string;
  readonly slug: string;
  readonly title: string;
  readonly isFallback: boolean;
}

/** A link only needs the project's title to render an accessible link name. */
export const EVENT_LINK_REQUIRED_FIELDS = [
  "title"
] as const satisfies readonly (keyof ProjectTranslationRow)[];

const EVENT_LINK_SELECT =
  "calendar_id, google_event_id, project_id, projects(status, project_translations(locale, slug, title))";

/** Maps one joined row to a domain model, or `null` when no public link exists. */
export function mapEventProjectLink(
  row: CalendarEventLinkRowWithProject,
  locale: Locale
): EventProjectLink | null {
  const project = row.projects;
  if (row.project_id === null || !project) return null;

  const selected = selectTranslation(
    { status: project.status, translations: project.project_translations },
    locale,
    { requiredFields: EVENT_LINK_REQUIRED_FIELDS }
  );

  if (!selected) return null;

  return {
    calendarId: row.calendar_id,
    googleEventId: row.google_event_id,
    projectId: row.project_id,
    slug: selected.value.slug,
    title: selected.value.title,
    isFallback: selected.isFallback
  };
}

/**
 * Public event→project links for the locale. The caller joins these to the
 * normalized calendar events by `calendarId` + `googleEventId`; an event with
 * no link simply has no match and still renders (docs/architecture.md §4).
 */
export async function fetchPublishedEventProjectLinks(
  supabase: SupabaseClient<Database> | null,
  locale: Locale
): Promise<ContentResult<EventProjectLink>> {
  if (!supabase) return unavailable();

  const query = supabase.from("calendar_event_links");
  const { data, error } = await query
    .select(EVENT_LINK_SELECT)
    .not("project_id", "is", null)
    .overrideTypes<CalendarEventLinkRowWithProject[], { merge: false }>();

  if (error) return unavailable();

  return fromRows(data ?? [], row => mapEventProjectLink(row, locale));
}
