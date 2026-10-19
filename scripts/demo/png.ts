/**
 * Tiny deterministic PNG encoder (truecolour, 8-bit, no interlace).
 *
 * The demo assets must be generated with built-in Node/Bun modules only
 * (AGENTS.md rule 7: no dependency for a bounded fixture need). We only need
 * opaque geometric artwork, so a full image library would be unjustified.
 *
 * The encoder writes the standard three chunks (IHDR, IDAT, IEND) with a
 * CRC-32 per chunk, and one filter byte (0 = None) per scanline. That is the
 * smallest PNG a browser will decode reliably.
 */
import { deflateSync } from "node:zlib";

export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

export type PixelRenderer = (x: number, y: number) => Rgb;

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

/** CRC-32 table for PNG chunk checksums (ISO-HDLC polynomial 0xedb88320). */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const typeBytes = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 0);
  return Buffer.concat([length, typeBytes, data, crc]);
}

/**
 * Encodes an opaque RGB image.
 *
 * The renderer is called once per pixel in row-major order. Throwing on
 * invalid dimensions keeps a zero-byte or corrupt asset from ever reaching
 * Storage (the uploader would otherwise accept the bytes and only the browser
 * would notice).
 */
export function encodePng(
  width: number,
  height: number,
  render: PixelRenderer
): Buffer {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new Error(
      `encodePng: dimensions must be positive integers, got ${width}x${height}`
    );
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour RGB
  ihdr[10] = 0; // compression: deflate
  ihdr[11] = 0; // filter method: adaptive
  ihdr[12] = 0; // interlace: none

  const scanlineLength = 1 + width * 3;
  const raw = Buffer.alloc(scanlineLength * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * scanlineLength;
    raw[rowStart] = 0; // filter: None
    for (let x = 0; x < width; x += 1) {
      const { r, g, b } = render(x, y);
      const offset = rowStart + 1 + x * 3;
      raw[offset] = r & 0xff;
      raw[offset + 1] = g & 0xff;
      raw[offset + 2] = b & 0xff;
    }
  }

  return Buffer.concat([
    PNG_SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0))
  ]);
}
