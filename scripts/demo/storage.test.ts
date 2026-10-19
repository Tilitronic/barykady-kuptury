import { describe, expect, test } from "bun:test";

import {
  encodeStoragePath,
  expectedContentType,
  publicStorageUrl,
  storageObjectUrl
} from "./storage";

describe("storage URL builders", () => {
  test("encodes each path segment but keeps the slash separators", () => {
    expect(encodeStoragePath("demo/projects/a cover.png")).toBe(
      "demo/projects/a%20cover.png"
    );
  });

  test("builds the service upload and public read URLs", () => {
    expect(
      storageObjectUrl(
        "http://127.0.0.1:54321",
        "public-media",
        "demo/team/a.png"
      )
    ).toBe(
      "http://127.0.0.1:54321/storage/v1/object/public-media/demo/team/a.png"
    );
    expect(
      publicStorageUrl(
        "http://127.0.0.1:54321/",
        "public-documents",
        "demo/x-en.pdf"
      )
    ).toBe(
      "http://127.0.0.1:54321/storage/v1/object/public/public-documents/demo/x-en.pdf"
    );
  });

  test("maps buckets to the content types the browser must receive", () => {
    expect(expectedContentType("public-media")).toBe("image/png");
    expect(expectedContentType("public-documents")).toBe("application/pdf");
  });
});
