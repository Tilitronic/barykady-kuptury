/**
 * T-042 S9 — public stale-while-revalidate check.
 *
 * The reader has already rendered the stored copy. This endpoint only reads
 * Drive metadata for one published Google-backed row and, when the upstream
 * modifiedTime is newer than the stored sync marker, enqueues the same S7 job
 * (single-flight). It never returns source paths, credentials or content.
 *
 * Throttle/backoff live in `claim_content_check_v1` (atomic, service-role
 * only); the handler only maps the outcome.
 */

export type ContentCheckKind = "document" | "publication";

export interface ContentCheckTarget {
  readonly entityId: string;
  readonly kind: ContentCheckKind;
  readonly fileId: string;
  readonly locale: string;
  readonly sourceSyncedAt: string | null;
  readonly sourceModifiedAt: string | null;
}

export type ClaimOutcome = "checked" | "throttled" | "not-found" | "not-google";

export interface ClaimResult {
  readonly outcome: ClaimOutcome;
  readonly target?: ContentCheckTarget;
}

export interface ContentCheckDependencies {
  readonly claimCheck: (
    kind: ContentCheckKind,
    slug: string
  ) => Promise<ClaimResult>;
  readonly getModifiedTime: (fileId: string) => Promise<string | null>;
  readonly enqueueSync: (target: ContentCheckTarget) => Promise<string | null>;
  readonly recordSuccess: (target: ContentCheckTarget) => Promise<void>;
  readonly recordFailure: (target: ContentCheckTarget) => Promise<void>;
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const CONTENT_CHECK_BASE_INTERVAL_MINUTES = 15;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function parseKind(value: string | null): ContentCheckKind | null {
  return value === "document" || value === "publication" ? value : null;
}

function timeMs(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function isDriveNewer(
  modifiedTime: string,
  sourceSyncedAt: string | null,
  sourceModifiedAt: string | null
): boolean {
  const drive = timeMs(modifiedTime);
  if (drive === null) return false;
  const stored = timeMs(sourceModifiedAt) ?? timeMs(sourceSyncedAt);
  return stored === null ? true : drive > stored;
}

export function createContentCheckHandler(
  dependencies: ContentCheckDependencies
): (request: Request) => Promise<Response> {
  return async request => {
    if (request.method.toUpperCase() !== "GET") {
      return json({ error: "method_not_allowed" }, 405);
    }

    const url = new URL(request.url);
    const kind = parseKind(url.searchParams.get("kind"));
    const slug = url.searchParams.get("slug")?.trim() ?? "";
    if (kind === null || !SLUG_PATTERN.test(slug)) {
      return json({ error: "invalid_request" }, 400);
    }

    let claim: ClaimResult;
    try {
      claim = await dependencies.claimCheck(kind, slug);
    } catch {
      return json({ updateAvailable: false });
    }

    if (claim.outcome !== "checked" || claim.target === undefined) {
      return json({ updateAvailable: false });
    }

    const target = claim.target;
    let modifiedTime: string | null;
    try {
      modifiedTime = await dependencies.getModifiedTime(target.fileId);
    } catch {
      await dependencies.recordFailure(target);
      return json({ updateAvailable: false });
    }

    if (modifiedTime === null) {
      await dependencies.recordFailure(target);
      return json({ updateAvailable: false });
    }

    await dependencies.recordSuccess(target);

    if (
      !isDriveNewer(
        modifiedTime,
        target.sourceSyncedAt,
        target.sourceModifiedAt
      )
    ) {
      return json({ updateAvailable: false });
    }

    let jobId: string | null;
    try {
      jobId = await dependencies.enqueueSync(target);
    } catch {
      return json({ updateAvailable: false });
    }

    return json({ updateAvailable: true, jobId });
  };
}
