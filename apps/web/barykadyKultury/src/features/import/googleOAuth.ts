import { GOOGLE_DRIVE_FILE_SCOPE } from "./googleCredentials";
import { GOOGLE_TOKEN_TIMEOUT_MS, withAbortTimeout } from "./timeouts";

/**
 * D-41 — per-admin Google OAuth handshake.
 *
 * Only `drive.file` is requested: the Picker gestures the per-file grant and no
 * restricted scope (`drive`, `drive.readonly`) ever appears in the consent
 * screen. `access_type=offline` + `prompt=consent` make sure a re-consent issues
 * a fresh refresh token for the vault (Google may omit it otherwise).
 */
export const GOOGLE_AUTH_ENDPOINT =
  "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
export const GOOGLE_REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";

export interface GoogleOAuthConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
}

export interface GoogleOAuthToken {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: number;
  readonly scope: string | null;
}

export type GoogleRefreshResult =
  | { readonly ok: true; readonly accessToken: string }
  | {
      readonly ok: false;
      readonly reason: "invalid_grant" | "unavailable";
    };

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

/** URL-safe, cryptographically random state for the OAuth round trip. */
export function createOAuthState(): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export function buildGoogleAuthUrl(
  config: GoogleOAuthConfig,
  options: {
    readonly state: string;
    readonly loginHint?: string | null;
    readonly forceConsent?: boolean;
  }
): string {
  const url = new URL(GOOGLE_AUTH_ENDPOINT);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_DRIVE_FILE_SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("include_granted_scopes", "true");
  // Re-consent must return a refresh token even after a prior grant.
  url.searchParams.set(
    "prompt",
    options.forceConsent === false ? "select_account" : "consent"
  );
  url.searchParams.set("state", options.state);
  if (options.loginHint !== undefined && options.loginHint !== null) {
    url.searchParams.set("login_hint", options.loginHint);
  }
  return url.toString();
}

function readRecord(payload: unknown): Record<string, unknown> | null {
  return typeof payload === "object" && payload !== null
    ? (payload as Record<string, unknown>)
    : null;
}

export async function exchangeAuthorizationCode(
  config: GoogleOAuthConfig,
  code: string,
  fetchImpl: typeof fetch,
  timeoutMs: number = GOOGLE_TOKEN_TIMEOUT_MS
): Promise<GoogleOAuthToken | null> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    code
  }).toString();

  return withAbortTimeout("token-timeout", timeoutMs, async signal => {
    const response = await fetchImpl(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal
    });
    if (!response.ok) return null;

    const record = readRecord(await response.json());
    if (record === null) return null;
    const accessToken = record.access_token;
    const refreshToken = record.refresh_token;
    if (
      typeof accessToken !== "string" ||
      accessToken === "" ||
      typeof refreshToken !== "string" ||
      refreshToken === ""
    ) {
      // No refresh token means no durable vault entry; force a new consent.
      return null;
    }
    const expiresIn =
      typeof record.expires_in === "number" && record.expires_in > 0
        ? record.expires_in
        : 3600;
    return {
      accessToken,
      refreshToken,
      expiresAt: Date.now() + expiresIn * 1000,
      scope:
        typeof record.scope === "string" && record.scope !== ""
          ? record.scope
          : null
    };
  });
}

export async function refreshAccessToken(
  config: GoogleOAuthConfig,
  refreshToken: string,
  fetchImpl: typeof fetch,
  timeoutMs: number = GOOGLE_TOKEN_TIMEOUT_MS
): Promise<GoogleRefreshResult> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken
  }).toString();

  return withAbortTimeout("token-timeout", timeoutMs, async signal => {
    const response = await fetchImpl(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal
    });
    const record = readRecord(await response.json().catch(() => null));

    if (record?.error === "invalid_grant") {
      return { ok: false, reason: "invalid_grant" } as const;
    }
    if (!response.ok) {
      return { ok: false, reason: "unavailable" } as const;
    }
    const accessToken = record?.access_token;
    if (typeof accessToken !== "string" || accessToken === "") {
      return { ok: false, reason: "unavailable" } as const;
    }
    return { ok: true, accessToken } as const;
  });
}

/** Revokes a stored refresh token when an admin disconnects. */
export async function revokeToken(
  token: string,
  fetchImpl: typeof fetch,
  timeoutMs: number = GOOGLE_TOKEN_TIMEOUT_MS
): Promise<boolean> {
  return withAbortTimeout("token-timeout", timeoutMs, async signal => {
    const url = new URL(GOOGLE_REVOKE_ENDPOINT);
    url.searchParams.set("token", token);
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      signal
    });
    return response.ok;
  });
}
