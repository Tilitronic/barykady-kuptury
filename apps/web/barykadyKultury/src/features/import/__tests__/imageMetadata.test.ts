import { describe, expect, it } from "vitest";

import { ImageMetadataError, inspectRasterImage } from "../imageMetadata";

/** Minimal header fixtures; the parser never decodes pixel data. */
function png(width: number, height: number): ArrayBuffer {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13, false); // IHDR length
  bytes.set([0x49, 0x48, 0x44, 0x52], 12); // IHDR
  view.setUint32(16, width, false);
  view.setUint32(20, height, false);
  return bytes.buffer;
}

function jpeg(width: number, height: number): ArrayBuffer {
  const bytes = new Uint8Array([
    0xff,
    0xd8, // SOI
    0xff,
    0xe0,
    0x00,
    0x04,
    0x00,
    0x00, // APP0, length 4
    0xff,
    0xc0,
    0x00,
    0x11,
    0x08, // SOF0, length 17, precision
    0x00,
    0x00, // height placeholder
    0x00,
    0x00, // width placeholder
    0x03,
    0x01,
    0x11,
    0x00,
    0x02,
    0x11,
    0x01,
    0x03,
    0x11,
    0x01
  ]);
  const view = new DataView(bytes.buffer);
  view.setUint16(13, height, false);
  view.setUint16(15, width, false);
  return bytes.buffer;
}

function webp(width: number, height: number): ArrayBuffer {
  const bytes = new Uint8Array(30);
  bytes.set([...new TextEncoder().encode("RIFF")], 0);
  bytes.set([...new TextEncoder().encode("WEBP")], 8);
  bytes.set([...new TextEncoder().encode("VP8X")], 12);
  const w = width - 1;
  const h = height - 1;
  bytes.set([w & 0xff, (w >> 8) & 0xff, (w >> 16) & 0xff], 24);
  bytes.set([h & 0xff, (h >> 8) & 0xff, (h >> 16) & 0xff], 27);
  return bytes.buffer;
}

describe("inspectRasterImage", () => {
  it("reads PNG dimensions and a lower-case SHA-256", async () => {
    const metadata = await inspectRasterImage(png(640, 360), "image/png");

    expect(metadata).toMatchObject({ width: 640, height: 360, sizeBytes: 33 });
    expect(metadata.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("reads JPEG dimensions from the SOF marker", async () => {
    await expect(
      inspectRasterImage(jpeg(1200, 630), "image/jpeg")
    ).resolves.toMatchObject({ width: 1200, height: 630 });
  });

  it("reads WebP VP8X dimensions", async () => {
    await expect(
      inspectRasterImage(webp(320, 200), "image/webp")
    ).resolves.toMatchObject({ width: 320, height: 200 });
  });

  it("rejects a mismatched header", async () => {
    await expect(
      inspectRasterImage(png(10, 10), "image/jpeg")
    ).rejects.toBeInstanceOf(ImageMetadataError);
  });
});
