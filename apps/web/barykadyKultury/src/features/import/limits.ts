/**
 * T-041 conversion limits.
 *
 * Why these are smaller than the 50 MiB `content-sources` bucket ceiling:
 * manual imports run in the admin's browser, and a compressed DOCX can
 * legitimately expand far beyond its upload size. The bucket limit protects
 * storage; these limits protect the client from a zip bomb / runaway worker.
 * They are intentionally constants (not user input) and are exported so tests
 * can pin the boundary and future T-042 server conversion can reuse them.
 */
export interface ImportLimits {
  /** Markdown is text; 5 MiB is far beyond a realistic long-form article. */
  readonly maxMarkdownBytes: number;
  /** Compressed DOCX upload ceiling before the worker inflates anything. */
  readonly maxDocxCompressedBytes: number;
  /** Sum of the zip central-directory uncompressed sizes. */
  readonly maxDocxUncompressedBytes: number;
  /** Zip entry-count ceiling (also rejects pathologically many small parts). */
  readonly maxDocxEntries: number;
  /** One extracted image; the public-media bucket is the storage authority. */
  readonly maxImageBytes: number;
}

export const DEFAULT_IMPORT_LIMITS: ImportLimits = {
  maxMarkdownBytes: 5 * 1024 * 1024,
  maxDocxCompressedBytes: 20 * 1024 * 1024,
  maxDocxUncompressedBytes: 100 * 1024 * 1024,
  maxDocxEntries: 2_000,
  maxImageBytes: 10 * 1024 * 1024
};
