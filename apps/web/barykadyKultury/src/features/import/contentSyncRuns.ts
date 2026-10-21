import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../types/database.types";

/** T-042 S9 — admin aggregate for the latest scheduled freshness run. */
export interface SyncRun {
  readonly id: string;
  readonly startedAt: string;
  readonly finishedAt: string | null;
  readonly checked: number;
  readonly updated: number;
  readonly failed: number;
  readonly skipped: number;
}

type RunRow = Database["public"]["Tables"]["content_sync_runs"]["Row"];

export async function fetchLatestSyncRun(
  client: SupabaseClient<Database>
): Promise<SyncRun | null> {
  const { data, error } = await client
    .from("content_sync_runs")
    .select("id, started_at, finished_at, checked, updated, failed, skipped")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error !== null || data === null) return null;
  const row = data as RunRow;
  return {
    id: row.id,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    checked: row.checked,
    updated: row.updated,
    failed: row.failed,
    skipped: row.skipped
  };
}

/** Last successful Drive sync marker for the admin status card (S8). */
export async function fetchSourceSyncedAt(
  client: SupabaseClient<Database>,
  kind: "document" | "publication",
  entityId: string
): Promise<string | null> {
  const table = kind === "document" ? "organization_documents" : "publications";
  let data: unknown = null;
  let error: { message: string } | null = null;
  try {
    const result = await client
      .from(table)
      .select("source_synced_at")
      .eq("id", entityId)
      .maybeSingle();
    data = result.data;
    error = result.error;
  } catch {
    return null;
  }

  if (error !== null || data === null) return null;
  const value = (data as { source_synced_at?: unknown }).source_synced_at;
  return typeof value === "string" ? value : null;
}
