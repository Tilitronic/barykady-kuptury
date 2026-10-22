import { describe, expect, it, vi } from "vitest";

import type { ReaderDocumentV1 } from "@/features/reader/types";

import { ImportConversionError } from "../errors";
import {
  DriveExportTooLargeError,
  DriveFolderNotConfiguredError,
  DriveOutOfFolderError,
  DriveTimeoutError,
  GOOGLE_DOC_MIME,
  type DriveClient,
  type DriveFileMetadata
} from "../googleDriveClient";
import {
  syncGoogleDoc,
  type GoogleSyncDependencies,
  type GoogleSyncTarget
} from "../googleSync";
import type {
  PersistConvertedInput,
  PersistConvertedResult
} from "../persistConvertedTranslation";
import type { ConversionResult } from "../types";

/** T-042 S7 — deterministic sync engine with a fake Drive, converter and writer. */
const MODIFIED = "2030-05-01T10:00:00.000Z";

const METADATA: DriveFileMetadata = {
  id: "drive-file-1",
  name: "Statute",
  mimeType: GOOGLE_DOC_MIME,
  modifiedTime: MODIFIED,
  parents: ["shared-folder-1"]
};

function ast(text = "Imported"): ReaderDocumentV1 {
  return {
    kind: "document",
    blocks: [
      { kind: "heading", level: 2, children: [{ kind: "text", value: text }] },
      { kind: "paragraph", children: [{ kind: "text", value: "Body" }] }
    ]
  };
}

function conversion(
  overrides: Partial<ConversionResult> = {}
): ConversionResult {
  return {
    ast: ast(),
    images: [],
    issues: [],
    publishable: true,
    ...overrides
  };
}

function target(overrides: Partial<GoogleSyncTarget> = {}): GoogleSyncTarget {
  return {
    kind: "document",
    entityId: "entity-1",
    slug: "statute",
    locale: "en",
    title: "Statute",
    fileId: "drive-file-1",
    existingModifiedTime: "2030-04-01T10:00:00.000Z",
    existingStatus: "published",
    allowOriginalDownload: false,
    ...overrides
  };
}

function drive(overrides: Partial<DriveClient> = {}): DriveClient {
  return {
    getFileMetadata: async () => METADATA,
    exportDocx: async () => new TextEncoder().encode("docx").buffer,
    ...overrides
  };
}

function deps(overrides: Partial<GoogleSyncDependencies> = {}) {
  const persist = vi.fn(
    async (input: PersistConvertedInput): Promise<PersistConvertedResult> => ({
      entityId: input.entityId ?? "new-entity",
      sourcePath: "sources/document/entity-1/en/statute.docx",
      assetPaths: []
    })
  );

  return {
    persist,
    deps: {
      driveClient: drive(),
      convert: async () => conversion(),
      persist,
      now: () => new Date("2030-05-02T00:00:00Z"),
      ...overrides
    } satisfies GoogleSyncDependencies
  };
}

describe("syncGoogleDoc", () => {
  it("is idempotent when Drive's modifiedTime has not advanced", async () => {
    const exportDocx = vi.fn(async () => new ArrayBuffer(0));
    const convert = vi.fn(async () => conversion());
    const { persist, deps: dependencies } = deps({
      driveClient: drive({ exportDocx })
    });

    const result = await syncGoogleDoc(
      target({ existingModifiedTime: MODIFIED }),
      { ...dependencies, convert }
    );

    expect(result).toEqual({ status: "unchanged", modifiedTime: MODIFIED });
    expect(exportDocx).not.toHaveBeenCalled();
    expect(convert).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });

  it("previews the converted AST and diff without writing", async () => {
    const { persist, deps: dependencies } = deps();

    const result = await syncGoogleDoc(
      target({ previousAst: ast("Old") }),
      dependencies,
      { mode: "preview" }
    );

    expect(result.status).toBe("preview");
    if (result.status !== "preview") return;
    expect(result.summary.addedHeadings).toEqual(["Imported"]);
    expect(result.summary.removedHeadings).toEqual(["Old"]);
    expect(persist).not.toHaveBeenCalled();
  });

  it("persists through the S3 writer with Google source metadata", async () => {
    const { persist, deps: dependencies } = deps();

    const result = await syncGoogleDoc(target(), dependencies);

    expect(result.status).toBe("synced");
    expect(persist).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "document",
        entityId: "entity-1",
        slug: "statute",
        status: "published",
        source: expect.objectContaining({
          provider: "google_doc",
          externalId: "drive-file-1",
          url: "https://docs.google.com/document/d/drive-file-1/edit",
          modifiedAt: MODIFIED,
          syncedAt: "2030-05-02T00:00:00.000Z"
        })
      })
    );
  });

  it("keeps the old copy when export is too large", async () => {
    const { persist, deps: dependencies } = deps({
      driveClient: drive({
        exportDocx: async () => {
          throw new DriveExportTooLargeError(11 * 1024 * 1024);
        }
      })
    });

    await expect(syncGoogleDoc(target(), dependencies)).resolves.toEqual({
      status: "failed",
      error: "export-too-large"
    });
    expect(persist).not.toHaveBeenCalled();
  });

  it("refuses an out-of-folder Google Doc without writing", async () => {
    const { persist, deps: dependencies } = deps({
      driveClient: drive({
        getFileMetadata: async () => {
          throw new DriveOutOfFolderError();
        }
      })
    });

    await expect(syncGoogleDoc(target(), dependencies)).resolves.toEqual({
      status: "failed",
      error: "out-of-folder"
    });
    expect(persist).not.toHaveBeenCalled();
  });

  it("fails closed when the shared folder is not configured", async () => {
    const { persist, deps: dependencies } = deps({
      driveClient: drive({
        getFileMetadata: async () => {
          throw new DriveFolderNotConfiguredError();
        }
      })
    });

    await expect(syncGoogleDoc(target(), dependencies)).resolves.toEqual({
      status: "failed",
      error: "folder-not-configured"
    });
    expect(persist).not.toHaveBeenCalled();
  });

  it("keeps the old copy on distinct metadata/export timeouts", async () => {
    const metadataTimeout = await syncGoogleDoc(
      target(),
      deps({
        driveClient: drive({
          getFileMetadata: async () => {
            throw new DriveTimeoutError("drive-metadata-timeout");
          }
        })
      }).deps
    );
    expect(metadataTimeout).toEqual({
      status: "failed",
      error: "drive-metadata-timeout"
    });

    const exportTimeout = await syncGoogleDoc(
      target(),
      deps({
        driveClient: drive({
          exportDocx: async () => {
            throw new DriveTimeoutError("drive-export-timeout");
          }
        })
      }).deps
    );
    expect(exportTimeout).toEqual({
      status: "failed",
      error: "drive-export-timeout"
    });
  });

  it("keeps the old copy when conversion fails", async () => {
    const { persist, deps: dependencies } = deps({
      convert: async () => {
        throw new ImportConversionError("docxInvalid");
      }
    });

    await expect(syncGoogleDoc(target(), dependencies)).resolves.toEqual({
      status: "failed",
      error: "conversion-failed",
      detail: "docxInvalid"
    });
    expect(persist).not.toHaveBeenCalled();
  });

  it("blocks publish when the converter reports blocking issues", async () => {
    const { persist, deps: dependencies } = deps({
      convert: async () =>
        conversion({
          publishable: false,
          issues: [{ code: "imageAltMissing", severity: "blocking" }]
        })
    });

    const result = await syncGoogleDoc(target(), dependencies);

    expect(result.status).toBe("blocked");
    expect(persist).not.toHaveBeenCalled();
  });

  it("does not mutate anything when persistence fails", async () => {
    const { deps: dependencies } = deps({
      persist: async () => {
        throw new Error("constraint");
      }
    });

    await expect(syncGoogleDoc(target(), dependencies)).resolves.toEqual({
      status: "failed",
      error: "persist-failed",
      detail: "Error"
    });
  });

  it("rejects a non-Google-Doc file and an invalid target", async () => {
    const { deps: dependencies } = deps({
      driveClient: drive({
        getFileMetadata: async () => ({
          ...METADATA,
          mimeType: "application/pdf"
        })
      })
    });

    await expect(syncGoogleDoc(target(), dependencies)).resolves.toEqual({
      status: "failed",
      error: "not-google-doc"
    });
    await expect(
      syncGoogleDoc(target({ title: "  " }), deps().deps)
    ).resolves.toEqual({ status: "failed", error: "invalid-target" });
  });

  it("force re-runs an unchanged document", async () => {
    const { deps: dependencies } = deps();
    const result = await syncGoogleDoc(
      target({ existingModifiedTime: MODIFIED }),
      dependencies,
      { force: true, mode: "preview" }
    );

    expect(result.status).toBe("preview");
  });
});
