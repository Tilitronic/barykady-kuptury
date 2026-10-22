/**
 * T-042 review fix — bounded external calls.
 *
 * Every Google hop (token exchange, Drive metadata, Drive export) gets its own
 * AbortController and its own stable code. The codes are persisted in
 * `content_sync_jobs.error_code`, so the admin UI can tell a slow token refresh
 * from a slow export without parsing provider text.
 */
export type ExternalTimeoutCode =
  | "token-timeout"
  | "drive-metadata-timeout"
  | "drive-export-timeout";

export class ExternalCallTimeoutError extends Error {
  readonly code: ExternalTimeoutCode;

  constructor(code: ExternalTimeoutCode) {
    super(`External call timed out (${code})`);
    this.name = "ExternalCallTimeoutError";
    this.code = code;
  }
}

export const GOOGLE_TOKEN_TIMEOUT_MS = 10_000;
export const GOOGLE_DRIVE_TIMEOUT_MS = 20_000;

/**
 * Runs `operation` with an abort signal and rejects with a coded timeout after
 * `timeoutMs`. The timer is always cleared, so a fast response never leaves a
 * dangling handle behind in a Netlify warm container.
 */
export async function withAbortTimeout<T>(
  code: ExternalTimeoutCode,
  timeoutMs: number,
  operation: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new ExternalCallTimeoutError(code));
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation(controller.signal), timeout]);
  } catch (error) {
    if (error instanceof ExternalCallTimeoutError) throw error;
    if (controller.signal.aborted) throw new ExternalCallTimeoutError(code);
    throw error;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
