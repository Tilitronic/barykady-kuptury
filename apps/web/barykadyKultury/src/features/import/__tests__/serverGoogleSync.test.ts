import { describe, expect, it, vi } from "vitest";

import {
  buildGoogleSyncTarget,
  runServerGoogleSync,
  type ServerGoogleSyncParams
} from "../serverGoogleSync";

function requestUrl(input: string | URL | Request): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

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

describe("runServerGoogleSync folder enforcement", () => {
  it("returns folder-not-configured for the deprecated env mode and never fetches a token", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = requestUrl(input);
      if (url.includes("/rest/v1/organization_documents")) {
        return new Response(
          JSON.stringify([
            {
              id: "entity-1",
              slug: "statute",
              status: "published",
              document_type: "report",
              allow_original_download: false,
              source_url: null,
              source_modified_at: null
            }
          ]),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      if (url.includes("/rest/v1/organization_document_translations")) {
        return new Response(
          JSON.stringify([
            {
              locale: "en",
              title: "Statute",
              description: null,
              body_ast: { kind: "document", blocks: [] },
              body_ast_version: 1
            }
          ]),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      if (url.includes("oauth2.googleapis.com/token")) {
        throw new Error("token must not be requested without a folder");
      }
      throw new Error(`unexpected ${url}`);
    });

    const result = await runServerGoogleSync(
      {
        supabase: {
          url: "https://db.example.test",
          serviceKey: "service-key",
          fetchImpl: fetchImpl as unknown as typeof fetch
        },
        googleEnv: {
          GOOGLE_IMPORT_AUTH_MODE: "env_oauth",
          GOOGLE_OAUTH_CLIENT_ID: "client-id",
          GOOGLE_OAUTH_CLIENT_SECRET: "client-secret",
          GOOGLE_OAUTH_REFRESH_TOKEN: "refresh-token"
        },
        fetchImpl: fetchImpl as unknown as typeof fetch
      },
      {
        kind: "document",
        entityId: "entity-1",
        locale: "en",
        fileId: "drive-1",
        mode: "apply",
        requestedBy: null
      }
    );

    expect(result).toEqual({
      status: "failed",
      error: "folder-not-configured"
    });
    expect(fetchImpl).not.toHaveBeenCalledWith(
      expect.stringContaining("oauth2.googleapis.com/token"),
      expect.anything()
    );
  });
});
