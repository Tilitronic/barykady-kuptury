/**
 * D-41 — refresh-token vault encryption.
 *
 * Google's stored-token policy requires encryption at rest, and the vault table
 * itself is service-role-only. The data encryption key is a Netlify env value
 * (`GOOGLE_TOKEN_ENCRYPTION_KEY`, 32 raw bytes base64) that never reaches the
 * browser or the database. AES-GCM binds the envelope to the admin user id via
 * additional authenticated data, so a copied ciphertext cannot be replayed for
 * another account.
 */
const ENVELOPE_VERSION = "v1";
const IV_BYTES = 12;
const KEY_BYTES = 32;

function decodeBase64Url(value: string): Uint8Array | null {
  try {
    const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "="
    );
    const binary = atob(padded);
    return Uint8Array.from(binary, character => character.charCodeAt(0));
  } catch {
    return null;
  }
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function keyBytes(keyBase64: string | undefined): Uint8Array | null {
  const trimmed = keyBase64?.trim() ?? "";
  if (trimmed === "") return null;
  const bytes = decodeBase64Url(trimmed);
  return bytes !== null && bytes.length === KEY_BYTES ? bytes : null;
}

async function importKey(
  keyBase64: string | undefined
): Promise<CryptoKey | null> {
  const bytes = keyBytes(keyBase64);
  if (bytes === null) return null;
  try {
    return await crypto.subtle.importKey(
      "raw",
      bytes as BufferSource,
      "AES-GCM",
      false,
      ["encrypt", "decrypt"]
    );
  } catch {
    return null;
  }
}

export async function encryptSecret(
  plaintext: string,
  keyBase64: string | undefined,
  aad: string
): Promise<string | null> {
  if (plaintext === "") return null;
  const key = await importKey(keyBase64);
  if (key === null) return null;

  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  try {
    const ciphertext = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv as BufferSource,
        additionalData: encoder.encode(aad) as BufferSource
      },
      key,
      encoder.encode(plaintext) as BufferSource
    );
    return `${ENVELOPE_VERSION}.${encodeBase64Url(iv)}.${encodeBase64Url(
      new Uint8Array(ciphertext)
    )}`;
  } catch {
    return null;
  }
}

export async function decryptSecret(
  payload: string,
  keyBase64: string | undefined,
  aad: string
): Promise<string | null> {
  const [version, ivValue, ciphertextValue, ...rest] = payload.split(".");
  if (
    version !== ENVELOPE_VERSION ||
    ivValue === undefined ||
    ciphertextValue === undefined ||
    rest.length > 0
  ) {
    return null;
  }

  const iv = decodeBase64Url(ivValue);
  const ciphertext = decodeBase64Url(ciphertextValue);
  if (iv === null || ciphertext === null) return null;

  const key = await importKey(keyBase64);
  if (key === null) return null;

  try {
    const plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv as BufferSource,
        additionalData: new TextEncoder().encode(aad) as BufferSource
      },
      key,
      ciphertext as BufferSource
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    return null;
  }
}
