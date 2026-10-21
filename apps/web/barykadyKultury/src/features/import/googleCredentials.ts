/**
 * T-042 / D-31 — Google credential resolver (server-side only).
 *
 * Two supported modes:
 * - `oauth_admin` (default): per-admin OAuth refresh token, least-privilege
 *   `drive.file` scope. No `drive.readonly`/`documents.readonly`.
 * - `service_account`: Workspace shared-drive export, long-lived key managed by
 *   the organisation.
 *
 * This module never logs, returns tokens to a page, or reads `import.meta.env`.
 * The Netlify binding passes `process.env`; tests pass explicit fake objects.
 * Private keys are normalised in memory only (escaped newlines from env).
 */

export const GOOGLE_DRIVE_FILE_SCOPE =
  "https://www.googleapis.com/auth/drive.file";

export const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

export type GoogleAuthMode = "oauth_admin" | "service_account";

export interface GoogleCredentialEnv {
  readonly GOOGLE_IMPORT_AUTH_MODE?: string | undefined;
  readonly GOOGLE_OAUTH_CLIENT_ID?: string | undefined;
  readonly GOOGLE_OAUTH_CLIENT_SECRET?: string | undefined;
  readonly GOOGLE_OAUTH_REFRESH_TOKEN?: string | undefined;
  readonly GOOGLE_SERVICE_ACCOUNT_EMAIL?: string | undefined;
  readonly GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?: string | undefined;
  readonly GOOGLE_SHARED_DRIVE_ID?: string | undefined;
}

export type ResolvedGoogleCredentials =
  | {
      readonly mode: "oauth_admin";
      readonly clientId: string;
      readonly clientSecret: string;
      readonly refreshToken: string;
      readonly scope: typeof GOOGLE_DRIVE_FILE_SCOPE;
    }
  | {
      readonly mode: "service_account";
      readonly clientEmail: string;
      readonly privateKey: string;
      readonly sharedDriveId: string | null;
      readonly scope: typeof GOOGLE_DRIVE_FILE_SCOPE;
    };

export type GoogleCredentialsUnavailableReason =
  | "missing_config"
  | "unsupported_mode";

export interface GoogleCredentialsUnavailable {
  readonly mode: "unavailable";
  readonly reason: GoogleCredentialsUnavailableReason;
}

export type GoogleCredentialResolution =
  | ResolvedGoogleCredentials
  | GoogleCredentialsUnavailable;

function nonEmpty(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}

export function resolveGoogleCredentials(
  env: GoogleCredentialEnv
): GoogleCredentialResolution {
  const requested = nonEmpty(env.GOOGLE_IMPORT_AUTH_MODE) ?? "oauth_admin";
  if (requested !== "oauth_admin" && requested !== "service_account") {
    return { mode: "unavailable", reason: "unsupported_mode" };
  }

  if (requested === "service_account") {
    const clientEmail = nonEmpty(env.GOOGLE_SERVICE_ACCOUNT_EMAIL);
    const privateKey = nonEmpty(env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY);
    if (clientEmail === null || privateKey === null) {
      return { mode: "unavailable", reason: "missing_config" };
    }
    return {
      mode: "service_account",
      clientEmail,
      privateKey: privateKey.replaceAll("\\n", "\n"),
      sharedDriveId: nonEmpty(env.GOOGLE_SHARED_DRIVE_ID),
      scope: GOOGLE_DRIVE_FILE_SCOPE
    };
  }

  const clientId = nonEmpty(env.GOOGLE_OAUTH_CLIENT_ID);
  const clientSecret = nonEmpty(env.GOOGLE_OAUTH_CLIENT_SECRET);
  const refreshToken = nonEmpty(env.GOOGLE_OAUTH_REFRESH_TOKEN);
  if (clientId === null || clientSecret === null || refreshToken === null) {
    return { mode: "unavailable", reason: "missing_config" };
  }

  return {
    mode: "oauth_admin",
    clientId,
    clientSecret,
    refreshToken,
    scope: GOOGLE_DRIVE_FILE_SCOPE
  };
}

export interface GoogleAccessToken {
  readonly accessToken: string;
  /** Epoch milliseconds; the caller refreshes before expiry. */
  readonly expiresAt: number;
}

export interface GoogleTokenRequest {
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
}

export type GoogleTokenFetch = (
  request: GoogleTokenRequest
) => Promise<unknown>;

export interface ServiceAccountSigner {
  readonly sign: (data: Uint8Array) => Promise<Uint8Array>;
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function textBase64Url(value: string): string {
  return base64Url(new TextEncoder().encode(value));
}

function pemToBytes(pem: string): Uint8Array {
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/gu, "")
    .replace(/-----END PRIVATE KEY-----/gu, "")
    .replace(/\s+/gu, "");
  const binary = atob(base64);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

async function defaultServiceAccountSigner(
  privateKey: string
): Promise<ServiceAccountSigner> {
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToBytes(privateKey) as BufferSource,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  return {
    sign: async data =>
      new Uint8Array(
        await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, data as BufferSource)
      )
  };
}

/**
 * Builds the JWT assertion used by the service-account OAuth flow. The signer
 * is injectable so tests never need a real private key.
 */
export async function createServiceAccountAssertion(
  credentials: Extract<ResolvedGoogleCredentials, { mode: "service_account" }>,
  now: Date,
  signer?: ServiceAccountSigner
): Promise<string> {
  const resolvedSigner =
    signer ?? (await defaultServiceAccountSigner(credentials.privateKey));
  const issuedAt = Math.floor(now.getTime() / 1000);

  const header = textBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = textBase64Url(
    JSON.stringify({
      iss: credentials.clientEmail,
      scope: credentials.scope,
      aud: GOOGLE_TOKEN_ENDPOINT,
      iat: issuedAt,
      exp: issuedAt + 3600
    })
  );
  const unsigned = `${header}.${claim}`;
  const signature = await resolvedSigner.sign(
    new TextEncoder().encode(unsigned)
  );
  return `${unsigned}.${base64Url(signature)}`;
}

function readTokenResponse(payload: unknown): GoogleAccessToken | null {
  if (typeof payload !== "object" || payload === null) return null;
  const record = payload as {
    access_token?: unknown;
    expires_in?: unknown;
  };
  if (typeof record.access_token !== "string" || record.access_token === "") {
    return null;
  }
  const expiresIn =
    typeof record.expires_in === "number" && record.expires_in > 0
      ? record.expires_in
      : 3600;
  return {
    accessToken: record.access_token,
    expiresAt: Date.now() + expiresIn * 1000
  };
}

/**
 * Exchanges the resolved credential for an access token. The request body is
 * built here and passed to an injected fetch; the caller must never log the
 * request or the returned token.
 */
export async function exchangeGoogleCredentials(
  credentials: ResolvedGoogleCredentials,
  tokenFetch: GoogleTokenFetch,
  options: {
    readonly now?: () => Date;
    readonly signer?: ServiceAccountSigner;
  } = {}
): Promise<GoogleAccessToken | null> {
  const now = (options.now ?? (() => new Date()))();

  if (credentials.mode === "oauth_admin") {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      refresh_token: credentials.refreshToken
    }).toString();

    const payload = await tokenFetch({
      url: GOOGLE_TOKEN_ENDPOINT,
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body
    });
    return readTokenResponse(payload);
  }

  const assertion = await createServiceAccountAssertion(
    credentials,
    now,
    options.signer
  );
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion
  }).toString();

  const payload = await tokenFetch({
    url: GOOGLE_TOKEN_ENDPOINT,
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body
  });
  return readTokenResponse(payload);
}

/** Safe diagnostics only: never contains a token, key or client secret. */
export function describeGoogleCredentialMode(
  resolution: GoogleCredentialResolution
): { readonly mode: GoogleAuthMode | "unavailable"; readonly scope: string } {
  return resolution.mode === "unavailable"
    ? { mode: "unavailable", scope: GOOGLE_DRIVE_FILE_SCOPE }
    : { mode: resolution.mode, scope: resolution.scope };
}
