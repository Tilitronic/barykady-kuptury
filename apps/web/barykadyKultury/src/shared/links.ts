/**
 * Shared URI builders for contact links (T-021).
 *
 * Centralising `mailto:`/`tel:` construction keeps encoding correct in one
 * place. `mailto:` addresses are intentionally not percent-encoded: the `@` is
 * a valid URI path character and clients expect it literally, while encoding it
 * to `%40` breaks some mail handlers. The prefilled subject, by contrast, is
 * user-visible copy that may contain spaces, `&`, `#` or non-Latin letters, so
 * it goes through `encodeURIComponent`.
 */

/**
 * Builds a `mailto:` URI for `email`, optionally prefilling the subject line.
 * The address is trimmed; empty input yields a bare, inert `mailto:`.
 */
export function mailtoHref(email: string, subject?: string): string {
  const address = email.trim();

  if (!subject) return `mailto:${address}`;

  return `mailto:${address}?subject=${encodeURIComponent(subject)}`;
}

/**
 * Builds a dialable `tel:` URI from a human-formatted number.
 *
 * Display may use spaces, dashes, parentheses or a leading `+`; a `tel:` URI
 * must not. Everything except a single leading `+` and digits is removed (RFC
 * 3966 allows the `+` as the international prefix).
 */
export function telHref(phone: string): string {
  const normalized = phone.trim().replace(/(?!^\+)\D/g, "");

  return `tel:${normalized}`;
}
