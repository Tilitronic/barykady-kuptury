/**
 * Conventional document-type labels (T-020).
 *
 * The `public-documents` bucket accepts PDF and DOCX only (T-014 splits MIME
 * by purpose), so this map covers exactly those two. Any other type yields
 * `null`: the UI omits the chip instead of inventing a name for a format it
 * cannot verify (AGENTS.md rule 6).
 */
const DOCUMENT_TYPES: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "DOCX"
};

export function fileTypeLabel(mimeType: string | null): string | null {
  if (!mimeType) return null;
  return DOCUMENT_TYPES[mimeType] ?? null;
}
