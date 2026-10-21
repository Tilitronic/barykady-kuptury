import type { Locale } from "../i18n/locales";
import type { ReaderDocumentV1 } from "../reader/types";

import { ImportConversionError, isImportConversionError } from "./errors";
import {
  DOCX_MIME,
  DriveExportTooLargeError,
  GOOGLE_DOC_MIME,
  DriveRequestError,
  type DriveClient,
  type DriveFileMetadata
} from "./googleDriveClient";
import type {
  PersistConvertedInput,
  PersistConvertedResult
} from "./persistConvertedTranslation";
import { summarizeAstDiff, type SyncDiffSummary } from "./syncDiff";
import type { ConversionResult, ConversionSource, ImportIssue } from "./types";

/**
 * T-042 S7 — background sync engine.
 *
 * Order matters: metadata check → DOCX export (10 MB cap) → the S0–S2
 * converter → the S3 transactional writer. A failure at any step returns a
 * stable code and writes nothing, so the last published copy stays intact.
 *
 * `preview` stops before the write and returns the converted AST + diff for the
 * S8 confirmation screen; `apply` performs the same checks and persists. The
 * engine is pure/injected (driveClient, convert, persist, clock) so tests use
 * fixtures and no Google credentials exist in the client bundle.
 */

export type GoogleSyncErrorCode =
  | "credentials-unavailable"
  | "not-google-doc"
  | "drive-unavailable"
  | "export-too-large"
  | "export-failed"
  | "conversion-failed"
  | "persist-failed"
  | "invalid-target";

export interface GoogleSyncTarget {
  readonly kind: "document" | "publication";
  /** Null only for the first import; re-sync must target an existing row. */
  readonly entityId: string | null;
  readonly slug: string;
  readonly locale: Locale;
  readonly title: string;
  readonly description?: string | null;
  readonly documentType?: string;
  readonly fileId: string;
  readonly existingModifiedTime: string | null;
  readonly existingStatus: "draft" | "published";
  readonly allowOriginalDownload: boolean;
  readonly sourceUrl?: string | null;
  readonly previousAst?: ReaderDocumentV1 | null;
}

export interface GoogleSyncDependencies {
  readonly driveClient: DriveClient;
  readonly convert: (source: ConversionSource) => Promise<ConversionResult>;
  readonly persist: (
    input: PersistConvertedInput
  ) => Promise<PersistConvertedResult>;
  readonly now: () => Date;
}

export type GoogleSyncResult =
  | {
      readonly status: "unchanged";
      readonly modifiedTime: string;
    }
  | {
      readonly status: "preview";
      readonly modifiedTime: string;
      readonly result: ConversionResult;
      readonly summary: SyncDiffSummary;
    }
  | {
      readonly status: "blocked";
      readonly modifiedTime: string;
      readonly issues: readonly ImportIssue[];
    }
  | {
      readonly status: "synced";
      readonly entityId: string;
      readonly modifiedTime: string;
      readonly summary: SyncDiffSummary;
      readonly sourcePath: string | null;
    }
  | {
      readonly status: "failed";
      readonly error: GoogleSyncErrorCode;
      readonly detail?: string;
    };

export type GoogleSyncMode = "preview" | "apply";

function failed(error: GoogleSyncErrorCode, detail?: string): GoogleSyncResult {
  return detail === undefined
    ? { status: "failed", error }
    : { status: "failed", error, detail };
}

function modifiedTimeMs(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function isUnchanged(
  metadata: DriveFileMetadata,
  target: GoogleSyncTarget,
  force: boolean
): boolean {
  if (force) return false;
  const previous = modifiedTimeMs(target.existingModifiedTime);
  const current = modifiedTimeMs(metadata.modifiedTime);
  return previous !== null && current !== null && current <= previous;
}

function sourceUrl(target: GoogleSyncTarget): string {
  return (
    target.sourceUrl ??
    `https://docs.google.com/document/d/${encodeURIComponent(target.fileId)}/edit`
  );
}

function validateTarget(target: GoogleSyncTarget): GoogleSyncErrorCode | null {
  if (target.fileId.trim() === "") return "invalid-target";
  if (target.title.trim() === "") return "invalid-target";
  if (target.entityId === null && target.slug.trim() === "") {
    return "invalid-target";
  }
  return null;
}

export async function syncGoogleDoc(
  target: GoogleSyncTarget,
  dependencies: GoogleSyncDependencies,
  options: { readonly mode?: GoogleSyncMode; readonly force?: boolean } = {}
): Promise<GoogleSyncResult> {
  const invalid = validateTarget(target);
  if (invalid !== null) return failed(invalid);

  let metadata: DriveFileMetadata;
  try {
    metadata = await dependencies.driveClient.getFileMetadata(target.fileId);
  } catch (error) {
    return failed(
      "drive-unavailable",
      error instanceof DriveRequestError ? String(error.status) : undefined
    );
  }

  if (metadata.mimeType !== GOOGLE_DOC_MIME) {
    return failed("not-google-doc");
  }

  if (isUnchanged(metadata, target, options.force === true)) {
    return { status: "unchanged", modifiedTime: metadata.modifiedTime };
  }

  let bytes: ArrayBuffer;
  try {
    bytes = await dependencies.driveClient.exportDocx(target.fileId);
  } catch (error) {
    if (error instanceof DriveExportTooLargeError) {
      return failed("export-too-large");
    }
    if (error instanceof DriveRequestError) {
      return failed("drive-unavailable", String(error.status));
    }
    return failed("export-failed");
  }

  let result: ConversionResult;
  try {
    result = await dependencies.convert({
      fileName: `${metadata.name}.docx`,
      mimeType: DOCX_MIME,
      bytes
    });
  } catch (error) {
    if (isImportConversionError(error)) {
      return failed("conversion-failed", error.code);
    }
    if (error instanceof ImportConversionError) {
      return failed("conversion-failed", error.code);
    }
    return failed("conversion-failed");
  }

  if (!result.publishable) {
    return {
      status: "blocked",
      modifiedTime: metadata.modifiedTime,
      issues: result.issues
    };
  }

  const summary = summarizeAstDiff(target.previousAst ?? null, result.ast);

  if (options.mode === "preview") {
    return {
      status: "preview",
      modifiedTime: metadata.modifiedTime,
      result,
      summary
    };
  }

  if (target.entityId === null && target.slug.trim() === "") {
    return failed("invalid-target");
  }

  try {
    const persisted = await dependencies.persist({
      kind: target.kind,
      entityId: target.entityId,
      slug: target.slug,
      locale: target.locale,
      title: target.title,
      description: target.description ?? null,
      documentType: target.documentType ?? "report",
      status: target.existingStatus,
      result,
      source: {
        provider: "google_doc",
        file: {
          fileName: `${metadata.name}.docx`,
          mimeType: DOCX_MIME,
          bytes
        },
        externalId: target.fileId,
        url: sourceUrl(target),
        syncedAt: dependencies.now().toISOString(),
        modifiedAt: metadata.modifiedTime,
        allowOriginalDownload: target.allowOriginalDownload
      }
    });

    return {
      status: "synced",
      entityId: persisted.entityId,
      modifiedTime: metadata.modifiedTime,
      summary,
      sourcePath: persisted.sourcePath
    };
  } catch (error) {
    return failed(
      "persist-failed",
      error instanceof Error ? error.name : undefined
    );
  }
}
