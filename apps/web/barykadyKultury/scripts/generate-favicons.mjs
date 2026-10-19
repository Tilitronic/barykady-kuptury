#!/usr/bin/env node
/**
 * T-034 (partial) — Brand favicon generator  (v3: dedicated letter-B mark)
 * =========================================================================
 * All public favicon assets are derived from ONE self-contained source file:
 *
 *   src/assets/brand/favicon_mark.svg
 *
 * The mark is a bold, filled letter "B" (SVG path outlines, no <text>, no
 * font dependency) on a solid SCARLET block — the user-approved redesign of
 * the v2 barricade-emblem favicon, which did not read at 16 px. Headless
 * Chromium (Playwright, already a devDependency) handles all rasterisation,
 * so no native image-processing binaries are required.
 *
 * Usage (from app directory):
 *   node scripts/generate-favicons.mjs
 *
 * What it produces:
 *   public/favicon.svg                  — VERBATIM copy of favicon_mark.svg
 *   public/icons/favicon-16x16.png
 *   public/icons/favicon-32x32.png
 *   public/icons/favicon-96x96.png
 *   public/icons/favicon-128x128.png
 *   public/icons/apple-icon-180x180.png — opaque (the SCARLET rect is the
 *                                          full-bleed background)
 *   public/favicon.ico                  — single 32×32 PNG-in-ICO container
 *
 * ── Why v3 replaced the v2 derivation ──────────────────────────────────────
 *
 * v2 measured the emblem bbox inside logo_red_small.svg at generation time
 * and re-emitted its path with swapped fills. That made the output depend on
 * (a) the emblem's path geometry and (b) a live getBBox() measurement — and
 * the resulting abstract barricade shape is unreadable at 16×16. v3 moves the
 * single source of truth into a committed, hand-authored SVG: the generator
 * copies it verbatim (fully deterministic — byte-identical output on every
 * run and platform) and only rasterises from it.
 *
 * Brand colours kept in the emitted SVG markup (asserted by
 * test/unit/favicon.test.ts):
 *   #c60001 (SCARLET background) and #ededed (GRAY93 glyph) — D-13 palette,
 *   DESIGN_SYSTEM.md §1. GRAY93-on-SCARLET is the same inverted pairing v2
 *   used; the solid red block reads on both light and dark browser chrome.
 *
 * Fix 1 — SVG intrinsic size (kept):
 *   The mark carries explicit width/height (512×512) alongside the viewBox
 *   so browsers that require an intrinsic size use the SVG; the <link> in
 *   index.html carries sizes="any".
 *
 * Fix 3 — Cache-busting (kept):
 *   index.html icon hrefs carry ?v=<N>. Bump N by 1 each time icons are
 *   regenerated and deployed. This redesign bumped v=2 → v=3.
 *
 * Regenerate whenever favicon_mark.svg is updated:
 *   pnpm --dir apps/web/barykadyKultury exec node scripts/generate-favicons.mjs
 */

import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const APP_ROOT = join(__dirname, "..");
const BRAND_DIR = join(APP_ROOT, "src", "assets", "brand");
const PUBLIC_DIR = join(APP_ROOT, "public");
const ICONS_DIR = join(PUBLIC_DIR, "icons");

/**
 * Brand colours — D-13, DESIGN_SYSTEM.md §1. Used only for the raster page
 * background (seam-free edges under Chromium's antialiasing); the mark file
 * itself carries the authoritative fills.
 */
const SCARLET = "#c60001";

/** The single source of truth, copied verbatim to public/favicon.svg. */
const MARK_PATH = join(BRAND_DIR, "favicon_mark.svg");

async function main() {
  const mark = readFileSync(MARK_PATH, "utf8");

  // Sanity gate: the emitted SVG must keep both brand hexes (test/unit/
  // favicon.test.ts asserts them), the intrinsic-size attributes (Fix1) and
  // a pure-path glyph. Fail loudly instead of writing an asset that breaks
  // the contract.
  const checks = [
    {
      pattern: /#c60001/,
      expected: true,
      message: "must contain SCARLET #c60001"
    },
    {
      pattern: /#ededed/,
      expected: true,
      message: "must contain GRAY93 #ededed"
    },
    {
      pattern: /\bwidth="512"/,
      expected: true,
      message: 'must carry width="512" (Fix1)'
    },
    {
      pattern: /\bheight="512"/,
      expected: true,
      message: 'must carry height="512" (Fix1)'
    },
    {
      pattern: /<path[^>]*fill="#ededed"/s,
      expected: true,
      message: "must draw the B as a <path> with a fill attribute"
    },
    {
      pattern: /<text/,
      expected: false,
      message: "must NOT use <text> (font dependency)"
    }
  ];
  for (const { pattern, expected, message } of checks) {
    if (pattern.test(mark) !== expected) {
      throw new Error(
        `favicon_mark.svg ${message}: src/assets/brand/favicon_mark.svg`
      );
    }
  }

  // Deterministic verbatim copy: regenerating never changes the bytes.
  writeFileSync(join(PUBLIC_DIR, "favicon.svg"), mark, "utf8");
  console.log(
    "Written: public/favicon.svg (verbatim copy of favicon_mark.svg)"
  );

  const browser = await chromium.launch();

  try {
    const page = await browser.newPage();

    // ── Rasterise at each required size ────────────────────────────────────
    const targets = [
      { size: 16, name: "favicon-16x16.png" },
      { size: 32, name: "favicon-32x32.png" },
      { size: 96, name: "favicon-96x96.png" },
      { size: 128, name: "favicon-128x128.png" },
      { size: 180, name: "apple-icon-180x180.png" }
    ];

    const inlineSvg = mark.replace(/<\?xml[^>]*\?>\n?/, "");

    for (const { size, name } of targets) {
      await page.setViewportSize({ width: size, height: size });

      await page.setContent(`<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  html,body{margin:0;padding:0;width:${size}px;height:${size}px;overflow:hidden;background:${SCARLET};}
  svg{display:block;width:${size}px;height:${size}px;}
</style>
</head><body>
${inlineSvg}
</body></html>`);

      const png = await page.screenshot({
        type: "png",
        clip: { x: 0, y: 0, width: size, height: size }
      });

      writeFileSync(join(ICONS_DIR, name), png);
      console.log(`Written: public/icons/${name} (${png.byteLength} bytes)`);
    }

    // ── Pack favicon.ico (32×32 PNG-in-ICO) ────────────────────────────────
    const png32 = readFileSync(join(ICONS_DIR, "favicon-32x32.png"));
    const ico = buildIco(png32);
    writeFileSync(join(PUBLIC_DIR, "favicon.ico"), ico);
    console.log(`Written: public/favicon.ico (${ico.byteLength} bytes)`);

    console.log(
      "\nDone. All favicon assets regenerated from favicon_mark.svg."
    );
  } finally {
    await browser.close();
  }
}

/**
 * Packs a single PNG buffer into a minimal ICO container (one 32×32 entry).
 *
 * ICO binary layout (single-image):
 *   ICONDIR   6 bytes: reserved(2) + type=1(2) + count=1(2)
 *   ICONDIRENTRY 16 bytes: width(1) + height(1) + colorCount(1) + reserved(1)
 *                          + planes(2) + bitCount(2) + dataSize(4) + offset(4)
 *   PNG data  N bytes
 */
function buildIco(pngData) {
  const ICONDIR = 6;
  const ICONDIRENTRY = 16;
  const dataOffset = ICONDIR + ICONDIRENTRY;
  const buf = Buffer.alloc(dataOffset + pngData.length);

  buf.writeUInt16LE(0, 0);
  buf.writeUInt16LE(1, 2);
  buf.writeUInt16LE(1, 4);
  buf.writeUInt8(32, 6);
  buf.writeUInt8(32, 7);
  buf.writeUInt8(0, 8);
  buf.writeUInt8(0, 9);
  buf.writeUInt16LE(1, 10);
  buf.writeUInt16LE(32, 12);
  buf.writeUInt32LE(pngData.length, 14);
  buf.writeUInt32LE(dataOffset, 18);
  pngData.copy(buf, dataOffset);
  return buf;
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
