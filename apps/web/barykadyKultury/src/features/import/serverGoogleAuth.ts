import { resolveVaultAccessToken } from "./googleConnections";
import {
  exchangeGoogleCredentials,
  resolveGoogleAuthStrategy,
  type GoogleCredentialEnv,
  type GoogleTokenFetch
} from "./googleCredentials";
import type { GoogleSyncErrorCode } from "./googleSync";
import type { ServerSupabaseConfig } from "./serverSupabase";
import { ExternalCallTimeoutError } from "./timeouts";

/**
 * T-042 re-gate — the single server-side credential resolver.
 *
 * Before this module, `content-check.ts` and `serverGoogleSync.ts` each branched
 * over the same three auth strategies. The duplicated env branch is exactly
 * where the deprecated mode could silently skip the shared-folder constraint.
 * One resolver now owns:
 * - strategy selection (per-admin vault / service account / deprecated env),
 * - the shared-folder precondition for EVERY mode,
 * - token exchange and its coded timeout.
 *
 * Callers receive `{accessToken, sharedFolderId, requestedBy}` and cannot
 * construct a Drive client without a folder id.
 */
export interface ServerGoogleAuthConfig {
  readonly supabase: ServerSupabaseConfig;
  readonly googleEnv: GoogleCredentialEnv;
  readonly fetchImpl?: typeof fetch;
}

export interface ServerGoogleAuthParams {
  /** Link owner. Required for per-admin OAuth; ignored by server-owned modes. */
  readonly requestedBy?: string | null;
}

export type ServerGoogleAuthResult =
  | {
      readonly ok: true;
      readonly accessToken: string;
      readonly sharedFolderId: string;
      readonly requestedBy: string | null;
    }
  | {
      readonly ok: false;
      readonly error: GoogleSyncErrorCode;
      readonly detail?: string;
    };

export interface GooglePickerSession {
  readonly accessToken: string;
  readonly folderId: string;
  readonly appId: string | null;
  readonly developerKey: string | null;
}

export type GooglePickerSessionResult =
  | { readonly ok: true; readonly session: GooglePickerSession }
  | {
      readonly ok: false;
      readonly error: GoogleSyncErrorCode | "picker-unavailable";
      readonly detail?: string;
    };

function nonEmpty(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}

function tokenFetch(fetchImpl: typeof fetch): GoogleTokenFetch {
  return async request => {
    const response = await fetchImpl(request.url, {
      method: "POST",
      headers: request.headers,
      body: request.body,
      ...(request.signal !== undefined ? { signal: request.signal } : {})
    });
    if (!response.ok) return null;
    return response.json();
  };
}

export async function resolveServerGoogleAuth(
  config: ServerGoogleAuthConfig,
  params: ServerGoogleAuthParams = {}
): Promise<ServerGoogleAuthResult> {
  const strategy = resolveGoogleAuthStrategy(config.googleEnv);
  if (strategy.mode === "unavailable") {
    return {
      ok: false,
      error: "credentials-unavailable",
      detail: strategy.reason
    };
  }

  // D-41: the folder is a hard precondition in every mode. The deprecated env
  // token is a dev/demo convenience, not an exemption from the constraint.
  if (strategy.sharedFolderId === null) {
    return { ok: false, error: "folder-not-configured" };
  }

  const requestedBy = params.requestedBy?.trim() || null;
  const fetchImpl = config.fetchImpl ?? fetch;

  try {
    if (strategy.mode === "per_admin_oauth") {
      if (requestedBy === null) {
        return {
          ok: false,
          error: "credentials-unavailable",
          detail: "requested-by-missing"
        };
      }
      const vault = await resolveVaultAccessToken(
        {
          supabase: config.supabase,
          encryptionKey: config.googleEnv.GOOGLE_TOKEN_ENCRYPTION_KEY,
          oauth: {
            clientId: strategy.clientId,
            clientSecret: strategy.clientSecret,
            redirectUri: config.googleEnv.GOOGLE_OAUTH_REDIRECT_URI ?? ""
          }
        },
        requestedBy
      );
      if (!vault.ok) {
        if (vault.reason === "reconnect-required") {
          return { ok: false, error: "reconnect-required" };
        }
        return {
          ok: false,
          error: "credentials-unavailable",
          detail: vault.reason
        };
      }
      return {
        ok: true,
        accessToken: vault.accessToken,
        sharedFolderId: strategy.sharedFolderId,
        requestedBy
      };
    }

    const credentials =
      strategy.mode === "service_account"
        ? {
            mode: "service_account" as const,
            clientEmail: strategy.clientEmail,
            privateKey: strategy.privateKey,
            sharedDriveId: strategy.sharedDriveId,
            scope: strategy.scope
          }
        : {
            mode: "oauth_admin" as const,
            clientId: strategy.clientId,
            clientSecret: strategy.clientSecret,
            refreshToken: strategy.refreshToken,
            scope: strategy.scope
          };
    const token = await exchangeGoogleCredentials(
      credentials,
      tokenFetch(fetchImpl)
    );
    if (token === null) {
      return { ok: false, error: "credentials-unavailable" };
    }
    return {
      ok: true,
      accessToken: token.accessToken,
      sharedFolderId: strategy.sharedFolderId,
      requestedBy
    };
  } catch (error) {
    if (error instanceof ExternalCallTimeoutError) {
      return { ok: false, error: "token-timeout" };
    }
    throw error;
  }
}

/**
 * The Picker needs a short-lived OAuth access token in the browser. Refresh
 * tokens and the encryption key never leave the server. The Picker is only
 * meaningful for per-admin consent: service-account/env modes have no user
 * gesture, so the admin page keeps the manual URL/ID fallback for those.
 */
export async function resolveServerGooglePicker(
  config: ServerGoogleAuthConfig,
  params: ServerGoogleAuthParams = {}
): Promise<GooglePickerSessionResult> {
  const strategy = resolveGoogleAuthStrategy(config.googleEnv);
  if (strategy.mode !== "per_admin_oauth") {
    return { ok: false, error: "picker-unavailable" };
  }
  // Google's Picker requires a project/app id and a browser API key. Without
  // them the correct behaviour is the manual fallback, not a half-open widget.
  const appId = nonEmpty(config.googleEnv.GOOGLE_PICKER_APP_ID);
  const developerKey = nonEmpty(config.googleEnv.GOOGLE_PICKER_API_KEY);
  if (appId === null || developerKey === null) {
    return { ok: false, error: "picker-unavailable" };
  }
  const auth = await resolveServerGoogleAuth(config, params);
  if (!auth.ok) return auth;
  return {
    ok: true,
    session: {
      accessToken: auth.accessToken,
      folderId: auth.sharedFolderId,
      appId,
      developerKey
    }
  };
}
