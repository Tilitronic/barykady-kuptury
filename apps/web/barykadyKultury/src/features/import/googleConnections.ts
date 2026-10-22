import { refreshAccessToken, type GoogleOAuthConfig } from "./googleOAuth";
import {
  callServiceRpc,
  deleteRows,
  insertRows,
  selectRows,
  updateRows,
  upsertRows,
  type AdminIdentity,
  type ServerSupabaseConfig
} from "./serverSupabase";
import { decryptSecret, encryptSecret } from "./tokenVault";

/**
 * D-41 — per-admin Google connection lifecycle.
 *
 * The table is the service-role half of the vault: RLS lets an admin read their
 * own metadata row, while the encrypted refresh-token column is only granted to
 * service_role. This module is imported by Netlify functions only and never by
 * a public route.
 *
 * The acting admin is resolved by the email in the verified JWT (T-046's
 * pre-provisioned roster is consumed, not rebuilt here). Connections are keyed
 * by that user id, so a token can never be attached to a different person.
 */
export type ConsentStatus = "connected" | "reconsent_required";

export interface ActingAdmin {
  readonly id: string;
  readonly email: string;
}

export interface GoogleConnectionRow {
  readonly userId: string;
  readonly googleEmail: string | null;
  readonly refreshToken: string;
  readonly scope: string;
  readonly consentStatus: ConsentStatus;
  readonly connectedAt: string;
  readonly updatedAt: string;
  readonly lastUsedAt: string | null;
}

export interface GoogleConnectionSummary {
  readonly connected: boolean;
  readonly googleEmail: string | null;
  readonly consentStatus: ConsentStatus;
  readonly connectedAt: string | null;
}

export interface GoogleConnectionConfig {
  readonly supabase: ServerSupabaseConfig;
  readonly encryptionKey: string | undefined;
  readonly oauth: GoogleOAuthConfig;
}

export type VaultTokenResult =
  | { readonly ok: true; readonly accessToken: string }
  | {
      readonly ok: false;
      readonly reason:
        | "connection-missing"
        | "reconnect-required"
        | "encryption-unavailable"
        | "unavailable";
    };

interface RawConnectionRow {
  readonly user_id?: unknown;
  readonly google_email?: unknown;
  readonly refresh_token_ciphertext?: unknown;
  readonly scope?: unknown;
  readonly consent_status?: unknown;
  readonly connected_at?: unknown;
  readonly updated_at?: unknown;
  readonly last_used_at?: unknown;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function consentStatus(value: unknown): ConsentStatus {
  return value === "reconsent_required" ? "reconsent_required" : "connected";
}

function mapRaw(row: RawConnectionRow): {
  readonly userId: string;
  readonly googleEmail: string | null;
  readonly ciphertext: string;
  readonly scope: string;
  readonly consentStatus: ConsentStatus;
  readonly connectedAt: string;
  readonly updatedAt: string;
  readonly lastUsedAt: string | null;
} | null {
  const userId = stringValue(row.user_id);
  const ciphertext = stringValue(row.refresh_token_ciphertext);
  if (userId === null || ciphertext === null) return null;
  return {
    userId,
    googleEmail: stringValue(row.google_email),
    ciphertext,
    scope:
      stringValue(row.scope) ?? "https://www.googleapis.com/auth/drive.file",
    consentStatus: consentStatus(row.consent_status),
    connectedAt: stringValue(row.connected_at) ?? "",
    updatedAt: stringValue(row.updated_at) ?? "",
    lastUsedAt: stringValue(row.last_used_at)
  };
}

const CONNECTION_COLUMNS =
  "user_id,google_email,refresh_token_ciphertext,scope,consent_status,connected_at,updated_at,last_used_at";

async function fetchRawConnection(
  config: ServerSupabaseConfig,
  userId: string
): Promise<RawConnectionRow | null> {
  const rows = await selectRows(
    config,
    "google_connections",
    `select=${CONNECTION_COLUMNS}&user_id=eq.${encodeURIComponent(userId)}&limit=1`
  );
  return (rows[0] as RawConnectionRow | undefined) ?? null;
}

/** True only when the verified JWT carries a usable roster email. */
export function resolveActingAdmin(
  identity: AdminIdentity | null
): ActingAdmin | null {
  if (identity === null) return null;
  const email = identity.email?.trim().toLowerCase() ?? "";
  if (email === "" || identity.id.trim() === "") return null;
  return { id: identity.id, email };
}

export async function encryptConnectionToken(
  refreshToken: string,
  encryptionKey: string | undefined,
  userId: string
): Promise<string | null> {
  return encryptSecret(refreshToken, encryptionKey, userId);
}

export async function saveGoogleConnection(
  config: ServerSupabaseConfig,
  input: {
    readonly userId: string;
    readonly refreshToken: string;
    readonly scope: string;
    readonly googleEmail?: string | null;
    readonly encryptionKey: string | undefined;
  }
): Promise<boolean> {
  const ciphertext = await encryptConnectionToken(
    input.refreshToken,
    input.encryptionKey,
    input.userId
  );
  if (ciphertext === null) return false;

  const row = await upsertRows(
    config,
    "google_connections",
    {
      user_id: input.userId,
      google_email: input.googleEmail ?? null,
      refresh_token_ciphertext: ciphertext,
      scope: input.scope,
      consent_status: "connected",
      revoked_at: null,
      updated_at: new Date().toISOString()
    },
    "user_id"
  );
  return row !== null;
}

export async function readGoogleConnection(
  config: ServerSupabaseConfig,
  userId: string,
  encryptionKey: string | undefined
): Promise<GoogleConnectionRow | null> {
  const raw = await fetchRawConnection(config, userId);
  if (raw === null) return null;
  const mapped = mapRaw(raw);
  if (mapped === null) return null;
  const refreshToken = await decryptSecret(
    mapped.ciphertext,
    encryptionKey,
    userId
  );
  if (refreshToken === null) return null;
  return {
    userId: mapped.userId,
    googleEmail: mapped.googleEmail,
    refreshToken,
    scope: mapped.scope,
    consentStatus: mapped.consentStatus,
    connectedAt: mapped.connectedAt,
    updatedAt: mapped.updatedAt,
    lastUsedAt: mapped.lastUsedAt
  };
}

export async function getGoogleConnectionSummary(
  config: ServerSupabaseConfig,
  userId: string
): Promise<GoogleConnectionSummary | null> {
  const raw = await fetchRawConnection(config, userId);
  if (raw === null) return null;
  const mapped = mapRaw(raw);
  if (mapped === null) return null;
  return {
    connected: mapped.consentStatus === "connected",
    googleEmail: mapped.googleEmail,
    consentStatus: mapped.consentStatus,
    connectedAt: mapped.connectedAt === "" ? null : mapped.connectedAt
  };
}

export async function markGoogleConnectionReconsent(
  config: ServerSupabaseConfig,
  userId: string
): Promise<void> {
  await updateRows(
    config,
    "google_connections",
    `user_id=eq.${encodeURIComponent(userId)}`,
    { consent_status: "reconsent_required" }
  );
}

export async function deleteGoogleConnection(
  config: ServerSupabaseConfig,
  userId: string
): Promise<boolean> {
  return deleteRows(
    config,
    "google_connections",
    `user_id=eq.${encodeURIComponent(userId)}`
  );
}

export async function saveOAuthState(
  config: ServerSupabaseConfig,
  state: string,
  userId: string,
  ttlSeconds = 600
): Promise<boolean> {
  const row = await insertRows(config, "google_oauth_states", {
    state,
    user_id: userId,
    expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString()
  });
  return row !== null;
}

/**
 * Consumes a one-time OAuth state atomically.
 *
 * A SELECT-then-DELETE pair has a replay window between the two statements.
 * The RPC performs a single `DELETE ... WHERE state = $1 AND expires_at > now()
 * RETURNING user_id`; exactly one concurrent caller can observe the row.
 */
export async function consumeOAuthState(
  config: ServerSupabaseConfig,
  state: string
): Promise<string | null> {
  const trimmed = state.trim();
  if (trimmed === "") return null;
  const payload = await callServiceRpc(
    config,
    "consume_google_oauth_state_v1",
    { p_state: trimmed }
  );
  return typeof payload === "string" && payload !== "" ? payload : null;
}

/**
 * Resolves the acting admin's stored refresh token and exchanges it for a
 * short-lived access token. A revoked grant flips the row to
 * `reconsent_required`, so the admin sees an actionable message and the last
 * published copy is never touched.
 */
export async function resolveVaultAccessToken(
  config: GoogleConnectionConfig,
  userId: string
): Promise<VaultTokenResult> {
  const connection = await readGoogleConnection(
    config.supabase,
    userId,
    config.encryptionKey
  );
  if (connection === null) {
    const raw = await fetchRawConnection(config.supabase, userId);
    if (raw === null) return { ok: false, reason: "connection-missing" };
    if (consentStatus(raw.consent_status) !== "connected") {
      return { ok: false, reason: "reconnect-required" };
    }
    return { ok: false, reason: "encryption-unavailable" };
  }
  if (connection.consentStatus !== "connected") {
    return { ok: false, reason: "reconnect-required" };
  }

  const result = await refreshAccessToken(
    config.oauth,
    connection.refreshToken,
    config.supabase.fetchImpl ?? fetch
  );
  if (!result.ok) {
    if (result.reason === "invalid_grant") {
      await markGoogleConnectionReconsent(config.supabase, userId);
      return { ok: false, reason: "reconnect-required" };
    }
    return { ok: false, reason: "unavailable" };
  }
  return { ok: true, accessToken: result.accessToken };
}
