/**
 * T-042 S9 — scheduled Google freshness run (default: nightly).
 *
 * Netlify schedule is configured per function; change the cron below to alter
 * the cadence. The run reuses the S7 pipeline, processes at most three
 * documents concurrently, isolates per-document failures, and records an
 * aggregate row for the admin. The public reader's on-view check remains the
 * fast path for visited pages.
 */

import { readServerSupabaseConfig } from "../../apps/web/barykadyKultury/src/features/import/serverEnv";
import { runScheduledSync } from "../../apps/web/barykadyKultury/src/features/import/syncSchedule";
import { runServerGoogleSync } from "../../apps/web/barykadyKultury/src/features/import/serverGoogleSync";
import {
  callServiceRpc,
  insertRows,
  selectRows,
  updateRows,
  type ServerSupabaseConfig,
} from "../../apps/web/barykadyKultury/src/features/import/serverSupabase";

export const config = {
  schedule: process.env.CONTENT_SYNC_SCHEDULE ?? "@daily",
};

function supabaseConfig(): ServerSupabaseConfig | null {
  // T-042 review fix: server-only names, fail closed. No `VITE_*` fallback.
  return readServerSupabaseConfig(process.env);
}

interface TargetRow {
  readonly id?: unknown;
  readonly slug?: unknown;
  readonly language?: unknown;
  readonly source_external_id?: unknown;
  readonly source_checked_at?: unknown;
  readonly source_check_failures?: unknown;
}

function mapRows(rows: readonly Record<string, unknown>[], kind: "document" | "publication") {
  return rows.flatMap((row) => {
    const typed = row as TargetRow;
    if (typeof typed.id !== "string" || typeof typed.source_external_id !== "string") {
      return [];
    }
    return [
      {
        kind,
        entityId: typed.id,
        fileId: typed.source_external_id,
        locale: typeof typed.language === "string" ? typed.language : "en",
        lastCheckedAt: typeof typed.source_checked_at === "string" ? typed.source_checked_at : null,
        failures: typeof typed.source_check_failures === "number" ? typed.source_check_failures : 0,
      },
    ];
  });
}

async function listTargets(supabase: ServerSupabaseConfig) {
  const query =
    "select=id,slug,language,source_external_id,source_checked_at,source_check_failures" +
    "&source_provider=eq.google_doc&status=eq.published" +
    "&source_external_id=not.is.null";

  const [documents, publications] = await Promise.all([
    selectRows(supabase, "organization_documents", `${query}&limit=1000`),
    selectRows(supabase, "publications", `${query}&limit=1000`),
  ]);

  return [...mapRows(documents, "document"), ...mapRows(publications, "publication")];
}

async function claimJob(
  supabase: ServerSupabaseConfig,
  target: {
    kind: "document" | "publication";
    entityId: string;
    fileId: string;
    locale: string;
  },
): Promise<string | null> {
  const payload = await callServiceRpc(supabase, "claim_scheduled_content_sync_job_v1", {
    p_kind: target.kind,
    p_entity_id: target.entityId,
    p_locale: target.locale,
    p_request: {
      mode: "apply",
      kind: target.kind,
      fileId: target.fileId,
      entityId: target.entityId,
      locale: target.locale,
    },
  });
  return typeof payload === "string" ? payload : null;
}

async function recordCheck(
  supabase: ServerSupabaseConfig,
  target: {
    kind: "document" | "publication";
    entityId: string;
  },
  success: boolean,
): Promise<void> {
  await callServiceRpc(supabase, "record_content_check_result_v1", {
    p_kind: target.kind,
    p_entity_id: target.entityId,
    p_success: success,
  });
}

export default async function contentSyncScheduled(): Promise<Response> {
  const supabase = supabaseConfig();
  if (supabase === null) {
    return new Response(JSON.stringify({ error: "server_unavailable" }), {
      status: 500,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }

  const startedAt = new Date().toISOString();
  const run = await insertRows(supabase, "content_sync_runs", {
    started_at: startedAt,
  });
  const runId = typeof run?.id === "string" ? run.id : null;

  const report = await runScheduledSync({
    now: () => new Date(),
    listTargets: () => listTargets(supabase),
    syncOne: async (target) => {
      const jobId = await claimJob(supabase, target);
      // NULL means another scheduled/manual/public worker already owns an
      // active job for this document. Skip without running a second pipeline.
      if (jobId === null) return "unchanged";

      await updateRows(supabase, "content_sync_jobs", `id=eq.${encodeURIComponent(jobId)}`, {
        status: "running",
        started_at: new Date().toISOString(),
      });

      // The scheduled path has no human at call time. It rides the document's
      // link owner (the latest attributed job for this entity), never an
      // implicit shared token.
      const jobRows = await selectRows(
        supabase,
        "content_sync_jobs",
        `select=requested_by&id=eq.${encodeURIComponent(jobId)}&limit=1`,
      );
      const requestedBy =
        typeof jobRows[0]?.requested_by === "string" ? (jobRows[0].requested_by as string) : null;

      try {
        const result = await runServerGoogleSync(
          { supabase, googleEnv: process.env },
          {
            kind: target.kind,
            entityId: target.entityId,
            locale: target.locale as never,
            fileId: target.fileId,
            mode: "apply",
            requestedBy,
          },
        );

        if (result.status === "synced") {
          await updateRows(supabase, "content_sync_jobs", `id=eq.${encodeURIComponent(jobId)}`, {
            status: "succeeded",
            entity_id: result.entityId,
            summary: result.summary,
            finished_at: new Date().toISOString(),
          });
          await recordCheck(supabase, target, true);
          return "updated";
        }
        if (result.status === "unchanged") {
          await updateRows(supabase, "content_sync_jobs", `id=eq.${encodeURIComponent(jobId)}`, {
            status: "unchanged",
            finished_at: new Date().toISOString(),
          });
          await recordCheck(supabase, target, true);
          return "unchanged";
        }

        await updateRows(supabase, "content_sync_jobs", `id=eq.${encodeURIComponent(jobId)}`, {
          status: result.status === "blocked" ? "blocked" : "failed",
          error_code: result.status === "failed" ? result.error : null,
          finished_at: new Date().toISOString(),
        });
        await recordCheck(supabase, target, false);
        return "failed";
      } catch {
        await updateRows(supabase, "content_sync_jobs", `id=eq.${encodeURIComponent(jobId)}`, {
          status: "failed",
          error_code: "sync-failed",
          finished_at: new Date().toISOString(),
        });
        await recordCheck(supabase, target, false);
        return "failed";
      }
    },
  });

  if (runId !== null) {
    await updateRows(supabase, "content_sync_runs", `id=eq.${encodeURIComponent(runId)}`, {
      finished_at: report.finishedAt,
      checked: report.checked,
      updated: report.updated,
      failed: report.failed,
      skipped: report.skipped,
    });
  }

  // Function logs only: counts and timestamps, never credentials or content.
  console.log(
    JSON.stringify({
      event: "content_sync_scheduled",
      ...report,
    }),
  );

  return new Response(JSON.stringify({ ok: true, ...report }), {
    status: 200,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
