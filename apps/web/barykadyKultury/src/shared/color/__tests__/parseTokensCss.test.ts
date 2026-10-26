/**
 * T-033 audit finding H-1 — parser regression tests.
 *
 * The dark-theme rows of `contrast.test.ts` silently measured LIGHT values for
 * months because the selector walk matched the literal `[data-theme="dark"]`
 * text quoted inside tokens.css documentation comments and then collected the
 * NEXT real block (`:root`) as a dark candidate. These tests pin the
 * MECHANISM with a synthetic sample so the harness itself is verified
 * independently of the brand token values (which the CSS remains authoritative
 * for).
 */

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  CSS_PATH,
  extractBlock,
  parseHex,
  parseThemeHexes,
  stripCssComments
} from "./parseTokensCss";

const SYNTHETIC = `
/* Design note: the contract says [data-theme="dark"] is the ONLY selector.
   And :root is the light theme. Quoted here, must be ignored. */
:root {
  --color-x: #111111;
  --color-only-light: #333333;
}

[data-theme="dark"] {
  --color-x: #222222;
}
`;

describe("stripCssComments", () => {
  it("removes block comments including quoted selectors", () => {
    expect(stripCssComments(SYNTHETIC)).not.toContain("ONLY selector");
  });

  it("keeps real declarations", () => {
    expect(stripCssComments(SYNTHETIC)).toContain("--color-x: #111111");
  });
});

describe("parseThemeHexes — comment-safe extraction (finding H-1)", () => {
  const { light, dark } = parseThemeHexes(SYNTHETIC);

  it("reads the light map from the real :root block only", () => {
    expect(light["color-x"]).toBe("#111111");
  });

  it("reads the dark map from the real [data-theme=dark] block, NOT the block that follows a comment mention", () => {
    expect(dark["color-x"]).toBe("#222222");
  });

  it("does not leak light-only tokens into the dark map", () => {
    expect(dark["color-only-light"]).toBeNull();
  });
});

/**
 * T-033: tokens.css keeps its dark palette in two places — the explicit
 * `[data-theme="dark"]` block and the `prefers-color-scheme: dark` media
 * block (D-20: "must stay identical"). That promise had no guard; this test
 * mechanically compares every hex declaration of the standalone block against
 * the media block, so a new dark token can never be added to one and missed
 * in the other.
 */
describe("dark palette parity — [data-theme=dark] vs prefers-color-scheme", () => {
  const cssText = readFileSync(CSS_PATH, "utf-8");
  const standalone = extractBlock(cssText, '[data-theme="dark"]') ?? "";
  const media = extractBlock(cssText, "prefers-color-scheme: dark") ?? "";

  const names: string[] = [
    ...new Set(
      [...standalone.matchAll(/--([a-z][a-z0-9-]*):/g)]
        .map(match => match[1])
        .filter((name): name is string => name !== undefined)
    )
  ];

  it("found both blocks and a non-trivial token list", () => {
    expect(standalone.length).toBeGreaterThan(0);
    expect(media.length).toBeGreaterThan(0);
    expect(names.length).toBeGreaterThan(20);
  });

  for (const name of names) {
    const value = parseHex(standalone, name);
    if (value === null) continue;
    it(`--${name}: media block matches the explicit dark block`, () => {
      expect(
        parseHex(media, name),
        `--${name} differs between dark blocks`
      ).toBe(value);
    });
  }
});
