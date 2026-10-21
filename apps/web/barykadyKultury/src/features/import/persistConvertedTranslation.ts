import type { SupabaseClient } from "@supabase/supabase-js";

import { sanitizeFileName } from "../files/validateUpload";
import type { Locale } from "../i18n/locales";
import type { Json } from "../../types/database.types";
import type { Database } from "../../types/database.types";

import { inspectRasterImage, ImageMetadataError } from "./imageMetadata";
import type { ConversionResult, ImportImageMimeType } from "./types";

/**
 * T-041 S3 — the only translation-writing module.
 *
 * The browser cannot open a transaction across several PostgREST requests, so
 * this module uploads the bytes first and then calls the single
 * `persist_reader_import_v1` RPC. The RPC writes the root source metadata,
 * `content_assets` (with the converter's ready UUIDs) and the AST translation
 * atomically; the reader trigger derives `body`.
 *
 * Invariants enforced here as well as in SQL:
 * - `body` is never sent;
 * - publication requires `result.publishable` (missing image alt blocks it);
 * - an original download requires a stored private source path;
 * - Google sources require an external Drive id;
 * - only PNG/JPEG/WebP images reach `content_assets`.
 */

export type ImportPersistenceErrorCode =
  | "titleRequired"
  | "slugRequired"
  | "blockingIssues"
  | "invalidSource"
  | "imageMetadataFailed"
  | "uploadFailed"
  | "persistFailed";

export class ImportPersistenceError extends Error {
  readonly code: ImportPersistenceErrorCode;
  readonly detail: string | undefined;

  constructor(code: ImportPersistenceErrorCode, detail?: string) {
    super(detail === undefined ? code : `${code}: ${detail}`);
    this.name = "ImportPersistenceError";
    this.code = code;
    this.detail = detail;
  }
}

export interface PersistenceSourceFile {
  readonly fileName: string;
  readonly mimeType: string;
  readonly bytes: ArrayBuffer;
}

export interface PersistenceSource {
  readonly provider: "manual" | "upload" | "google_doc";
  readonly file?: PersistenceSourceFile;
  readonly externalId?: string | null;
  readonly url?: string | null;
  readonly syncedAt?: string | null;
  readonly modifiedAt?: string | null;
  readonly allowOriginalDownload?: boolean;
  /** A private object path already uploaded by the Google export seam. */
  readonly originalPath?: string | null;
}

export interface PersistConvertedInput {
  readonly kind: "document" | "publication";
  readonly entityId?: string | null;
  readonly slug: string;
  readonly locale: Locale;
  readonly title: string;
  readonly description?: string | null;
  readonly documentType?: string;
  readonly status: "draft" | "published";
  readonly result: ConversionResult;
  readonly source: PersistenceSource;
}

export interface PersistConvertedResult {
  readonly entityId: string;
  readonly sourcePath: string | null;
  readonly assetPaths: readonly string[];
}

export interface PersistOptions {
  readonly createEntityId?: () => string;
  readonly now?: () => Date;
}

type Client = SupabaseClient<Database>;

const DOCX_EXTENSION: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp"
};

function storageError(error: { message: string } | null): string | null {
  return error === null ? null : error.message;
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

async function upload(
  client: Client,
  bucket: string,
  path: string,
  bytes: ArrayBuffer,
  contentType: string
): Promise<void> {
  const { error } = await client.storage.from(bucket).upload(path, bytes, {
    contentType,
    upsert: true
  });
  const message = storageError(error);
  if (message !== null) {
    throw new ImportPersistenceError(
      "uploadFailed",
      `${bucket}/${path}: ${message}`
    );
  }
}

async function removeBestEffort(
  client: Client,
  bucket: string,
  paths: readonly string[]
): Promise<void> {
  if (paths.length === 0) return;
  try {
    await client.storage.from(bucket).remove([...paths]);
  } catch {
    // Best-effort cleanup only: the failed transaction is the primary error.
  }
}

interface AssetPayload {
  readonly id: string;
  readonly storage_path: string;
  readonly mime_type: ImportImageMimeType;
  readonly width: number;
  readonly height: number;
  readonly sha256: string;
  readonly size_bytes: number;
}

/**
 * Uploads extracted images and returns the rows the RPC inserts. The caller
 * owns cleanup of `uploadedPaths` when a later step fails.
 */
async function uploadAssets(
  client: Client,
  input: PersistConvertedInput,
  entityId: string
): Promise<{ assets: AssetPayload[]; uploadedPaths: string[] }> {
  const assets: AssetPayload[] = [];
  const uploadedPaths: string[] = [];

  for (const image of input.result.images) {
    let metadata;
    try {
      metadata = await inspectRasterImage(image.bytes, image.mimeType);
    } catch (error) {
      throw new ImportPersistenceError(
        "imageMetadataFailed",
        error instanceof ImageMetadataError
          ? `${image.fileName}: ${error.message}`
          : image.fileName
      );
    }

    const extension = DOCX_EXTENSION[image.mimeType];
    const path = `content-assets/${input.kind}/${entityId}/${input.locale}/${image.id}.${extension}`;
    await upload(client, "public-media", path, image.bytes, image.mimeType);
    uploadedPaths.push(path);

    assets.push({
      id: image.id,
      storage_path: path,
      mime_type: image.mimeType,
      width: metadata.width,
      height: metadata.height,
      sha256: metadata.sha256,
      size_bytes: metadata.sizeBytes
    });
  }

  return { assets, uploadedPaths };
}

async function uploadSource(
  client: Client,
  input: PersistConvertedInput,
  entityId: string
): Promise<{ path: string | null; uploaded: boolean }> {
  const source = input.source;
  if (source.originalPath !== undefined && source.originalPath !== null) {
    return { path: source.originalPath, uploaded: false };
  }
  if (source.file === undefined) {
    return { path: null, uploaded: false };
  }

  const safeName = sanitizeFileName(source.file.fileName) || "source";
  const path = `sources/${input.kind}/${entityId}/${input.locale}/${crypto.randomUUID()}-${safeName}`;
  await upload(
    client,
    "content-sources",
    path,
    source.file.bytes,
    source.file.mimeType
  );
  return { path, uploaded: true };
}

function rpcArgs(
  input: PersistConvertedInput,
  entityId: string | null,
  assets: readonly AssetPayload[],
  sourcePath: string | null,
  sourceSyncedAt: string | null
): Database["public"]["Functions"]["persist_reader_import_v1"]["Args"] {
  // The generated type marks all RPC arguments non-null even though the SQL
  // parameters are nullable (`p_entity_id`, source metadata). PostgREST accepts
  // explicit nulls; this narrow cast keeps the nullability in one place.
  return {
    p_kind: input.kind,
    p_entity_id: entityId as unknown as string,
    p_slug: input.slug,
    p_locale: input.locale,
    p_title: input.title,
    p_description: (input.description ?? null) as unknown as string,
    p_document_type: input.documentType ?? "report",
    p_body_ast: input.result.ast as unknown as Json,
    p_assets: assets as unknown as Json,
    p_source_provider: input.source.provider,
    p_source_path: (sourcePath ?? null) as unknown as string,
    p_source_mime: (input.source.file?.mimeType ?? null) as unknown as string,
    p_source_external_id: (input.source.externalId ??
      null) as unknown as string,
    p_source_url: (input.source.url ?? null) as unknown as string,
    p_source_synced_at: sourceSyncedAt as unknown as string,
    p_source_modified_at: (input.source.modifiedAt ??
      null) as unknown as string,
    p_allow_original_download: input.source.allowOriginalDownload === true,
    p_status: input.status
  };
}

export async function persistConvertedTranslation(
  client: Client,
  input: PersistConvertedInput,
  options: PersistOptions = {}
): Promise<PersistConvertedResult> {
  const title = input.title.trim();
  if (title === "") {
    throw new ImportPersistenceError("titleRequired");
  }
  const slug = input.slug.trim();
  if (input.entityId === undefined || input.entityId === null) {
    if (slug === "") throw new ImportPersistenceError("slugRequired");
  }
  if (input.status === "published" && !input.result.publishable) {
    throw new ImportPersistenceError("blockingIssues");
  }
  if (
    input.source.url !== undefined &&
    input.source.url !== null &&
    input.source.url !== "" &&
    !isHttpUrl(input.source.url)
  ) {
    throw new ImportPersistenceError("invalidSource", "source url");
  }
  if (
    input.source.provider === "google_doc" &&
    (input.source.externalId === undefined ||
      input.source.externalId === null ||
      input.source.externalId.trim() === "")
  ) {
    throw new ImportPersistenceError("invalidSource", "Drive file id");
  }
  if (
    input.source.allowOriginalDownload === true &&
    input.source.file === undefined &&
    (input.source.originalPath === undefined ||
      input.source.originalPath === null)
  ) {
    throw new ImportPersistenceError("invalidSource", "original download");
  }

  // New imports let the RPC generate the entity id; the path scope is a
  // separate random value so assets can be uploaded before the row exists.
  // Existing syncs reuse the entity id for both.
  const entityId = input.entityId ?? null;
  const pathScope =
    entityId ?? (options.createEntityId ?? (() => crypto.randomUUID()))();
  const now = (options.now ?? (() => new Date()))();

  const uploadedAssetPaths: string[] = [];
  let uploadedSourcePath: string | null = null;

  try {
    const { assets, uploadedPaths } = await uploadAssets(
      client,
      input,
      pathScope
    );
    uploadedAssetPaths.push(...uploadedPaths);

    const source = await uploadSource(client, input, pathScope);
    if (source.uploaded) uploadedSourcePath = source.path;

    const sourceSyncedAt =
      input.source.provider === "manual"
        ? null
        : (input.source.syncedAt ?? now.toISOString());

    if (input.source.allowOriginalDownload === true && source.path === null) {
      throw new ImportPersistenceError("invalidSource", "original download");
    }

    const { data, error } = await client.rpc(
      "persist_reader_import_v1",
      rpcArgs(input, entityId, assets, source.path, sourceSyncedAt)
    );

    if (error !== null || typeof data !== "string") {
      throw new ImportPersistenceError(
        "persistFailed",
        error?.message ?? "missing entity id"
      );
    }

    return {
      entityId: data,
      sourcePath: source.path,
      assetPaths: assets.map(asset => asset.storage_path)
    };
  } catch (error) {
    await removeBestEffort(client, "public-media", uploadedAssetPaths);
    if (uploadedSourcePath !== null) {
      await removeBestEffort(client, "content-sources", [uploadedSourcePath]);
    }
    throw error;
  }
}
