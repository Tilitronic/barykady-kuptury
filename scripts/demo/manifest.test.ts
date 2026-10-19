import { describe, expect, test } from "bun:test";

import {
  buildAssetManifest,
  documentFilePath,
  projectCoverPath,
  publicationFilePath,
  teamAvatarPath
} from "./manifest";

describe("demo asset manifest", () => {
  const manifest = buildAssetManifest();

  test("contains exactly the demo assets the seed references", () => {
    expect(manifest).toHaveLength(21);
    expect(manifest.filter(asset => asset.kind === "cover")).toHaveLength(6);
    expect(manifest.filter(asset => asset.kind === "avatar")).toHaveLength(5);
    expect(manifest.filter(asset => asset.kind === "publication")).toHaveLength(
      7
    );
    expect(manifest.filter(asset => asset.kind === "document")).toHaveLength(3);
  });

  test("uses the fixed storage path contracts", () => {
    expect(projectCoverPath("demo-cultural-bridge")).toBe(
      "demo/projects/demo-cultural-bridge-cover.png"
    );
    expect(teamAvatarPath("demo-member-one")).toBe(
      "demo/team/demo-member-one.png"
    );
    expect(publicationFilePath("demo-cultural-bridges-report", "en")).toBe(
      "demo/publications/demo-cultural-bridges-report-en.pdf"
    );
    expect(documentFilePath("demo-statute", "uk")).toBe(
      "demo/documents/demo-statute-uk.pdf"
    );
  });

  test("routes media and documents to the correct public bucket", () => {
    for (const asset of manifest) {
      if (asset.kind === "cover" || asset.kind === "avatar") {
        expect(asset.bucket).toBe("public-media");
        expect(asset.mimeType).toBe("image/png");
      } else {
        expect(asset.bucket).toBe("public-documents");
        expect(asset.mimeType).toBe("application/pdf");
      }
    }
  });

  test("has unique, URL-safe paths", () => {
    const paths = manifest.map(asset => asset.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const path of paths) {
      expect(path).toMatch(
        /^demo\/(projects|team|publications|documents)\/[a-z0-9-]+\.(png|pdf)$/
      );
    }
  });

  test("covers all three locales for generated documents and publications", () => {
    expect(
      new Set(
        manifest
          .filter(asset => asset.kind === "publication")
          .map(asset => asset.locale)
      )
    ).toEqual(new Set(["en", "pl", "uk"]));
    expect(
      new Set(
        manifest
          .filter(asset => asset.kind === "document")
          .map(asset => asset.locale)
      )
    ).toEqual(new Set(["en", "pl", "uk"]));
  });

  test("includes the two featured project covers with ranks 1 and 2 plus rank 5", () => {
    const coverSlugs = manifest
      .filter(asset => asset.kind === "cover")
      .map(asset => asset.slug);
    expect(coverSlugs).toContain("demo-cultural-bridge");
    expect(coverSlugs).toContain("demo-language-lab");
    expect(coverSlugs).toContain("demo-memory-archive");
  });
});
