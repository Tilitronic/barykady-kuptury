import type { ImportImageMimeType } from "./types";

/**
 * T-041 S3 — raster metadata for `content_assets`.
 *
 * The DB requires width, height and a lower-case SHA-256 before an asset can
 * be inserted. The converter deliberately does not decode pixels: header
 * parsing is deterministic, dependency-free and works identically in the
 * browser, a worker and Node tests. Only the three D-36 formats are accepted.
 */
export interface RasterMetadata {
  readonly width: number;
  readonly height: number;
  readonly sha256: string;
  readonly sizeBytes: number;
}

export class ImageMetadataError extends Error {
  readonly code = "imageUnsupported";

  constructor(message: string) {
    super(message);
    this.name = "ImageMetadataError";
  }
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function view(bytes: ArrayBuffer): DataView {
  return new DataView(bytes);
}

function pngDimensions(bytes: ArrayBuffer): { width: number; height: number } {
  const data = new Uint8Array(bytes);
  if (data.byteLength < 24) {
    throw new ImageMetadataError("PNG is truncated");
  }
  if (!PNG_SIGNATURE.every((byte, index) => data[index] === byte)) {
    throw new ImageMetadataError("PNG signature is invalid");
  }
  const png = view(bytes);
  return {
    width: png.getUint32(16, false),
    height: png.getUint32(20, false)
  };
}

const JPEG_SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf
]);

function jpegDimensions(bytes: ArrayBuffer): { width: number; height: number } {
  const data = new Uint8Array(bytes);
  if (data.byteLength < 4 || data[0] !== 0xff || data[1] !== 0xd8) {
    throw new ImageMetadataError("JPEG signature is invalid");
  }

  let offset = 2;
  while (offset + 3 < data.byteLength) {
    if (data[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    let markerOffset = offset + 1;
    while (data[markerOffset] === 0xff) markerOffset += 1;
    const marker = data[markerOffset];
    if (marker === undefined) break;

    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01) {
      offset = markerOffset + 1;
      continue;
    }
    if (marker >= 0xd0 && marker <= 0xd7) {
      offset = markerOffset + 1;
      continue;
    }

    const lengthOffset = markerOffset + 1;
    if (lengthOffset + 2 > data.byteLength) break;
    const length = view(bytes).getUint16(lengthOffset, false);
    if (length < 2) {
      throw new ImageMetadataError("JPEG segment length is invalid");
    }

    if (JPEG_SOF_MARKERS.has(marker)) {
      if (lengthOffset + 7 > data.byteLength) break;
      return {
        height: view(bytes).getUint16(lengthOffset + 3, false),
        width: view(bytes).getUint16(lengthOffset + 5, false)
      };
    }

    offset = lengthOffset + length;
  }

  throw new ImageMetadataError("JPEG frame header was not found");
}

function webpDimensions(bytes: ArrayBuffer): { width: number; height: number } {
  const data = new Uint8Array(bytes);
  if (data.byteLength < 30) {
    throw new ImageMetadataError("WebP is truncated");
  }
  if (
    String.fromCharCode(...data.slice(0, 4)) !== "RIFF" ||
    String.fromCharCode(...data.slice(8, 12)) !== "WEBP"
  ) {
    throw new ImageMetadataError("WebP signature is invalid");
  }

  const chunk = String.fromCharCode(...data.slice(12, 16));
  const webp = view(bytes);

  if (chunk === "VP8X") {
    return {
      width: 1 + (data[24]! | (data[25]! << 8) | (data[26]! << 16)),
      height: 1 + (data[27]! | (data[28]! << 8) | (data[29]! << 16))
    };
  }

  if (chunk === "VP8L") {
    if (data[20] !== 0x2f) {
      throw new ImageMetadataError("WebP lossless signature is invalid");
    }
    const bits = webp.getUint32(21, true);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1
    };
  }

  if (chunk === "VP8 ") {
    if (data[23] !== 0x9d || data[24] !== 0x01 || data[25] !== 0x2a) {
      throw new ImageMetadataError("WebP lossy start code is invalid");
    }
    return {
      width: webp.getUint16(26, true) & 0x3fff,
      height: webp.getUint16(28, true) & 0x3fff
    };
  }

  throw new ImageMetadataError("WebP chunk is not supported");
}

function dimensions(
  bytes: ArrayBuffer,
  mimeType: ImportImageMimeType
): { width: number; height: number } {
  switch (mimeType) {
    case "image/png":
      return pngDimensions(bytes);
    case "image/jpeg":
      return jpegDimensions(bytes);
    case "image/webp":
      return webpDimensions(bytes);
  }
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  if (typeof crypto === "undefined" || crypto.subtle === undefined) {
    throw new ImageMetadataError("SHA-256 is unavailable in this environment");
  }
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function inspectRasterImage(
  bytes: ArrayBuffer,
  mimeType: ImportImageMimeType
): Promise<RasterMetadata> {
  const { width, height } = dimensions(bytes, mimeType);
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1
  ) {
    throw new ImageMetadataError("image dimensions are invalid");
  }

  return {
    width,
    height,
    sha256: await sha256Hex(bytes),
    sizeBytes: bytes.byteLength
  };
}
