import { describe, expect, test } from "bun:test";
import { inflateSync } from "node:zlib";

import { BRAND, renderProjectCover, renderTeamAvatar } from "./art";

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function dimensions(buffer: Buffer): { width: number; height: number } {
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

/** Decompresses the single IDAT chunk and returns the RGB triples. */
function pixels(buffer: Buffer): [number, number, number][] {
  let offset = SIGNATURE.length;
  let idat: Buffer | null = null;
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    if (type === "IDAT")
      idat = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;
    if (type === "IEND") break;
  }

  const raw = inflateSync(idat!);
  const { width, height } = dimensions(buffer);
  const result: [number, number, number][] = [];
  for (let y = 0; y < height; y += 1) {
    const row = y * (1 + width * 3);
    for (let x = 0; x < width; x += 1) {
      const at = row + 1 + x * 3;
      result.push([raw[at]!, raw[at + 1]!, raw[at + 2]!]);
    }
  }
  return result;
}

const BRAND_COLORS = new Set([
  `${BRAND.scarlet.r},${BRAND.scarlet.g},${BRAND.scarlet.b}`,
  `${BRAND.nero.r},${BRAND.nero.g},${BRAND.nero.b}`,
  `${BRAND.gray.r},${BRAND.gray.g},${BRAND.gray.b}`
]);

describe("demo artwork", () => {
  test("project covers are 16:9 and use only the verified brand palette", () => {
    const png = renderProjectCover("demo-cultural-bridge");
    expect(dimensions(png)).toEqual({ width: 960, height: 540 });
    for (const [r, g, b] of pixels(png)) {
      expect(BRAND_COLORS.has(`${r},${g},${b}`)).toBe(true);
    }
  });

  test("team avatars are square, neutral and use only the brand palette", () => {
    const png = renderTeamAvatar("demo-member-one");
    expect(dimensions(png)).toEqual({ width: 384, height: 384 });
    for (const [r, g, b] of pixels(png)) {
      expect(BRAND_COLORS.has(`${r},${g},${b}`)).toBe(true);
    }
  });

  test("is deterministic per slug but varies across slugs", () => {
    expect(renderProjectCover("a")).toEqual(renderProjectCover("a"));
    expect(renderProjectCover("a")).not.toEqual(renderProjectCover("b"));
    expect(renderTeamAvatar("a")).toEqual(renderTeamAvatar("a"));
    expect(renderTeamAvatar("a")).not.toEqual(renderTeamAvatar("b"));
  });
});
