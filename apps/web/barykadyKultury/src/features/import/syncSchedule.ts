/**
 * T-042 S9 — nightly freshness run.
 *
 * Reuses the S7 metadata/sync pipeline for every Google-backed row. The run is
 * bounded to three concurrent documents (Drive quota), isolates each document's
 * failure, and respects the same 15-minute/backoff throttle as the public
 * check. The manual admin "Sync now" remains an override.
 */

export const SYNC_CHECK_BASE_MINUTES = 15;
export const SYNC_CHECK_MAX_BACKOFF_MINUTES = 24 * 60;
export const SYNC_SCHEDULE_CONCURRENCY = 3;

export interface ScheduledSyncTarget {
  readonly kind: "document" | "publication";
  readonly entityId: string;
  readonly fileId: string;
  readonly locale: string;
  readonly lastCheckedAt: string | null;
  readonly failures: number;
}

export type ScheduledSyncOutcome = "updated" | "unchanged" | "failed";

export interface ScheduledSyncReport {
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly checked: number;
  readonly updated: number;
  readonly failed: number;
  readonly skipped: number;
}

export interface ScheduledSyncDependencies {
  readonly listTargets: () => Promise<readonly ScheduledSyncTarget[]>;
  readonly syncOne: (
    target: ScheduledSyncTarget
  ) => Promise<ScheduledSyncOutcome>;
  readonly now: () => Date;
  readonly concurrency?: number;
}

function timeMs(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

/** Exponential backoff capped at one day; success resets failures to 0. */
export function checkIntervalMinutes(
  failures: number,
  baseMinutes: number = SYNC_CHECK_BASE_MINUTES
): number {
  const safeFailures = Math.max(0, Math.min(6, Math.trunc(failures)));
  return Math.min(
    SYNC_CHECK_MAX_BACKOFF_MINUTES,
    baseMinutes * 2 ** safeFailures
  );
}

export function shouldCheck(
  lastCheckedAt: string | null,
  failures: number,
  now: Date,
  baseMinutes: number = SYNC_CHECK_BASE_MINUTES
): boolean {
  const checked = timeMs(lastCheckedAt);
  if (checked === null) return true;
  return (
    now.getTime() - checked >=
    checkIntervalMinutes(failures, baseMinutes) * 60_000
  );
}

function clampConcurrency(value: number): number {
  return Math.max(1, Math.min(SYNC_SCHEDULE_CONCURRENCY, Math.trunc(value)));
}

export async function runScheduledSync(
  dependencies: ScheduledSyncDependencies
): Promise<ScheduledSyncReport> {
  const started = dependencies.now();
  let targets: readonly ScheduledSyncTarget[];
  try {
    targets = await dependencies.listTargets();
  } catch {
    targets = [];
  }

  let checked = 0;
  let updated = 0;
  let failed = 0;
  let skipped = 0;
  let index = 0;

  const concurrency = clampConcurrency(
    dependencies.concurrency ?? SYNC_SCHEDULE_CONCURRENCY
  );

  async function worker(): Promise<void> {
    while (index < targets.length) {
      const current = targets[index];
      index += 1;
      if (current === undefined) return;

      if (!shouldCheck(current.lastCheckedAt, current.failures, started)) {
        skipped += 1;
        continue;
      }

      checked += 1;
      try {
        const outcome = await dependencies.syncOne(current);
        if (outcome === "updated") updated += 1;
        if (outcome === "failed") failed += 1;
      } catch {
        // One document's failure must never stop the run or the other workers.
        failed += 1;
      }
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, Math.max(1, targets.length)) },
      () => worker()
    )
  );

  return {
    startedAt: started.toISOString(),
    finishedAt: dependencies.now().toISOString(),
    checked,
    updated,
    failed,
    skipped
  };
}
