import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { generateAssetBuffer, writeDemoAssets } from "./assets";
import { buildAssetManifest } from "./manifest";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

describe("generateAssetBuffer", () => {
  const manifest = buildAssetManifest();

  test("renders PNG bytes for covers and avatars", () => {
    for (const asset of manifest.filter(
      candidate => candidate.kind === "cover" || candidate.kind === "avatar"
    )) {
      const buffer = generateAssetBuffer(asset);
      expect(buffer.subarray(0, 8)).toEqual(PNG_SIGNATURE);
    }
  });

  test("renders PDF bytes for publications and documents", () => {
    for (const asset of manifest.filter(
      candidate =>
        candidate.kind === "publication" || candidate.kind === "document"
    )) {
      expect(
        generateAssetBuffer(asset).toString("latin1").startsWith("%PDF-1.4")
      ).toBe(true);
    }
  });
});

describe("writeDemoAssets", () => {
  test("writes every manifest asset under .demo/assets/<bucket>/<path>", () => {
    const root = mkdtempSync(join(tmpdir(), "demo-assets-"));
    try {
      const generated = writeDemoAssets(root);
      expect(generated).toHaveLength(21);
      for (const item of generated) {
        expect(item.filePath).toBe(
          join(root, item.asset.bucket, item.asset.path)
        );
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
