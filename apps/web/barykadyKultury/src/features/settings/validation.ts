import type { SettingDefinition, SettingValue } from "./definition";

/**
 * T-048 — kind-based validation for organization facts.
 *
 * Design authority:
 *   * docs/tickets/T-048-org-settings-visibility.md — "values validated by kind
 *     (email, URL, NIP checksum, plain text); secrets never".
 *   * AGENTS.md rule 3 — validate at the trust boundary; the same validation
 *     runs in the admin form and (structurally) in `save_settings_v1`.
 *
 * Why empty is valid for every kind: an empty value is the existing "not
 * configured" convention (D-04/D-05). The visibility checkbox is the explicit
 * hide control; blanking a field is a second, independent way to remove it.
 */

export type SettingValidationCode = "email" | "url" | "nip" | "regon";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Numeric-only helper that preserves the "empty means unset" rule. */
function digits(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  return /^\d+$/.test(trimmed) ? trimmed : null;
}

/**
 * NIP: 10 digits with the Polish tax-id checksum.
 * Weights [6,5,7,2,3,4,5,6,7]; `sum % 11` must equal the final digit (10 is
 * invalid by definition). Verified fixture: 7831961912.
 */
export function isValidNip(value: string): boolean {
  const nip = digits(value);
  if (nip === null || nip.length !== 10) return false;

  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  const sum = weights.reduce(
    (total, weight, index) => total + weight * Number(nip[index]),
    0
  );
  const checksum = sum % 11;
  return checksum !== 10 && checksum === Number(nip[9]);
}

/**
 * REGON: 9 digits (weights 8,9,2,3,4,5,6,7) or 14 digits (weights
 * 2,4,8,5,0,9,7,3,6,1,2,4,8). The ticket names NIP checksums explicitly, but
 * REGON is an identifier with an equally cheap check; rejecting a typo here is
 * cheaper than a broken legal footer. Verified fixture: 545503070.
 */
export function isValidRegon(value: string): boolean {
  const regon = digits(value);
  if (regon === null) return false;

  if (regon.length === 9) {
    const weights = [8, 9, 2, 3, 4, 5, 6, 7];
    const sum = weights.reduce(
      (total, weight, index) => total + weight * Number(regon[index]),
      0
    );
    const checksum = sum % 11;
    return (checksum === 10 ? 0 : checksum) === Number(regon[8]);
  }

  if (regon.length === 14) {
    const weights = [2, 4, 8, 5, 0, 9, 7, 3, 6, 1, 2, 4, 8];
    const sum = weights.reduce(
      (total, weight, index) => total + weight * Number(regon[index]),
      0
    );
    const checksum = sum % 11;
    return (checksum === 10 ? 0 : checksum) === Number(regon[13]);
  }

  return false;
}

/** Absolute http(s) URLs only — never `javascript:`/`data:` (XSS surface). */
export function isValidPublicUrl(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === "") return true;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Validates one scalar value (the canonical `en` entry). */
export function validateScalar(
  definition: SettingDefinition,
  raw: string
): SettingValidationCode | null {
  const value = raw.trim();
  if (value === "") return null;

  switch (definition.kind) {
    case "email":
      return EMAIL_PATTERN.test(value) ? null : "email";
    case "url":
      return isValidPublicUrl(value) ? null : "url";
    case "nip":
      return isValidNip(value) ? null : "nip";
    case "regon":
      return isValidRegon(value) ? null : "regon";
    case "plain":
      return null;
  }
}

/**
 * Validates a whole value map. Localized fields run the same kind check per
 * locale, so a malformed Polish URL cannot hide behind a valid English one.
 * Returns the first failing locale's code (the form marks every locale).
 */
export function validateSettingValue(
  definition: SettingDefinition,
  value: SettingValue
): SettingValidationCode | null {
  const entries = Object.entries(value);
  if (entries.length === 0) {
    return validateScalar(definition, "");
  }

  for (const [, raw] of entries) {
    if (typeof raw !== "string") continue;
    const code = validateScalar(definition, raw);
    if (code !== null) return code;
  }
  return null;
}
