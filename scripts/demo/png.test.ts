import { describe, expect, test } from "bun:test";
import { inflateSync } from "node:zlib";

import { encodePng, type Rgb } from "./png";

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

/** Reads the chunk list so tests can assert structure without a PNG dependency. */
function chunks(buffer: Buffer): { type: string; data: Buffer }[] {
  const result: { type: string; data: Buffer }[] = [];
  let offset = SIGNATURE.length;
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    result.push({ type, data });
    offset += 12 + length;
    if (type === "IEND") break;
  }
  return result;
}

describe("encodePng", () => {
  test("writes a valid PNG signature, IHDR and IEND", () => {
    const buffer = encodePng(3, 2, () => ({ r: 198, g: 0, b: 1 }));

    expect(buffer.subarray(0, 8)).toEqual(SIGNATURE);
    const parsed = chunks(buffer);
    expect(parsed.map(chunk => chunk.type)).toEqual(["IHDR", "IDAT", "IEND"]);

    const ihdr = parsed[0]!.data;
    expect(ihdr.readUInt32BE(0)).toBe(3);
    expect(ihdr.readUInt32BE(4)).toBe(2);
    expect(ihdr[8]).toBe(8); // bit depth
    expect(ihdr[9]).toBe(2); // truecolour RGB
    expect(ihdr[10]).toBe(0); // deflate
    expect(ihdr[11]).toBe(0); // adaptive filtering
    expect(ihdr[12]).toBe(0); // no interlace
  });

  test("encodes one filter byte per scanline and the RGB pixels", () => {
    const colors: Rgb[] = [
      { r: 10, g: 20, b: 30 },
      { r: 40, g: 50, b: 60 },
      { r: 70, g: 80, b: 90 },
      { r: 100, g: 110, b: 120 }
    ];
    const buffer = encodePng(2, 2, (x, y) => colors[y * 2 + x]!);
    const idat = chunks(buffer).find(chunk => chunk.type === "IDAT")!.data;
    const raw = inflateSync(idat);

    expect([...raw]).toEqual([
      0, 10, 20, 30, 40, 50, 60, 0, 70, 80, 90, 100, 110, 120
    ]);
  });

  test("is deterministic for the same inputs", () => {
    const render = () =>
      encodePng(8, 8, (x, y) => ({ r: x * 8, g: y * 8, b: 0 }));
    expect(render()).toEqual(render());
  });

  test("rejects non-positive dimensions", () => {
    expect(() => encodePng(0, 1, () => ({ r: 0, g: 0, b: 0 }))).toThrow();
    expect(() => encodePng(1, -1, () => ({ r: 0, g: 0, b: 0 }))).toThrow();
  });
});
