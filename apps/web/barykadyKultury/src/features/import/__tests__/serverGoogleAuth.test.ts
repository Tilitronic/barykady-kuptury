import { describe, expect, it, vi } from "vitest";

import { encryptConnectionToken } from "../googleConnections";
import type { ServerSupabaseConfig } from "../serverSupabase";
import {
  resolveServerGoogleAuth,
  resolveServerGooglePicker
} from "../serverGoogleAuth";

/**
 * T-042 re-gate — one server credential/folder resolver for every caller.
 *
 * The regression this locks down: no auth mode (including the deprecated env
 * token) may run with a missing shared folder. Missing config is a terminal
 * `folder-not-configured`, never a silent unscoped Drive call.
 */
const USER_ID = "00000000-0000-4000-8000-0000000000d1";
const ENCRYPTION_KEY = btoa(
  String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))
);

function baseEnv() {
  return {
    GOOGLE_OAUTH_CLIENT_ID: "client-id",
    GOOGLE_OAUTH_CLIENT_SECRET: "client-secret",
    GOOGLE_OAUTH_REDIRECT_URI: "https://example.test/callback"
  };
}

function supabaseConfig(fetchImpl: typeof fetch): ServerSupabaseConfig {
  return {
    url: "https://db.example.test",
    serviceKey: "service-key",
    fetchImpl
  };
}

function requestUrl(input: string | URL | Request): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" }
  });
}

describe("resolveServerGoogleAuth", () => {
  it("fails closed for the deprecated env mode without a shared folder", async () => {
    const fetchImpl = vi.fn();
    const result = await resolveServerGoogleAuth(
      {
        supabase: supabaseConfig(fetchImpl as unknown as typeof fetch),
        googleEnv: {
          ...baseEnv(),
          GOOGLE_IMPORT_AUTH_MODE: "env_oauth",
          GOOGLE_OAUTH_REFRESH_TOKEN: "refresh-token"
        },
        fetchImpl: fetchImpl as unknown as typeof fetch
      },
      { requestedBy: null }
    );

    expect(result).toEqual({ ok: false, error: "folder-not-configured" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("fails closed for per-admin OAuth and service accounts without a folder", async () => {
    const perAdmin = await resolveServerGoogleAuth(
      {
        supabase: supabaseConfig(fetch as unknown as typeof fetch),
        googleEnv: { ...baseEnv(), GOOGLE_TOKEN_ENCRYPTION_KEY: ENCRYPTION_KEY }
      },
      { requestedBy: USER_ID }
    );
    expect(perAdmin).toEqual({ ok: false, error: "folder-not-configured" });

    const serviceAccount = await resolveServerGoogleAuth(
      {
        supabase: supabaseConfig(fetch as unknown as typeof fetch),
        googleEnv: {
          GOOGLE_IMPORT_AUTH_MODE: "service_account",
          GOOGLE_SERVICE_ACCOUNT_EMAIL: "sync@example.org",
          GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: "key"
        }
      },
      { requestedBy: null }
    );
    expect(serviceAccount).toEqual({
      ok: false,
      error: "folder-not-configured"
    });
  });

  it("keeps the deprecated env path working only with an explicit folder", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      if (requestUrl(input).includes("oauth2.googleapis.com/token")) {
        return json({ access_token: "env-token", expires_in: 600 });
      }
      throw new Error("unexpected call");
    });

    await expect(
      resolveServerGoogleAuth(
        {
          supabase: supabaseConfig(fetchImpl as unknown as typeof fetch),
          googleEnv: {
            ...baseEnv(),
            GOOGLE_IMPORT_AUTH_MODE: "env_oauth",
            GOOGLE_OAUTH_REFRESH_TOKEN: "refresh-token",
            GOOGLE_SHARED_DRIVE_FOLDER_ID: "shared-folder-1"
          },
          fetchImpl: fetchImpl as unknown as typeof fetch
        },
        { requestedBy: null }
      )
    ).resolves.toEqual({
      ok: true,
      accessToken: "env-token",
      sharedFolderId: "shared-folder-1",
      requestedBy: null
    });
  });

  it("resolves the per-admin vault token and returns the folder with it", async () => {
    const ciphertext = await encryptConnectionToken(
      "vault-refresh",
      ENCRYPTION_KEY,
      USER_ID
    );
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = requestUrl(input);
      if (url.includes("/rest/v1/google_connections")) {
        return json([
          {
            user_id: USER_ID,
            google_email: "editor@example.org",
            refresh_token_ciphertext: ciphertext,
            scope: "https://www.googleapis.com/auth/drive.file",
            consent_status: "connected",
            connected_at: "2030-05-01T00:00:00Z",
            updated_at: "2030-05-01T00:00:00Z",
            last_used_at: null
          }
        ]);
      }
      if (url.includes("oauth2.googleapis.com/token")) {
        return json({ access_token: "vault-access", expires_in: 600 });
      }
      throw new Error("unexpected call");
    });

    await expect(
      resolveServerGoogleAuth(
        {
          supabase: supabaseConfig(fetchImpl as unknown as typeof fetch),
          googleEnv: {
            ...baseEnv(),
            GOOGLE_SHARED_DRIVE_FOLDER_ID: "shared-folder-1",
            GOOGLE_TOKEN_ENCRYPTION_KEY: ENCRYPTION_KEY
          },
          fetchImpl: fetchImpl as unknown as typeof fetch
        },
        { requestedBy: USER_ID }
      )
    ).resolves.toEqual({
      ok: true,
      accessToken: "vault-access",
      sharedFolderId: "shared-folder-1",
      requestedBy: USER_ID
    });
  });

  it("requires a requested_by for per-admin OAuth", async () => {
    await expect(
      resolveServerGoogleAuth(
        {
          supabase: supabaseConfig(fetch as unknown as typeof fetch),
          googleEnv: {
            ...baseEnv(),
            GOOGLE_SHARED_DRIVE_FOLDER_ID: "shared-folder-1",
            GOOGLE_TOKEN_ENCRYPTION_KEY: ENCRYPTION_KEY
          }
        },
        { requestedBy: null }
      )
    ).resolves.toEqual({
      ok: false,
      error: "credentials-unavailable",
      detail: "requested-by-missing"
    });
  });
});

describe("resolveServerGooglePicker", () => {
  it("is unavailable without the Picker app id/key", async () => {
    const fetchImpl = vi.fn();
    await expect(
      resolveServerGooglePicker(
        {
          supabase: supabaseConfig(fetchImpl as unknown as typeof fetch),
          googleEnv: {
            ...baseEnv(),
            GOOGLE_SHARED_DRIVE_FOLDER_ID: "shared-folder-1",
            GOOGLE_TOKEN_ENCRYPTION_KEY: ENCRYPTION_KEY
          },
          fetchImpl: fetchImpl as unknown as typeof fetch
        },
        { requestedBy: USER_ID }
      )
    ).resolves.toEqual({ ok: false, error: "picker-unavailable" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("is unavailable for the service-account/env modes (no user consent)", async () => {
    await expect(
      resolveServerGooglePicker(
        {
          supabase: supabaseConfig(fetch as unknown as typeof fetch),
          googleEnv: {
            GOOGLE_IMPORT_AUTH_MODE: "service_account",
            GOOGLE_SERVICE_ACCOUNT_EMAIL: "sync@example.org",
            GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: "key",
            GOOGLE_SHARED_DRIVE_FOLDER_ID: "shared-folder-1"
          }
        },
        { requestedBy: null }
      )
    ).resolves.toEqual({ ok: false, error: "picker-unavailable" });
  });
});
