import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../types/database.types";

/**
 * D-41 — browser side of the per-admin Google connection.
 *
 * The admin JWT authorizes the Netlify function. No refresh token, client secret
 * or encryption key is ever returned; the Picker action receives only a
 * short-lived Google access token for this admin's `drive.file` grant.
 */
export const GOOGLE_OAUTH_ENDPOINT = "/.netlify/functions/google-oauth";

export interface GoogleConnectionStatus {
  readonly connected: boolean;
  readonly googleEmail: string | null;
  readonly consentStatus: "connected" | "reconsent_required";
  readonly connectedAt: string | null;
}

export interface GoogleConnectionClientDependencies {
  readonly fetchImpl?: typeof fetch;
}

/**
 * Short-lived Picker session. The access token is a Google OAuth bearer token
 * for this admin's `drive.file` grant (≈1 h), not the vault refresh token. It is
 * deliberately scoped to the shared folder and never persisted.
 */
export interface GooglePickerSession {
  readonly accessToken: string;
  readonly folderId: string;
  readonly appId: string | null;
  readonly developerKey: string | null;
}

async function accessToken(
  client: SupabaseClient<Database>
): Promise<string | null> {
  const { data } = await client.auth.getSession();
  return data.session?.access_token ?? null;
}

async function request(
  client: SupabaseClient<Database>,
  action: string,
  method: "GET" | "POST",
  dependencies: GoogleConnectionClientDependencies
): Promise<Response | null> {
  const token = await accessToken(client);
  if (token === null || token === "") return null;
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  try {
    return await fetchImpl(`${GOOGLE_OAUTH_ENDPOINT}?action=${action}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/json"
      }
    });
  } catch {
    return null;
  }
}

export async function getGoogleConnectionStatus(
  client: SupabaseClient<Database>,
  dependencies: GoogleConnectionClientDependencies = {}
): Promise<GoogleConnectionStatus | null> {
  const response = await request(client, "status", "GET", dependencies);
  if (response === null || !response.ok) return null;
  try {
    const payload = (await response.json()) as Partial<GoogleConnectionStatus>;
    return {
      connected: payload.connected === true,
      googleEmail:
        typeof payload.googleEmail === "string" ? payload.googleEmail : null,
      consentStatus:
        payload.consentStatus === "reconsent_required"
          ? "reconsent_required"
          : "connected",
      connectedAt:
        typeof payload.connectedAt === "string" ? payload.connectedAt : null
    };
  } catch {
    return null;
  }
}

export async function startGoogleConnection(
  client: SupabaseClient<Database>,
  dependencies: GoogleConnectionClientDependencies = {}
): Promise<string | null> {
  const response = await request(client, "start", "POST", dependencies);
  if (response === null || !response.ok) return null;
  try {
    const payload = (await response.json()) as { authUrl?: unknown };
    return typeof payload.authUrl === "string" && payload.authUrl !== ""
      ? payload.authUrl
      : null;
  } catch {
    return null;
  }
}

export async function disconnectGoogleConnection(
  client: SupabaseClient<Database>,
  dependencies: GoogleConnectionClientDependencies = {}
): Promise<boolean> {
  const response = await request(client, "disconnect", "POST", dependencies);
  return response !== null && response.ok;
}

export async function getGooglePickerSession(
  client: SupabaseClient<Database>,
  dependencies: GoogleConnectionClientDependencies = {}
): Promise<GooglePickerSession | null> {
  const response = await request(client, "picker", "POST", dependencies);
  if (response === null || !response.ok) return null;
  try {
    const payload = (await response.json()) as {
      accessToken?: unknown;
      folderId?: unknown;
      appId?: unknown;
      developerKey?: unknown;
    };
    if (
      typeof payload.accessToken !== "string" ||
      payload.accessToken === "" ||
      typeof payload.folderId !== "string" ||
      payload.folderId === ""
    ) {
      return null;
    }
    return {
      accessToken: payload.accessToken,
      folderId: payload.folderId,
      appId: typeof payload.appId === "string" ? payload.appId : null,
      developerKey:
        typeof payload.developerKey === "string" ? payload.developerKey : null
    };
  } catch {
    return null;
  }
}
