import { describe, expect, it } from "vitest";

import { decryptSecret, encryptSecret } from "../tokenVault";

/**
 * D-41 — refresh tokens are encrypted at rest. The vault stores an opaque
 * envelope; the key lives only in the Netlify environment and never reaches
 * the browser or the database row.
 */
function key(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes));
}

describe("token vault encryption", () => {
  it("round-trips a refresh token without storing plaintext", async () => {
    const secret = "1//refresh-token-value";
    const encryptionKey = key();
    const payload = await encryptSecret(secret, encryptionKey, "user-1");

    expect(payload).not.toBeNull();
    expect(payload).not.toContain(secret);
    expect(payload?.startsWith("v1.")).toBe(true);
    await expect(
      decryptSecret(payload ?? "", encryptionKey, "user-1")
    ).resolves.toBe(secret);
  });

  it("binds the envelope to the admin user id (AAD)", async () => {
    const encryptionKey = key();
    const payload = await encryptSecret("secret", encryptionKey, "user-1");

    await expect(
      decryptSecret(payload ?? "", encryptionKey, "user-2")
    ).resolves.toBeNull();
  });

  it("rejects a wrong key and malformed envelopes", async () => {
    const encryptionKey = key();
    const payload = await encryptSecret("secret", encryptionKey, "user-1");

    await expect(decryptSecret(payload ?? "", key(), "user-1")).resolves.toBe(
      null
    );
    await expect(
      decryptSecret("not-a-vault-payload", encryptionKey, "user-1")
    ).resolves.toBeNull();
  });

  it("fails closed when the key is missing or the wrong length", async () => {
    await expect(
      encryptSecret("secret", undefined, "user-1")
    ).resolves.toBeNull();
    await expect(
      encryptSecret("secret", btoa("short"), "user-1")
    ).resolves.toBeNull();
  });
});
