/** The two public buckets from T-014 (single source for upload call-sites). */
export const PUBLIC_DOCUMENTS_BUCKET = "public-documents" as const;
export const PUBLIC_MEDIA_BUCKET = "public-media" as const;

export type PublicBucket =
  | typeof PUBLIC_DOCUMENTS_BUCKET
  | typeof PUBLIC_MEDIA_BUCKET;
