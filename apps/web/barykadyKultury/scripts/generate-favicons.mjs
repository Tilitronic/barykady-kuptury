#!/usr/bin/env node
/**
 * T-034 (partial) — Brand favicon generator
 * ==========================================
 * Derives all public favicon assets from the brand mark (logo_red_small.svg),
 * using headless Chromium (via Playwright, already a devDependency) for all
 * rasterisation. No native image-processing binaries are required.
 *
 * Usage (from repo root or app directory):
 *   node scripts/generate-favicons.mjs
 *
 * What it produces:
 *   public/favicon.svg                  — tight-viewBox brand mark SVG
 *   public/icons/favicon-16x16.png
 *   public/icons/favicon-32x32.png
 *   public/icons/favicon-96x96.png
 *   public/icons/favicon-128x128.png
 *   public/icons/apple-icon-180x180.png
 *   public/favicon.ico                  — single 32×32 PNG-in-ICO container
 *
 * Design decisions (see T-034 / DESIGN_SYSTEM.md §1 / D-13):
 *   - Artwork: emblem (B-shape outer shell) from logo_red_small.svg.
 *   - Interior wordmark paths are OMITTED — they are visual noise at ≤ 32 px.
 *   - Fill: SCARLET (#C60001) emblem on GRAY93 (#EDEDED) background.
 *   - Pairing: "red mark on GRAY93" is explicitly allowed by the brandbook
 *     (DESIGN_SYSTEM.md §1: "use the red or black variant on a solid background").
 *     GRAY93 is opaque, works in both light and dark browser chrome, and
 *     satisfies the iOS apple-touch-icon opaque-background requirement.
 *   - No light/dark SVG variants: a single GRAY93-background SVG is clear in
 *     both themes; the tab rendering does not change meaning by theme.
 *
 * Regenerate whenever the brand mark SVG is updated:
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

/** Brand colours — D-13, DESIGN_SYSTEM.md §1. */
const SCARLET = "#c60001";
const GRAY93 = "#ededed";

/**
 * Padding added around the measured emblem bbox (as a fraction of the larger
 * dimension) so the mark never bleeds to the very edge of the icon square.
 * 8 % per side gives a comfortable clear-space consistent with the
 * --logo-clear-space token (0.5 rem ≈ 8 % at a 6 rem icon height).
 */
const PADDING_FRACTION = 0.08;

async function main() {
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage();

    // ── 1. Measure the emblem's tight bounding box ─────────────────────────
    //
    // Load the source SVG in a headless page so we can call SVG getBBox().
    // We measure the FIRST path element (the outer B-shape, cls-2 = SCARLET)
    // and deliberately ignore the <g> group that holds the interior wordmark
    // text paths (cls-1 = white) — those are stripped from the favicon.
    const sourceSvgText = readFileSync(
      join(BRAND_DIR, "logo_red_small.svg"),
      "utf8"
    );

    await page.setContent(`<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>html,body{margin:0;padding:0;}</style>
</head><body>${sourceSvgText}</body></html>`);

    const emblemBbox = await page.evaluate(() => {
      const svg = document.getElementById("Layer_1");
      if (!svg) throw new Error("SVG#Layer_1 not found");
      // The emblem is the single <path> that precedes the <g> text group.
      const emblemPath = svg.querySelector("path");
      if (!emblemPath) throw new Error("Emblem path not found");
      const b = emblemPath.getBBox();
      return {
        x: b.x,
        y: b.y,
        width: b.width,
        height: b.height
      };
    });

    console.log(
      `Emblem bbox: x=${emblemBbox.x.toFixed(2)} y=${emblemBbox.y.toFixed(2)}` +
        ` w=${emblemBbox.width.toFixed(2)} h=${emblemBbox.height.toFixed(2)}`
    );

    // Extract the emblem path's d attribute for use in the standalone SVG.
    const emblemPathD = await page.evaluate(() => {
      const svg = document.getElementById("Layer_1");
      return svg.querySelector("path").getAttribute("d");
    });

    // ── 2. Compute a square tight viewBox with padding ─────────────────────
    //
    // Make the viewBox square (use the larger dimension) so the mark renders
    // in a proper square tab icon. Add symmetric padding so the mark does not
    // bleed to the edge.
    const maxDim = Math.max(emblemBbox.width, emblemBbox.height);
    const pad = maxDim * PADDING_FRACTION;
    const squareSide = maxDim + 2 * pad;

    // Centre the mark in the square box.
    const cx = emblemBbox.x + emblemBbox.width / 2;
    const cy = emblemBbox.y + emblemBbox.height / 2;
    const vx = cx - squareSide / 2;
    const vy = cy - squareSide / 2;

    const viewBox = [vx, vy, squareSide, squareSide]
      .map(n => Math.round(n * 100) / 100)
      .join(" ");

    console.log(`Tight viewBox: "${viewBox}"`);

    // ── 3. Write public/favicon.svg ────────────────────────────────────────
    const faviconSvg = buildFaviconSvg(
      viewBox,
      vx,
      vy,
      squareSide,
      emblemPathD
    );
    writeFileSync(join(PUBLIC_DIR, "favicon.svg"), faviconSvg, "utf8");
    console.log("Written: public/favicon.svg");

    // ── 4. Rasterise at each required size ────────────────────────────────
    const targets = [
      { size: 16, name: "favicon-16x16.png" },
      { size: 32, name: "favicon-32x32.png" },
      { size: 96, name: "favicon-96x96.png" },
      { size: 128, name: "favicon-128x128.png" },
      { size: 180, name: "apple-icon-180x180.png" }
    ];

    for (const { size, name } of targets) {
      await page.setViewportSize({ width: size, height: size });

      // Embed the favicon SVG inline at exact pixel dimensions. Inline SVG
      // avoids same-origin restrictions and ensures precise sizing.
      await page.setContent(`<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  html,body{margin:0;padding:0;width:${size}px;height:${size}px;overflow:hidden;background:${GRAY93};}
  svg{display:block;width:${size}px;height:${size}px;}
</style>
</head><body>
${faviconSvg.replace(/<\?xml[^>]*\?>\n?/, "")}
</body></html>`);

      const png = await page.screenshot({
        type: "png",
        clip: { x: 0, y: 0, width: size, height: size }
      });

      writeFileSync(join(ICONS_DIR, name), png);
      console.log(`Written: public/icons/${name} (${png.byteLength} bytes)`);
    }

    // ── 5. Pack favicon.ico (32×32 PNG-in-ICO) ────────────────────────────
    const png32 = readFileSync(join(ICONS_DIR, "favicon-32x32.png"));
    const ico = buildIco(png32);
    writeFileSync(join(PUBLIC_DIR, "favicon.ico"), ico);
    console.log(`Written: public/favicon.ico (${ico.byteLength} bytes)`);

    console.log("\nDone. All favicon assets regenerated.");
  } finally {
    await browser.close();
  }
}

/**
 * Returns the complete favicon.svg source string.
 *
 * The SVG:
 * - Has a tight square viewBox centred on the emblem.
 * - Carries a GRAY93 background rect (opaque — required for apple-touch-icon
 *   and visible in both light/dark OS themes without a transparent halo).
 * - Contains only the outer B-shape path (SCARLET fill); the interior wordmark
 *   paths (which are illegible below ~40 px) are intentionally omitted.
 */
function buildFaviconSvg(viewBox, vx, vy, side, pathD) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!--
  Barykady Kultury — favicon mark
  Source: logo_red_small.svg (emblem path only; wordmark omitted at tab size)
  Regenerate: node scripts/generate-favicons.mjs
  D-13: SCARLET ${SCARLET} · GRAY93 ${GRAY93}
-->
<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="${viewBox}"
  role="img"
  aria-label="Barykady Kultury"
>
  <rect
    x="${Math.round(vx * 100) / 100}"
    y="${Math.round(vy * 100) / 100}"
    width="${Math.round(side * 100) / 100}"
    height="${Math.round(side * 100) / 100}"
    fill="${GRAY93}"
  />
  <path fill="${SCARLET}" d="${pathD}" />
</svg>
`;
}

/**
 * Packs a single PNG buffer into a minimal ICO container (one 32×32 entry).
 *
 * ICO binary layout (single-image):
 *   ICONDIR   6 bytes: reserved(2) + type=1(2) + count=1(2)
 *   ICONDIRENTRY 16 bytes: width(1) + height(1) + colorCount(1) + reserved(1)
 *                          + planes(2) + bitCount(2) + dataSize(4) + offset(4)
 *   PNG data  N bytes
 *
 * Modern browsers (Chrome, Firefox, Safari, Edge) fully support PNG payloads
 * inside ICO containers and render them at the embedded pixel dimensions.
 */
function buildIco(pngData) {
  const ICONDIR = 6;
  const ICONDIRENTRY = 16;
  const dataOffset = ICONDIR + ICONDIRENTRY;
  const buf = Buffer.alloc(dataOffset + pngData.length);

  // ICONDIR
  buf.writeUInt16LE(0, 0); // reserved
  buf.writeUInt16LE(1, 2); // type = 1 (ICO)
  buf.writeUInt16LE(1, 4); // image count = 1

  // ICONDIRENTRY
  buf.writeUInt8(32, 6); // width  = 32 px
  buf.writeUInt8(32, 7); // height = 32 px
  buf.writeUInt8(0, 8); // color count (0 = not paletted / > 256 colors)
  buf.writeUInt8(0, 9); // reserved
  buf.writeUInt16LE(1, 10); // planes
  buf.writeUInt16LE(32, 12); // bits per pixel
  buf.writeUInt32LE(pngData.length, 14); // size of image data
  buf.writeUInt32LE(dataOffset, 18); // offset of image data

  pngData.copy(buf, dataOffset);
  return buf;
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
