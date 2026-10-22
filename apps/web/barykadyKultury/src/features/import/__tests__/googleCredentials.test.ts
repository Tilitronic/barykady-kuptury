import { describe, expect, it, vi } from "vitest";

import {
  createServiceAccountAssertion,
  describeGoogleCredentialMode,
  exchangeGoogleCredentials,
  GOOGLE_DRIVE_FILE_SCOPE,
  resolveGoogleAuthStrategy,
  resolveGoogleCredentials,
  type ServiceAccountSigner
} from "../googleCredentials";

/**
 * T-042 / D-31 — credential boundary. Both auth modes resolve server-side,
 * default to `drive.file`, never expose secrets in diagnostics, and exchange
 * through an injected fetch so no test touches Google.
 */
const OAUTH_ENV = {
  GOOGLE_OAUTH_CLIENT_ID: "client-id",
  GOOGLE_OAUTH_CLIENT_SECRET: "client-secret",
  GOOGLE_OAUTH_REFRESH_TOKEN: "refresh-token"
};

const SERVICE_ENV = {
  GOOGLE_IMPORT_AUTH_MODE: "service_account",
  GOOGLE_SERVICE_ACCOUNT_EMAIL: "sync@example.iam.gserviceaccount.com",
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:
    "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----",
  GOOGLE_SHARED_DRIVE_ID: "shared-drive"
};

const FAKE_SIGNER: ServiceAccountSigner = {
  sign: async () => new Uint8Array([1, 2, 3])
};

describe("resolveGoogleCredentials", () => {
  it("defaults to per-admin OAuth and the drive.file scope", () => {
    expect(resolveGoogleCredentials(OAUTH_ENV)).toMatchObject({
      mode: "oauth_admin",
      clientId: "client-id",
      scope: GOOGLE_DRIVE_FILE_SCOPE
    });
  });

  it("uses service_account only when explicitly requested", () => {
    const resolved = resolveGoogleCredentials(SERVICE_ENV);
    expect(resolved).toMatchObject({
      mode: "service_account",
      clientEmail: SERVICE_ENV.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      sharedDriveId: "shared-drive",
      scope: GOOGLE_DRIVE_FILE_SCOPE
    });
    expect((resolved as { privateKey: string }).privateKey).toContain("\n");
  });

  it("reports missing configuration without throwing", () => {
    expect(resolveGoogleCredentials({})).toEqual({
      mode: "unavailable",
      reason: "missing_config"
    });
    expect(
      resolveGoogleCredentials({
        ...SERVICE_ENV,
        GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: undefined
      })
    ).toEqual({ mode: "unavailable", reason: "missing_config" });
  });

  it("rejects an unknown auth mode", () => {
    expect(
      resolveGoogleCredentials({ GOOGLE_IMPORT_AUTH_MODE: "magic" })
    ).toEqual({ mode: "unavailable", reason: "unsupported_mode" });
  });

  it("keeps diagnostics free of secrets", () => {
    const resolved = resolveGoogleCredentials(OAUTH_ENV);
    const description = JSON.stringify(describeGoogleCredentialMode(resolved));

    expect(description).toContain("oauth_admin");
    expect(description).toContain("drive.file");
    expect(description).not.toContain("client-secret");
    expect(description).not.toContain("refresh-token");
  });
});

describe("exchangeGoogleCredentials", () => {
  it("exchanges an OAuth refresh token through the injected fetch", async () => {
    const tokenFetch = vi.fn(async () => ({
      access_token: "access-token",
      expires_in: 600
    }));

    const token = await exchangeGoogleCredentials(
      resolveGoogleCredentials(OAUTH_ENV) as never,
      tokenFetch
    );

    expect(token?.accessToken).toBe("access-token");
    expect(tokenFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://oauth2.googleapis.com/token",
        body: expect.stringContaining("grant_type=refresh_token")
      })
    );
  });

  it("builds a signed service-account assertion for the JWT flow", async () => {
    const credentials = resolveGoogleCredentials(SERVICE_ENV);
    if (credentials.mode !== "service_account") throw new Error("fixture");

    const assertion = await createServiceAccountAssertion(
      credentials,
      new Date("2030-05-01T00:00:00Z"),
      FAKE_SIGNER
    );
    expect(assertion.split(".")).toHaveLength(3);

    const tokenFetch = vi.fn(async () => ({
      access_token: "service-token",
      expires_in: 3600
    }));
    const token = await exchangeGoogleCredentials(credentials, tokenFetch, {
      now: () => new Date("2030-05-01T00:00:00Z"),
      signer: FAKE_SIGNER
    });

    expect(token?.accessToken).toBe("service-token");
    expect(tokenFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining(
          "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer"
        )
      })
    );
  });

  it("returns null for a malformed token response", async () => {
    await expect(
      exchangeGoogleCredentials(
        resolveGoogleCredentials(OAUTH_ENV) as never,
        async () => ({ error: "invalid_grant" })
      )
    ).resolves.toBeNull();
  });
});

describe("resolveGoogleAuthStrategy (D-41)", () => {
  it("defaults to per-admin OAuth in the vault, not a shared env token", () => {
    expect(
      resolveGoogleAuthStrategy({
        GOOGLE_OAUTH_CLIENT_ID: "client-id",
        GOOGLE_OAUTH_CLIENT_SECRET: "client-secret",
        GOOGLE_SHARED_DRIVE_FOLDER_ID: "ngo-folder"
      })
    ).toMatchObject({
      mode: "per_admin_oauth",
      clientId: "client-id",
      sharedFolderId: "ngo-folder",
      scope: GOOGLE_DRIVE_FILE_SCOPE
    });
  });

  it("keeps the legacy env refresh token only as an explicit deprecated mode", () => {
    expect(
      resolveGoogleAuthStrategy({
        ...OAUTH_ENV,
        GOOGLE_IMPORT_AUTH_MODE: "env_oauth"
      })
    ).toMatchObject({
      mode: "env_oauth",
      deprecated: true,
      refreshToken: "refresh-token"
    });
    // The old mode name still resolves, but to the deprecated env path.
    expect(
      resolveGoogleAuthStrategy({
        ...OAUTH_ENV,
        GOOGLE_IMPORT_AUTH_MODE: "oauth_admin"
      })
    ).toMatchObject({ mode: "env_oauth", deprecated: true });
  });

  it("retains service_account behind the explicit toggle", () => {
    expect(resolveGoogleAuthStrategy(SERVICE_ENV)).toMatchObject({
      mode: "service_account",
      clientEmail: SERVICE_ENV.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      sharedFolderId: null
    });
  });

  it("reports unusable per-admin configuration without throwing", () => {
    expect(resolveGoogleAuthStrategy({})).toEqual({
      mode: "unavailable",
      reason: "missing_config"
    });
  });
});
