/**
 * Same-origin URL for the owner-approved original source file (T-041 S4).
 *
 * The Netlify binding `content-original` re-validates published status and
 * the `allow_original_download` opt-in server-side, then redirects to a
 * 60-second signed URL. The client therefore only ever builds a stable,
 * credential-free link — no storage path, no token, no service key.
 */
export function contentOriginalUrl(
  kind: "document" | "publication",
  slug: string
): string {
  return `/.netlify/functions/content-original?kind=${kind}&slug=${encodeURIComponent(slug)}`;
}
