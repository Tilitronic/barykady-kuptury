import { describe, expect, it, vi } from "vitest";

import {
  consumeOAuthState,
  deleteGoogleConnection,
  encryptConnectionToken,
  getGoogleConnectionSummary,
  markGoogleConnectionReconsent,
  readGoogleConnection,
  resolveVaultAccessToken,
  saveGoogleConnection
} from "../googleConnections";
import type { ServerSupabaseConfig } from "../serverSupabase";

const USER_ID = "00000000-0000-4000-8000-0000000000a1";
const KEY = btoa(
  String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))
);
const OAUTH = {
  clientId: "client-id",
  clientSecret: "client-secret",
  redirectUri: "https://example.test/callback"
};

function config(fetchImpl: typeof fetch): ServerSupabaseConfig {
  return {
    url: "https://db.example.test",
    serviceKey: "service-key",
    fetchImpl
  };
}

function connectionRow(ciphertext: string) {
  return {
    user_id: USER_ID,
    google_email: "editor@example.org",
    refresh_token_ciphertext: ciphertext,
    scope: "https://www.googleapis.com/auth/drive.file",
    consent_status: "connected",
    connected_at: "2030-05-01T00:00:00Z",
    updated_at: "2030-05-01T00:00:00Z",
    last_used_at: null
  };
}

describe("google connection vault repository", () => {
  it("stores only the encrypted envelope (never the plaintext token)", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse([connectionRow("ciphertext")])
    );

    await expect(
      saveGoogleConnection(config(fetchImpl), {
        userId: USER_ID,
        refreshToken: "1//plaintext-refresh-token",
        scope: "https://www.googleapis.com/auth/drive.file",
        googleEmail: "editor@example.org",
        encryptionKey: KEY
      })
    ).resolves.toBe(true);

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit
    ];
    expect(url).toContain("/rest/v1/google_connections");
    expect(url).toContain("on_conflict=user_id");
    const bodyText = init.body as string;
    expect(bodyText).not.toContain("1//plaintext-refresh-token");
    const body = JSON.parse(bodyText) as Record<string, unknown>;
    expect(String(body.refresh_token_ciphertext)).toMatch(/^v1\./u);
  });

  it("reads and decrypts the link-owner token only for that user", async () => {
    const ciphertext = await encryptConnectionToken(
      "refresh-token",
      KEY,
      USER_ID
    );
    const fetchImpl = vi.fn(async () =>
      jsonResponse([connectionRow(ciphertext ?? "")])
    );

    const row = await readGoogleConnection(config(fetchImpl), USER_ID, KEY);
    expect(row?.refreshToken).toBe("refresh-token");
    expect(row?.consentStatus).toBe("connected");
  });

  it("returns a safe status summary without the ciphertext", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse([connectionRow("ciphertext")])
    );

    await expect(
      getGoogleConnectionSummary(config(fetchImpl), USER_ID)
    ).resolves.toEqual({
      connected: true,
      googleEmail: "editor@example.org",
      consentStatus: "connected",
      connectedAt: "2030-05-01T00:00:00Z"
    });
  });

  it("marks a revoked grant for re-consent and can disconnect", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    const supabase = config(fetchImpl);

    await markGoogleConnectionReconsent(supabase, USER_ID);
    const [patchUrl, patchInit] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit
    ];
    expect(patchUrl).toContain("user_id=eq.");
    expect(patchInit.method).toBe("PATCH");
    expect(JSON.parse(patchInit.body as string)).toEqual({
      consent_status: "reconsent_required"
    });

    await deleteGoogleConnection(supabase, USER_ID);
    const [deleteUrl, deleteInit] = fetchImpl.mock.calls[1] as unknown as [
      string,
      RequestInit
    ];
    expect(deleteUrl).toContain("/rest/v1/google_connections");
    expect(deleteInit.method).toBe("DELETE");
  });
});

describe("resolveVaultAccessToken", () => {
  it("returns a usable token for the acting admin", async () => {
    const ciphertext = await encryptConnectionToken(
      "refresh-token",
      KEY,
      USER_ID
    );
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = input as string;
      if (url.includes("/rest/v1/google_connections")) {
        return jsonResponse([connectionRow(ciphertext ?? "")]);
      }
      return jsonResponse({ access_token: "access-token", expires_in: 600 });
    });

    await expect(
      resolveVaultAccessToken(
        { supabase: config(fetchImpl), encryptionKey: KEY, oauth: OAUTH },
        USER_ID
      )
    ).resolves.toEqual({ ok: true, accessToken: "access-token" });
  });

  it("requires re-consent when Google returns invalid_grant", async () => {
    const ciphertext = await encryptConnectionToken(
      "revoked-token",
      KEY,
      USER_ID
    );
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = input as string;
      if (url.includes("/rest/v1/google_connections")) {
        return jsonResponse([connectionRow(ciphertext ?? "")]);
      }
      if (url.includes("/rest/v1/")) return new Response(null, { status: 204 });
      return jsonResponse({ error: "invalid_grant" }, 400);
    });

    await expect(
      resolveVaultAccessToken(
        { supabase: config(fetchImpl), encryptionKey: KEY, oauth: OAUTH },
        USER_ID
      )
    ).resolves.toEqual({ ok: false, reason: "reconnect-required" });
  });

  it("fails closed when the admin has no connection", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse([]));

    await expect(
      resolveVaultAccessToken(
        { supabase: config(fetchImpl), encryptionKey: KEY, oauth: OAUTH },
        USER_ID
      )
    ).resolves.toEqual({ ok: false, reason: "connection-missing" });
  });
});

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" }
  });
}

describe("atomic OAuth state consume", () => {
  it("uses one DELETE ... RETURNING RPC and proceeds on the returned owner", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify(USER_ID), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
    );

    await expect(consumeOAuthState(config(fetchImpl), "state-1")).resolves.toBe(
      USER_ID
    );

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit
    ];
    expect(url).toContain("/rest/v1/rpc/consume_google_oauth_state_v1");
    expect(JSON.parse(init.body as string)).toEqual({ p_state: "state-1" });
  });

  it("fails the replay when the atomic delete returns no row", async () => {
    const fetchImpl = vi.fn(async () => new Response("null", { status: 200 }));

    await expect(
      consumeOAuthState(config(fetchImpl), "replayed-state")
    ).resolves.toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
