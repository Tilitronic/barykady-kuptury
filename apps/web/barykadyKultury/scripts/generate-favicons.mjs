#!/usr/bin/env node
/**
 * T-034 (partial) — Brand favicon generator  (v4: the REAL brand emblem)
 * =======================================================================
 * All public favicon assets are derived from ONE self-contained source file:
 *
 *   src/assets/brand/favicon_mark.svg
 *
 * The mark is the actual brand emblem artwork — the SCARLET "B" with the
 * white interior "BARYKADY KULTURY" lettering, path data byte-identical to
 * the supplied NGOinfoSources/logo/SVG-20261017T122035Z-1-001/SVG/
 * logo_red_small.svg (only favicon-necessary attributes and a derived tight
 * square viewBox added; see the mark file's own header). This replaces the
 * v3 hand-drawn letter "B", which the user rejected on 2026-10-19: the
 * favicon must be the real brand icon. Headless Chromium (Playwright,
 * already a devDependency) handles all rasterisation, so no native
 * image-processing binaries are required.
 *
 * Usage (from app directory):
 *   node scripts/generate-favicons.mjs
 *
 * What it produces:
 *   public/favicon.svg                  — VERBATIM copy of favicon_mark.svg
 *   public/icons/favicon-16x16.png      — TRANSPARENT background
 *   public/icons/favicon-32x32.png      — TRANSPARENT background
 *   public/icons/favicon-96x96.png      — TRANSPARENT background
 *   public/icons/favicon-128x128.png    — TRANSPARENT background
 *   public/icons/apple-icon-180x180.png — composited on WHITE (iOS flattens
 *                                         transparency to black; white is
 *                                         the documented deliberate
 *                                         surface for the apple icon)
 *   public/favicon.ico                  — single 32×32 PNG-in-ICO container
 *                                         (alpha preserved)
 *
 * ── Background semantics (fixed in v4) ─────────────────────────────────────
 *
 * v3 painted a SCARLET page background under every raster because its mark
 * was a full-bleed red block. The real emblem is NOT full-bleed (the tight
 * square viewBox leaves transparent margins around the B), so a SCARLET
 * page background would draw a red square behind the red emblem — wrong on
 * light tabs (heavy block) and pointless on dark ones. v4 rasterises the
 * favicon PNGs on a genuinely TRANSPARENT canvas: the SCARLET field of the
 * icon is the emblem itself, so it reads on light AND dark browser chrome
 * without an added surface. Only apple-touch-icon gets an opaque surface
 * (white), because iOS requires one.
 *
 * ── Why v4 replaced the v3 derivation ──────────────────────────────────────
 *
 * v3 moved the single source of truth into a committed, hand-authored
 * letter-"B" SVG because the old abstract emblem "did not read at 16 px".
 * That premise was wrong: the supplied brandbook small-size variant
 * (logo_red_small.svg) IS a bold B silhouette and reads clearly at 16-32 px
 * (verified by rasterising it at 16/32/96/180 on light and dark surfaces).
 * v4 keeps v3's deterministic architecture — the generator copies the
 * committed mark VERBATIM (byte-identical output on every run) and only
 * rasterises from it — but the mark now carries the real emblem geometry.
 *
 * Brand colours kept in the emitted SVG markup (asserted by
 * test/unit/favicon.test.ts):
 *   #c60001 (SCARLET emblem) and #fff (white interior lettering) — D-13
 *   palette, DESIGN_SYSTEM.md §1, exactly as in the supplied source file.
 *
 * Fix 1 — SVG intrinsic size (kept):
 *   The mark carries explicit width/height (512×512) alongside the viewBox
 *   so browsers that require an intrinsic size use the SVG; the <link> in
 *   index.html carries sizes="any".
 *
 * Fix 3 — Cache-busting (kept):
 *   index.html icon hrefs carry ?v=<N>. Bump N by 1 each time icons are
 *   regenerated and deployed. This change bumped v=3 → v=4.
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
 * Brand colour used ONLY as the documented opaque surface for
 * apple-touch-icon (iOS flattens transparency to black). The favicon PNGs
 * and ICO rasterise on a transparent canvas — the SCARLET field of the icon
 * is the emblem itself (see header). The mark file carries the
 * authoritative fills (#c60001 + #fff, from the supplied brand SVG).
 */
const APPLE_SURFACE = "#ffffff";

/** The single source of truth, copied verbatim to public/favicon.svg. */
const MARK_PATH = join(BRAND_DIR, "favicon_mark.svg");

async function main() {
  const mark = readFileSync(MARK_PATH, "utf8");

  // Sanity gate: the mark must still be the REAL brand emblem — the outer
  // path signature taken verbatim from the supplied logo_red_small.svg, both
  // brand hexes (SCARLET emblem + white interior), the derived tight square
  // viewBox, the intrinsic-size attributes (Fix1) and no <text>. Fail
  // loudly instead of writing an asset that breaks the contract
  // (test/unit/favicon.test.ts asserts the same invariants).
  const checks = [
    {
      pattern: /d="M601\.66,419\.3c/,
      expected: true,
      message:
        "must carry the real emblem's outer-path signature from logo_red_small.svg"
    },
    {
      pattern: /#c60001/,
      expected: true,
      message: "must contain SCARLET #c60001"
    },
    {
      pattern: /fill: #fff/,
      expected: true,
      message: "must contain the white (#fff) interior lettering"
    },
    {
      pattern: /viewBox="168\.92 160\.91 499\.31 499\.31"/,
      expected: true,
      message: "must carry the derived tight square viewBox"
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
    // `surface: null` → genuinely transparent canvas (favicon PNGs/ICO);
    // the emblem itself provides all colour, so the icon reads on light and
    // dark browser chrome without an added block. Only the apple-touch-icon
    // is composited on an opaque surface (white — see header).
    const targets = [
      { size: 16, name: "favicon-16x16.png", surface: null },
      { size: 32, name: "favicon-32x32.png", surface: null },
      { size: 96, name: "favicon-96x96.png", surface: null },
      { size: 128, name: "favicon-128x128.png", surface: null },
      { size: 180, name: "apple-icon-180x180.png", surface: APPLE_SURFACE }
    ];

    const inlineSvg = mark.replace(/<\?xml[^>]*\?>\n?/, "");

    for (const { size, name, surface } of targets) {
      await page.setViewportSize({ width: size, height: size });

      await page.setContent(`<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  html,body{margin:0;padding:0;width:${size}px;height:${size}px;overflow:hidden;${surface ? `background:${surface};` : ""}}
  svg{display:block;width:${size}px;height:${size}px;}
</style>
</head><body>
${inlineSvg}
</body></html>`);

      const png = await page.screenshot({
        type: "png",
        omitBackground: surface === null,
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
