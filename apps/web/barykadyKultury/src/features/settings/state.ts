import type { SupabaseClient } from "@supabase/supabase-js";
import { computed, reactive, toValue, type MaybeRefOrGetter } from "vue";

import type { Locale } from "@/features/i18n/locales";
import type { Database } from "@/types/database.types";

import { fetchPublicOrganizationSettings } from "./api";
import {
  resolveOrganizationSettings,
  type OrganizationSettingsRow,
  type ResolvedOrganization
} from "./resolve";

/**
 * T-048 — the single public organization-settings state.
 *
 * Mirrors the auth store pattern (module-level reactive state, pure resolver):
 * `PublicLayout` loads the visible rows once per navigation, and every public
 * component derives its slice from the same source. An empty row list is the
 * explicit static/legacy mode, so unit tests and a fresh deployment keep the
 * shipped rendering without a settings bootstrap.
 *
 * Failure is deliberately silent at the public boundary: an unavailable
 * settings read falls back to the static shape rather than breaking the site.
 * The data is additive; no public page depends on it existing.
 */

const state = reactive<{
  rows: readonly OrganizationSettingsRow[];
  /**
   * True once a settings read succeeded. From then on the table is the sole
   * authority, so an empty visible set means "everything is hidden" and the
   * static defaults must not reappear. A failed/unstarted read stays false.
   */
  authoritative: boolean;
}>({
  rows: [],
  authoritative: false
});

/** The current rows (read-only by convention; exported for tests/debug). */
export function organizationSettingsRows(): readonly OrganizationSettingsRow[] {
  return state.rows;
}

/** Replaces the row set, e.g. after an admin save (same-session visibility). */
export function applyOrganizationSettings(
  rows: readonly OrganizationSettingsRow[],
  options: { readonly authoritative?: boolean } = {}
): void {
  state.rows = [...rows];
  // A successful but empty read means "not provisioned" unless the caller
  // explicitly knows the table is authoritative (the sentinel row is absent).
  state.authoritative = options.authoritative ?? rows.length > 0;
}

/** Restores the static/legacy mode. Used by tests and on sign-out. */
export function resetOrganizationSettings(): void {
  state.rows = [];
  state.authoritative = false;
}

/**
 * Loads the public projection. Called from PublicLayout on mount; any failure
 * leaves the previous rows (or the static defaults) untouched.
 */
export async function loadOrganizationSettings(
  supabase: SupabaseClient<Database> | null
): Promise<void> {
  const result = await fetchPublicOrganizationSettings(supabase);
  if (result.ok) applyOrganizationSettings(result.rows);
}

/** Reactive public organization shape for one locale. */
export function useOrganizationConfig(
  locale: MaybeRefOrGetter<Locale>
): Readonly<{ value: ResolvedOrganization }> {
  return computed(() =>
    resolveOrganizationSettings(state.rows, toValue(locale), {
      allowDefaults: !state.authoritative
    })
  );
}
