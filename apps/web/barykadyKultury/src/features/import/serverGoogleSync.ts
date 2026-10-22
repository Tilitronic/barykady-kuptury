import type { Locale } from "../i18n/locales";
import type { ReaderDocumentV1 } from "../reader/types";
import type { Json } from "../../types/database.types";

import { convertSource } from "./convertSource";
import { createGoogleDriveClient, type DriveClient } from "./googleDriveClient";
import type { GoogleCredentialEnv } from "./googleCredentials";
import {
  syncGoogleDoc,
  type GoogleSyncMode,
  type GoogleSyncResult,
  type GoogleSyncTarget
} from "./googleSync";
import {
  persistConvertedTranslation,
  type PersistConvertedInput
} from "./persistConvertedTranslation";
import { resolveServerGoogleAuth } from "./serverGoogleAuth";
import {
  createServerSupabaseClient,
  selectRows,
  type ServerSupabaseConfig
} from "./serverSupabase";

/**
 * T-042 S7/S9 — server-side orchestration shared by the background and
 * scheduled functions. It loads the stored target, resolves Google credentials,
 * reuses the S7 engine and writes through the S3 persistence writer.
 *
 * Tokens/keys stay in this call chain; the result contains only safe status,
 * counts and entity ids.
 */
export interface ServerGoogleSyncConfig {
  readonly supabase: ServerSupabaseConfig;
  readonly googleEnv: GoogleCredentialEnv;
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => Date;
}

export interface ServerGoogleSyncInitial {
  readonly slug: string;
  readonly title: string;
  readonly description?: string | null;
  readonly documentType?: string;
  readonly publish?: boolean;
  readonly allowOriginalDownload?: boolean;
}

export interface ServerGoogleSyncParams {
  readonly kind: "document" | "publication";
  readonly entityId: string | null;
  readonly locale: Locale;
  readonly fileId: string;
  readonly mode: GoogleSyncMode;
  readonly force?: boolean;
  readonly initial?: ServerGoogleSyncInitial;
  /**
   * The acting admin (D-41). The vault token is keyed by this id; a null value
   * is only valid for the deprecated env demo path.
   */
  readonly requestedBy?: string | null;
}

function tableFor(kind: "document" | "publication"): string {
  return kind === "document" ? "organization_documents" : "publications";
}

function translationTableFor(kind: "document" | "publication"): string {
  return kind === "document"
    ? "organization_document_translations"
    : "publication_translations";
}

function ownerColumn(kind: "document" | "publication"): string {
  return kind === "document" ? "document_id" : "publication_id";
}

function stringValue(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  return typeof value === "string" ? value : null;
}

function numberValue(row: Record<string, unknown>, key: string): number | null {
  const value = row[key];
  return typeof value === "number" ? value : null;
}

function parseStoredAst(
  value: unknown,
  version: number | null
): ReaderDocumentV1 | null {
  if (version !== 1 || typeof value !== "object" || value === null) return null;
  const candidate = value as { kind?: unknown; blocks?: unknown };
  return candidate.kind === "document" && Array.isArray(candidate.blocks)
    ? (candidate as ReaderDocumentV1)
    : null;
}

function targetFromRows(
  params: ServerGoogleSyncParams,
  root: Record<string, unknown>,
  translation: Record<string, unknown>
): GoogleSyncTarget | null {
  const title = stringValue(translation, "title");
  const entityId = stringValue(root, "id");
  const slug = stringValue(root, "slug");
  if (title === null || entityId === null || slug === null) return null;

  const description =
    stringValue(translation, "description") ??
    stringValue(translation, "abstract");
  const astVersion = numberValue(translation, "body_ast_version");
  const previousAst = parseStoredAst(translation.body_ast ?? null, astVersion);

  return {
    kind: params.kind,
    entityId,
    slug,
    locale: params.locale,
    title,
    description,
    documentType: stringValue(root, "document_type") ?? "report",
    fileId: params.fileId,
    existingModifiedTime: stringValue(root, "source_modified_at"),
    existingStatus:
      stringValue(root, "status") === "published" ? "published" : "draft",
    allowOriginalDownload: root.allow_original_download === true,
    sourceUrl: stringValue(root, "source_url"),
    previousAst
  };
}

async function loadTarget(
  config: ServerGoogleSyncConfig,
  params: ServerGoogleSyncParams
): Promise<GoogleSyncTarget | null> {
  if (params.entityId === null) {
    if (params.initial === undefined) return null;
    if (
      params.initial.title.trim() === "" ||
      params.initial.slug.trim() === ""
    ) {
      return null;
    }
    return {
      kind: params.kind,
      entityId: null,
      slug: params.initial.slug,
      locale: params.locale,
      title: params.initial.title,
      description: params.initial.description ?? null,
      documentType: params.initial.documentType ?? "report",
      fileId: params.fileId,
      existingModifiedTime: null,
      existingStatus: params.initial.publish === true ? "published" : "draft",
      allowOriginalDownload: params.initial.allowOriginalDownload === true,
      sourceUrl: null,
      previousAst: null
    };
  }

  const table = tableFor(params.kind);
  const rootRows = await selectRows(
    config.supabase,
    table,
    "select=id,slug,status,document_type,allow_original_download,source_url,source_modified_at,source_external_id" +
      `&id=eq.${encodeURIComponent(params.entityId)}&limit=1`
  );
  const root = rootRows[0];
  if (root === undefined) return null;

  const translationTable = translationTableFor(params.kind);
  const translationFields =
    params.kind === "document"
      ? "locale,title,description,body_ast,body_ast_version"
      : "locale,title,abstract,body_ast,body_ast_version";
  const translationRows = await selectRows(
    config.supabase,
    translationTable,
    `select=${translationFields}` +
      `&${ownerColumn(params.kind)}=eq.${encodeURIComponent(params.entityId)}` +
      `&locale=eq.${params.locale}&limit=1`
  );
  const translation = translationRows[0];
  if (translation === undefined) return null;

  return targetFromRows(params, root, translation);
}

export async function runServerGoogleSync(
  config: ServerGoogleSyncConfig,
  params: ServerGoogleSyncParams
): Promise<GoogleSyncResult> {
  const target = await loadTarget(config, params);
  if (target === null) {
    return { status: "failed", error: "invalid-target" };
  }

  const auth = await resolveServerGoogleAuth(
    {
      supabase: config.supabase,
      googleEnv: config.googleEnv,
      ...(config.fetchImpl !== undefined ? { fetchImpl: config.fetchImpl } : {})
    },
    { requestedBy: params.requestedBy ?? null }
  );
  if (!auth.ok) {
    return {
      status: "failed",
      error: auth.error,
      ...(auth.detail !== undefined ? { detail: auth.detail } : {})
    };
  }

  const fetchImpl = config.fetchImpl ?? fetch;
  const driveClient: DriveClient = createGoogleDriveClient({
    accessToken: auth.accessToken,
    fetchImpl,
    sharedFolderId: auth.sharedFolderId
  });
  const serviceClient = createServerSupabaseClient(config.supabase);

  return syncGoogleDoc(
    target,
    {
      driveClient,
      convert: convertSource,
      persist: (input: PersistConvertedInput) =>
        persistConvertedTranslation(serviceClient, input),
      now: config.now ?? (() => new Date())
    },
    {
      mode: params.mode,
      force: params.force === true
    }
  );
}

/** JSON-safe cast for a translation AST column. */
export function astJson(value: unknown): Json | null {
  return (value as Json | null) ?? null;
}

/** Test seam for target construction without Supabase/Drive. */
export function buildGoogleSyncTarget(
  params: ServerGoogleSyncParams,
  root: Record<string, unknown>,
  translation: Record<string, unknown>
): GoogleSyncTarget | null {
  return targetFromRows(params, root, translation);
}

/** Re-exported so callers can type a previously loaded AST. */
export type StoredReaderAst = ReaderDocumentV1;
