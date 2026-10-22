import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "@/types/database.types";

import {
  disconnectGoogleConnection,
  getGoogleConnectionStatus,
  getGooglePickerSession,
  startGoogleConnection
} from "../googleConnectionClient";

const TOKEN = "admin-token";

function client(): SupabaseClient<Database> {
  return {
    auth: {
      getSession: async () => ({
        data: {
          session: {
            access_token: TOKEN,
            user: { id: "user-1", email: "admin@demo.local" }
          }
        }
      })
    }
  } as unknown as SupabaseClient<Database>;
}

describe("googleConnectionClient", () => {
  it("reads the safe connection status with the admin token", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            connected: true,
            googleEmail: "admin@demo.local",
            consentStatus: "connected",
            connectedAt: "2030-05-01T00:00:00Z"
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
    );

    await expect(
      getGoogleConnectionStatus(client(), { fetchImpl })
    ).resolves.toMatchObject({
      connected: true,
      googleEmail: "admin@demo.local"
    });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit
    ];
    expect(url).toContain("/.netlify/functions/google-oauth?action=status");
    expect((init.headers as Record<string, string>).authorization).toBe(
      `Bearer ${TOKEN}`
    );
  });

  it("returns the consent URL for connect", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ authUrl: "https://accounts.google.com/x" }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        )
    );

    await expect(startGoogleConnection(client(), { fetchImpl })).resolves.toBe(
      "https://accounts.google.com/x"
    );
  });

  it("posts a disconnect request", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    await expect(
      disconnectGoogleConnection(client(), { fetchImpl })
    ).resolves.toBe(true);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit
    ];
    expect(url).toContain("action=disconnect");
    expect(init.method).toBe("POST");
  });
});

describe("picker session", () => {
  it("requests the short-lived token + shared folder from the server", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            accessToken: "short-lived-token",
            folderId: "shared-folder-1",
            appId: "123",
            developerKey: "public-key"
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
    );

    await expect(
      getGooglePickerSession(client(), { fetchImpl })
    ).resolves.toEqual({
      accessToken: "short-lived-token",
      folderId: "shared-folder-1",
      appId: "123",
      developerKey: "public-key"
    });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit
    ];
    expect(url).toContain("action=picker");
    expect((init.headers as Record<string, string>).authorization).toBe(
      `Bearer ${TOKEN}`
    );
  });

  it("returns null when the server refuses the Picker (e.g. missing folder)", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "folder-not-configured" }), {
          status: 409,
          headers: { "content-type": "application/json" }
        })
    );

    await expect(
      getGooglePickerSession(client(), { fetchImpl })
    ).resolves.toBeNull();
  });
});
