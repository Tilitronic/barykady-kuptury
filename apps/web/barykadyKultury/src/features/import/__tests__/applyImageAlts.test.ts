import { describe, expect, it } from "vitest";

import { applyImageAlts } from "../applyImageAlts";
import type { ConversionResult } from "../types";

const ID = "0f8fad5b-d9cb-469f-a165-70867728950e";

function result(): ConversionResult {
  return {
    ast: {
      kind: "document",
      blocks: [
        { kind: "image", assetId: ID, alt: "image-1.png" },
        {
          kind: "blockquote",
          children: [{ kind: "image", assetId: ID, alt: "image-1.png" }]
        }
      ]
    },
    images: [
      {
        id: ID,
        fileName: "image-1.png",
        mimeType: "image/png",
        bytes: new ArrayBuffer(0),
        alt: "",
        needsAlt: true
      }
    ],
    issues: [
      { code: "imageAltMissing", severity: "blocking", detail: "image-1.png" }
    ],
    publishable: false
  };
}

describe("applyImageAlts", () => {
  it("updates the AST and clears the blocking issue once alt is supplied", () => {
    const updated = applyImageAlts(result(), { [ID]: "A red dot" });

    expect(updated.ast.blocks[0]).toEqual({
      kind: "image",
      assetId: ID,
      alt: "A red dot"
    });
    expect(updated.ast.blocks[1]).toMatchObject({
      kind: "blockquote",
      children: [{ kind: "image", assetId: ID, alt: "A red dot" }]
    });
    expect(updated.images[0]).toMatchObject({
      alt: "A red dot",
      needsAlt: false
    });
    expect(updated.issues).toEqual([]);
    expect(updated.publishable).toBe(true);
  });

  it("keeps publish blocked for an empty alt", () => {
    const updated = applyImageAlts(result(), { [ID]: "   " });

    expect(updated.publishable).toBe(false);
    expect(updated.issues).toContainEqual(
      expect.objectContaining({ code: "imageAltMissing", severity: "blocking" })
    );
  });
});
