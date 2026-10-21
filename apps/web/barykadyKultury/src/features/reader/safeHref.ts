/**
 * Reader link allowlist (T-040/D-37).
 *
 * This is the single source of truth shared by the AST renderer and the T-041
 * import converter. It mirrors the SQL validator exactly:
 *   http://…, https://…, mailto:…, in-page fragments (#…), and same-origin
 *   absolute paths (/… but never //host).
 * Rejected on purpose: protocol-relative `//host` (inherits the page scheme and
 * escapes the origin allowlist), javascript:, data:, file:, and every other
 * relative form.
 *
 * Pure module: no DOM, no Vue, no Supabase — safe to import from a Web Worker.
 */
export function isSafeHref(href: string): boolean {
  if (typeof href !== "string" || href.trim() === "") return false;

  const lower = href.toLowerCase();
  if (lower.startsWith("http://") || lower.startsWith("https://")) return true;
  if (lower.startsWith("mailto:")) return true;
  if (href.startsWith("#")) return true;
  return href.startsWith("/") && !href.startsWith("//");
}
