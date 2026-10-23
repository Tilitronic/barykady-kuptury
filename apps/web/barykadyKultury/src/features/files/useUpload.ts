import { computed, ref, unref, type Ref } from "vue";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  validateUpload,
  type UploadFileLike,
  type UploadRejectionCode
} from "@/features/files/validateUpload";
import {
  PUBLIC_DOCUMENTS_BUCKET,
  PUBLIC_MEDIA_BUCKET
} from "@/features/files/buckets";
import type { Database } from "@/types/database.types";

/**
 * T-029 — the ONE upload seam shared by covers, portraits, publications and
 * documents.
 *
 * Design authority:
 *   - docs/architecture.md §6: validate type/size and safe names BEFORE any
 *     bytes are transferred; the bucket policy is the server authority.
 *   - docs/architecture.md §6.1: uploads ride `media:write` for public-media
 *     and `publications:write` / `documents:write` for public-documents. This
 *     module never chooses a scope; it chooses the bucket the feature owns.
 *   - docs/tickets/T-029-admin-publications-documents.md: validate →
 *     upload → persist the storage PATH (never a public URL) → show progress
 *     and recoverable errors; a failed row insert must not leave an orphan.
 *
 * Why a composable and not another feature-local helper: T-027 (cover) and
 * T-028 (portrait) had already produced two copies of the same sequence, and
 * T-029 would have added two more. The callback-based persistence seam lets
 * each feature keep its own transactional RPC while sharing the ordering
 * guarantees proven in `uploadFlow.test.ts`.
 *
 * Progress: supabase-js does not expose byte-level upload progress. The
 * composable reports honest STAGE progress (validate → transfer → persist)
 * instead of inventing a byte percentage; the UI announces the stage as text
 * (DESIGN_SYSTEM.md §6: status is never colour alone).
 *
 * Cleanup semantics:
 *   - validation failure → no object exists, nothing to clean;
 *   - storage failure → the client reported no stored object, nothing to clean;
 *   - persistence failure → every object uploaded by THIS call is removed;
 *   - success + `replaceStoragePaths` → the replaced objects are removed only
 *     after the database write committed.
 */

export type UploadStage =
  | "idle"
  | "validating"
  | "uploading"
  | "persisting"
  | "done"
  | "error";

export type UploadFailureCode =
  | "unavailable"
  | "invalid-upload"
  | "upload-failed"
  | "persist-failed"
  | "not-an-image";

export interface UploadedFile {
  readonly path: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly size: number;
}

export interface UploadFailure {
  readonly ok: false;
  readonly code: UploadFailureCode;
  /** Stable validator code for a localized field message. */
  readonly rejectionCode?: UploadRejectionCode;
  readonly message?: string;
}

export type UploadResult =
  | ({ readonly ok: true } & UploadedFile)
  | UploadFailure;

export type PersistResult = { readonly ok: boolean };

export interface UploadFlowFailure extends UploadFailure {
  readonly cleanedUp: boolean;
  /** The feature mutation result (duplicate slug, RPC error, …). */
  readonly cause?: unknown;
}

export type UploadFlowResult<R> =
  | {
      readonly ok: true;
      readonly uploaded: readonly UploadedFile[];
      readonly result: R;
    }
  | UploadFlowFailure;

export interface UseUploadOptions {
  readonly supabase:
    | SupabaseClient<Database>
    | null
    | Ref<SupabaseClient<Database> | null>;
  readonly bucket: typeof PUBLIC_DOCUMENTS_BUCKET | typeof PUBLIC_MEDIA_BUCKET;
  /** Object-key prefix (e.g. `publications`, `documents`, `team`). */
  readonly folder?: string;
  /** Names already present in the folder, for collision-safe naming. */
  readonly existingNames?: readonly string[];
  /** Narrow the T-014 allow-list further (covers/portraits are images). */
  readonly accept?: "any" | "image";
}

function joinPath(folder: string, fileName: string): string {
  const prefix = folder.replace(/^\/+|\/+$/gu, "");
  return prefix === "" ? fileName : `${prefix}/${fileName}`;
}

export function useUpload(options: UseUploadOptions) {
  const stage = ref<UploadStage>("idle");
  const progress = ref(0);
  const failure = ref<UploadFailure | null>(null);

  const isUploading = computed(
    () => stage.value === "validating" || stage.value === "uploading"
  );

  function client(): SupabaseClient<Database> | null {
    return unref(options.supabase);
  }

  function reset(): void {
    stage.value = "idle";
    progress.value = 0;
    failure.value = null;
  }

  /** Validate every file before the first request (all-or-nothing ordering). */
  function validateAll(files: readonly (File & UploadFileLike)[]):
    | {
        readonly ok: true;
        readonly files: readonly (UploadedFile & {
          file: File & UploadFileLike;
        })[];
      }
    | UploadFailure {
    const valid: (UploadedFile & { file: File & UploadFileLike })[] = [];

    for (const file of files) {
      const validation = validateUpload(
        file,
        options.existingNames === undefined
          ? {}
          : { existingNames: options.existingNames }
      );

      if (!validation.ok) {
        return {
          ok: false,
          code: "invalid-upload",
          rejectionCode: validation.code,
          message: validation.message
        };
      }

      if (
        options.accept === "image" &&
        !validation.mimeType.startsWith("image/")
      ) {
        return { ok: false, code: "not-an-image" };
      }

      valid.push({
        file,
        path: joinPath(options.folder ?? "", validation.fileName),
        fileName: validation.fileName,
        mimeType: validation.mimeType,
        size: validation.size
      });
    }

    return { ok: true, files: valid };
  }

  async function store(
    entry: UploadedFile & { file: File & UploadFileLike }
  ): Promise<UploadResult> {
    const supabase = client();
    if (!supabase) return { ok: false, code: "unavailable" };

    stage.value = "uploading";
    progress.value = 55;

    const { error } = await supabase.storage
      .from(options.bucket)
      .upload(entry.path, entry.file, {
        upsert: false,
        contentType: entry.mimeType
      });

    if (error) {
      stage.value = "error";
      failure.value = {
        ok: false,
        code: "upload-failed",
        message: error.message
      };
      return failure.value;
    }

    return {
      ok: true,
      path: entry.path,
      fileName: entry.fileName,
      mimeType: entry.mimeType,
      size: entry.size
    };
  }

  async function remove(path: string): Promise<boolean> {
    const supabase = client();
    if (!supabase) return false;

    const { error } = await supabase.storage
      .from(options.bucket)
      .remove([path]);
    return !error;
  }

  /** Upload one validated file. Returns the object PATH, never a URL. */
  async function upload(file: File & UploadFileLike): Promise<UploadResult> {
    reset();

    const supabase = client();
    if (!supabase) {
      failure.value = { ok: false, code: "unavailable" };
      stage.value = "error";
      return failure.value;
    }

    stage.value = "validating";
    progress.value = 10;

    const validation = validateAll([file]);
    if (!validation.ok) {
      failure.value = validation;
      stage.value = "error";
      return validation;
    }

    const entry = validation.files[0];
    if (!entry) {
      failure.value = { ok: false, code: "invalid-upload" };
      stage.value = "error";
      return failure.value;
    }

    const result = await store(entry);
    if (!result.ok) return result;

    stage.value = "done";
    progress.value = 100;
    return result;
  }

  /** Upload several files only after every one passes validation. */
  async function uploadMany(
    files: readonly (File & UploadFileLike)[]
  ): Promise<
    | { readonly ok: true; readonly files: readonly UploadedFile[] }
    | UploadFailure
  > {
    reset();

    const supabase = client();
    if (!supabase) {
      failure.value = { ok: false, code: "unavailable" };
      stage.value = "error";
      return failure.value;
    }

    stage.value = "validating";
    progress.value = 10;

    const validation = validateAll(files);
    if (!validation.ok) {
      failure.value = validation;
      stage.value = "error";
      return validation;
    }

    const uploaded: UploadedFile[] = [];
    for (const entry of validation.files) {
      const result = await store(entry);
      if (!result.ok) {
        // A later validation cannot fail here (all were validated first), but
        // a network failure mid-batch must not strand earlier objects.
        for (const previous of uploaded) {
          await remove(previous.path);
        }
        return result;
      }
      uploaded.push(result);
    }

    stage.value = "done";
    progress.value = 100;
    return { ok: true, files: uploaded };
  }

  /**
   * Upload then persist through the caller's transactional mutation. A failed
   * persistence removes every object this call created (orphan cleanup), and
   * `replaceStoragePaths` are removed only after a successful commit.
   */
  async function uploadManyAndPersist<R extends PersistResult>(
    files: readonly (File & UploadFileLike)[],
    persist: (uploaded: readonly UploadedFile[]) => Promise<R>,
    replaceStoragePaths: readonly string[] = []
  ): Promise<UploadFlowResult<R>> {
    const uploaded = await uploadMany(files);
    if (!uploaded.ok) {
      return { ...uploaded, cleanedUp: true };
    }

    stage.value = "persisting";
    progress.value = 85;

    let result: R;
    try {
      result = await persist(uploaded.files);
    } catch (error) {
      let cleanedUp = true;
      for (const object of uploaded.files) {
        cleanedUp = (await remove(object.path)) && cleanedUp;
      }
      const failureResult: UploadFailure =
        error instanceof Error
          ? { ok: false, code: "persist-failed", message: error.message }
          : { ok: false, code: "persist-failed" };
      failure.value = failureResult;
      stage.value = "error";
      return {
        ...failureResult,
        cleanedUp,
        cause: error
      };
    }

    if (!result.ok) {
      let cleanedUp = true;
      for (const object of uploaded.files) {
        cleanedUp = (await remove(object.path)) && cleanedUp;
      }
      failure.value = { ok: false, code: "persist-failed" };
      stage.value = "error";
      return { ...failure.value, cleanedUp, cause: result };
    }

    // The row now references the new objects; old ones are unreachable.
    for (const path of replaceStoragePaths) {
      await remove(path);
    }

    stage.value = "done";
    progress.value = 100;
    return { ok: true, uploaded: uploaded.files, result };
  }

  async function uploadAndPersist<R extends PersistResult>(
    file: File & UploadFileLike,
    persist: (uploaded: UploadedFile) => Promise<R>,
    replaceStoragePaths: readonly string[] = []
  ): Promise<UploadFlowResult<R>> {
    const result = await uploadManyAndPersist(
      [file],
      async uploaded => persist(uploaded[0]!),
      replaceStoragePaths
    );

    if (!result.ok) return result;

    return {
      ok: true,
      uploaded: result.uploaded,
      result: result.result
    };
  }

  return {
    stage,
    progress,
    failure,
    isUploading,
    upload,
    uploadMany,
    uploadAndPersist,
    uploadManyAndPersist,
    remove,
    reset
  };
}
