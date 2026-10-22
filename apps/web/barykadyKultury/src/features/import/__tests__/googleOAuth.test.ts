import { describe, expect, it, vi } from "vitest";

import {
  buildGoogleAuthUrl,
  createOAuthState,
  exchangeAuthorizationCode,
  refreshAccessToken,
  revokeToken
} from "../googleOAuth";
import { ExternalCallTimeoutError } from "../timeouts";

const CONFIG = {
  clientId: "client-id",
  clientSecret: "client-secret",
  redirectUri: "https://example.test/.netlify/functions/google-oauth"
};

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" }
  });
}

describe("buildGoogleAuthUrl", () => {
  it("requests only drive.file with offline access and explicit consent", () => {
    const url = new URL(
      buildGoogleAuthUrl(CONFIG, {
        state: "state-1",
        loginHint: "editor@example.org"
      })
    );

    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("client_id")).toBe("client-id");
    expect(url.searchParams.get("redirect_uri")).toBe(CONFIG.redirectUri);
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe(
      "https://www.googleapis.com/auth/drive.file"
    );
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("state")).toBe("state-1");
    expect(url.searchParams.get("login_hint")).toBe("editor@example.org");
  });

  it("creates an unguessable URL-safe state", () => {
    const state = createOAuthState();
    expect(state).toMatch(/^[A-Za-z0-9_-]{20,}$/u);
    expect(createOAuthState()).not.toBe(state);
  });
});

describe("exchangeAuthorizationCode", () => {
  it("exchanges the code for a refresh token", async () => {
    const fetchImpl = vi.fn(async () =>
      json({
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_in: 3600,
        scope: "https://www.googleapis.com/auth/drive.file"
      })
    );

    const token = await exchangeAuthorizationCode(CONFIG, "code-1", fetchImpl);

    expect(token).toMatchObject({
      accessToken: "access-token",
      refreshToken: "refresh-token"
    });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit
    ];
    expect(url).toBe("https://oauth2.googleapis.com/token");
    const body = init.body as string;
    expect(body).toContain("grant_type=authorization_code");
    expect(body).toContain("code=code-1");
  });

  it("rejects a grant without a refresh token (no offline access)", async () => {
    const fetchImpl = vi.fn(async () =>
      json({ access_token: "access-token", expires_in: 3600 })
    );

    await expect(
      exchangeAuthorizationCode(CONFIG, "code-1", fetchImpl)
    ).resolves.toBeNull();
  });
});

describe("refreshAccessToken", () => {
  it("returns a fresh access token", async () => {
    const fetchImpl = vi.fn(async () =>
      json({ access_token: "fresh", expires_in: 600 })
    );

    await expect(
      refreshAccessToken(CONFIG, "refresh-token", fetchImpl)
    ).resolves.toEqual({ ok: true, accessToken: "fresh" });
  });

  it("reports invalid_grant so the connection can require re-consent", async () => {
    const fetchImpl = vi.fn(async () => json({ error: "invalid_grant" }, 400));

    await expect(
      refreshAccessToken(CONFIG, "revoked", fetchImpl)
    ).resolves.toEqual({ ok: false, reason: "invalid_grant" });
  });

  it("aborts a slow token call with the token timeout code", async () => {
    const fetchImpl = vi.fn(
      async (_input: URL | RequestInfo, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        })
    );

    await expect(
      refreshAccessToken(
        CONFIG,
        "refresh-token",
        fetchImpl as unknown as typeof fetch,
        5
      )
    ).rejects.toMatchObject<Partial<ExternalCallTimeoutError>>({
      code: "token-timeout"
    });
  });
});

describe("revokeToken", () => {
  it("posts the token to Google's revoke endpoint", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 200 }));

    await expect(revokeToken("refresh-token", fetchImpl)).resolves.toBe(true);
    const [url] = fetchImpl.mock.calls[0] as unknown as [string | URL];
    expect(String(url)).toContain("https://oauth2.googleapis.com/revoke");
    expect(String(url)).toContain("token=refresh-token");
  });
});
