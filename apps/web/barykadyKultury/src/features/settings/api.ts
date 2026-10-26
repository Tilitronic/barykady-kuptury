import type { SupabaseClient } from "@supabase/supabase-js";

import { SUPPORTED_LOCALES } from "@/features/i18n/locales";
import type { Database, Json } from "@/types/database.types";

import type { SettingValue } from "./definition";
import type { OrganizationSettingsRow } from "./resolve";

/**
 * T-048 — typed data access for `organization_settings`.
 *
 * Design authority:
 *   * docs/architecture.md §3 — feature data access stays behind this seam;
 *     components never build PostgREST queries.
 *   * docs/architecture.md §6.1 — anonymous reads select only visible rows;
 *     writes go through one transactional RPC that re-checks the capability.
 *   * docs/tickets/T-048 — hidden values must not leak through API payloads.
 *
 * The explicit `.eq("visible", true)` is deliberately redundant with RLS: it
 * is the client-side expression of the same rule, and the fake PostgREST used
 * by E2E applies it, so a test that drops it fails even with a permissive
 * fixture.
 */

/** Public projection: no audit fields and no hidden rows (RLS + filter). */
const PUBLIC_SELECT = "key, value, visible" as const;

/** Admin projection: every row plus the audit surface (who/when). */
const ADMIN_SELECT =
  "key, value, visible, updated_by, updated_by_email, updated_at" as const;

const SETTINGS_TABLE = "organization_settings" as const;

/** The one transactional write RPC (T-045 paired-RPC style). */
export const SAVE_SETTINGS_RPC = "save_settings_v1" as const;

export interface OrganizationSettingChange {
  readonly key: string;
  readonly value: SettingValue;
  readonly visible: boolean;
}

export type SettingsFailureCode = "unavailable" | "failed" | "empty";

export type SettingsFailure = {
  readonly ok: false;
  readonly code: SettingsFailureCode;
  /** Stable diagnostic only — never rendered raw to the user. */
  readonly message?: string;
};

export type OrganizationSettingsResult =
  | { readonly ok: true; readonly rows: readonly OrganizationSettingsRow[] }
  | SettingsFailure;

export type SettingsMutationResult = { readonly ok: true } | SettingsFailure;

interface RawRow {
  readonly key: string;
  readonly value: unknown;
  readonly visible: boolean;
  readonly updated_by?: string | null;
  readonly updated_by_email?: string | null;
  readonly updated_at?: string | null;
}

/**
 * Filters an untrusted JSONB value down to the three supported locales.
 * Unknown keys and non-string entries are dropped, so a malformed row can
 * never inject extra data into the resolved public shape.
 */
export function normalizeSettingValue(raw: unknown): SettingValue {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }

  const record = raw as Record<string, unknown>;
  const value: SettingValue = {};
  for (const locale of SUPPORTED_LOCALES) {
    const entry = record[locale];
    if (typeof entry === "string") value[locale] = entry;
  }
  return value;
}

/**
 * Public rows deliberately drop audit fields even if a permissive fixture
 * happens to include them: the anonymous projection is the public boundary
 * (audit is admin-only data).
 */
function mapRow(
  row: RawRow,
  options: { readonly includeAudit: boolean }
): OrganizationSettingsRow {
  return {
    key: row.key,
    value: normalizeSettingValue(row.value),
    visible: row.visible === true,
    updated_by: options.includeAudit ? (row.updated_by ?? null) : null,
    updated_by_email: options.includeAudit
      ? (row.updated_by_email ?? null)
      : null,
    updated_at: options.includeAudit ? (row.updated_at ?? null) : null
  };
}

function failure(code: SettingsFailureCode, message?: string): SettingsFailure {
  return message === undefined
    ? { ok: false, code }
    : { ok: false, code, message };
}

/**
 * Anonymous/public read. Only visible rows are requested; RLS enforces the
 * same predicate server-side.
 */
export async function fetchPublicOrganizationSettings(
  supabase: SupabaseClient<Database> | null
): Promise<OrganizationSettingsResult> {
  if (!supabase) return failure("unavailable");

  const { data, error } = await supabase
    .from(SETTINGS_TABLE)
    .select(PUBLIC_SELECT)
    .eq("visible", true);

  if (error) return failure("failed", error.message);
  return {
    ok: true,
    rows: (data ?? []).map(row =>
      mapRow(row as RawRow, { includeAudit: false })
    )
  };
}

/** Admin read: all rows, including hidden ones and the audit fields. */
export async function fetchAdminOrganizationSettings(
  supabase: SupabaseClient<Database> | null
): Promise<OrganizationSettingsResult> {
  if (!supabase) return failure("unavailable");

  const { data, error } = await supabase
    .from(SETTINGS_TABLE)
    .select(ADMIN_SELECT)
    .order("key", { ascending: true });

  if (error) return failure("failed", error.message);
  return {
    ok: true,
    rows: (data ?? []).map(row => mapRow(row as RawRow, { includeAudit: true }))
  };
}

/**
 * Saves the complete intended change set in one transaction.
 *
 * Empty input is rejected locally rather than issuing a no-op RPC; the SQL
 * function rejects it as well so the contract does not depend on the client.
 */
export async function saveOrganizationSettings(
  supabase: SupabaseClient<Database> | null,
  changes: readonly OrganizationSettingChange[]
): Promise<SettingsMutationResult> {
  if (!supabase) return failure("unavailable");
  if (changes.length === 0) return failure("empty");

  const { error } = await supabase.rpc(SAVE_SETTINGS_RPC, {
    // The generated RPC arg type is the generic Json envelope; the change
    // array is structurally JSON and the SQL function validates every entry.
    p_changes: changes as unknown as Json
  });

  if (error) return failure("failed", error.message);
  return { ok: true };
}
