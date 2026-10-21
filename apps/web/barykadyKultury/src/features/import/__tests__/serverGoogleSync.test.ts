import { describe, expect, it } from "vitest";

import {
  buildGoogleSyncTarget,
  type ServerGoogleSyncParams
} from "../serverGoogleSync";

/** T-042 S7 — server target construction (no Drive/Supabase calls). */
const PARAMS: ServerGoogleSyncParams = {
  kind: "document",
  entityId: "entity-1",
  locale: "en",
  fileId: "drive-1",
  mode: "apply"
};

describe("buildGoogleSyncTarget", () => {
  it("maps stored root/translation metadata and the previous AST", () => {
    const target = buildGoogleSyncTarget(
      PARAMS,
      {
        id: "entity-1",
        slug: "statute",
        status: "published",
        document_type: "regulations",
        allow_original_download: true,
        source_url: "https://docs.google.com/document/d/drive-1/edit",
        source_modified_at: "2030-05-01T00:00:00Z"
      },
      {
        locale: "en",
        title: "Statute",
        description: "Description",
        body_ast: { kind: "document", blocks: [] },
        body_ast_version: 1
      }
    );

    expect(target).toMatchObject({
      kind: "document",
      entityId: "entity-1",
      slug: "statute",
      title: "Statute",
      existingStatus: "published",
      existingModifiedTime: "2030-05-01T00:00:00Z",
      allowOriginalDownload: true,
      fileId: "drive-1"
    });
    expect(target?.previousAst).toEqual({ kind: "document", blocks: [] });
  });

  it("supports publication abstracts and rejects an unsupported AST version", () => {
    const target = buildGoogleSyncTarget(
      { ...PARAMS, kind: "publication" },
      {
        id: "entity-2",
        slug: "pub",
        status: "draft",
        allow_original_download: false,
        source_modified_at: null
      },
      {
        locale: "en",
        title: "Publication",
        abstract: "Abstract",
        body_ast: { kind: "document", blocks: [] },
        body_ast_version: 2
      }
    );

    expect(target).toMatchObject({
      kind: "publication",
      description: "Abstract",
      existingStatus: "draft",
      previousAst: null
    });
  });
});
