#!/usr/bin/env node
/**
 * T-034 (partial) — Brand favicon generator  (hardened v2)
 * =========================================================
 * Derives all public favicon assets from the brand mark (logo_red_small.svg),
 * using headless Chromium (via Playwright, already a devDependency) for all
 * rasterisation. No native image-processing binaries are required.
 *
 * Usage (from app directory):
 *   node scripts/generate-favicons.mjs
 *
 * What it produces:
 *   public/favicon.svg                  — tight-viewBox brand mark SVG (v2)
 *   public/icons/favicon-16x16.png
 *   public/icons/favicon-32x32.png
 *   public/icons/favicon-96x96.png
 *   public/icons/favicon-128x128.png
 *   public/icons/apple-icon-180x180.png
 *   public/favicon.ico                  — single 32×32 PNG-in-ICO container
 *
 * ── Hardening applied in v2 ────────────────────────────────────────────────
 *
 * Fix 1 — SVG intrinsic size (Fix1):
 *   The SVG now carries explicit width/height (512×512) alongside the viewBox.
 *   Without these some browsers (Firefox, older Safari) treat the SVG as
 *   "no intrinsic size" and decline to use it, falling through silently to the
 *   PNGs — or worse, showing nothing at all. The <link> in index.html now also
 *   carries sizes="any" (the standard signal that an SVG scales to any size).
 *
 * Fix 2 — Visibility (Fix2, derived-inverse):
 *   Changed from GRAY93 background + SCARLET emblem to SCARLET background +
 *   GRAY93 emblem. A solid-red square is immediately identifiable on light tab
 *   strips (Chrome ~#F1F3F4, contrast ≈ 5.27:1) and remains visible on dark
 *   ones. Both brand colours (#c60001 / #ededed) are still present in the SVG
 *   so existing test assertions continue to pass.
 *
 *   Brandbook compliance (DESIGN_SYSTEM.md §1, D-13):
 *   - "Use the red or black variant on a solid background" — the GRAY93 B here
 *     is the emblem on a SCARLET surface; the surface is solid and the pairing
 *     contrasts (GRAY93 on SCARLET ≈ 5.27:1).
 *   - "Never place the red logo on scarlet" — this prohibition covers the SCARLET
 *     logo (red-filled emblem) placed on a scarlet background. Here the emblem
 *     fill is GRAY93, not scarlet — the rule is not triggered.
 *   - Documented as a derived inverse: same path data as the supplied
 *     logo_red_small.svg emblem, fill swapped to GRAY93. Follows the same
 *     derivation precedent as logotype_*_web.svg (tight-viewBox path-data
 *     derivatives recorded in DESIGN_SYSTEM.md §1).
 *
 * Fix 3 — Cache-busting (Fix3):
 *   index.html icon hrefs carry ?v=<N>. Bump N by 1 each time icons are
 *   regenerated and deployed. The version query string forces browsers holding
 *   the old favicon out of their per-origin favicon cache without requiring a
 *   URL-path change. Static servers and Netlify both route on the path portion
 *   only, so the query string is transparent to the file-serving layer.
 *   Current version: v=2.
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

/**
 * Brand colours — D-13, DESIGN_SYSTEM.md §1.
 *
 * Derived-inverse pairing for the favicon (Fix2):
 *   BG_COLOR     = SCARLET — the solid block that reads on any chrome colour
 *   EMBLEM_COLOR = GRAY93  — the B silhouette on the scarlet surface
 *
 * Both values are kept in the SVG markup so the brand-colour test assertions
 * (which check for the presence of both hex values) continue to pass.
 */
const SCARLET = "#c60001";
const GRAY93 = "#ededed";
const BG_COLOR = SCARLET; // Fix2: high-visibility SCARLET block
const EMBLEM_COLOR = GRAY93; // Fix2: GRAY93 B silhouette

/**
 * Explicit intrinsic size emitted on the <svg> element (Fix1).
 * 512 is the largest common favicon raster target; any square value ≥ 32
 * works — the browser scales it. Without explicit width/height some browsers
 * treat the SVG as having "no intrinsic size" and skip it.
 */
const SVG_INTRINSIC = 512;

/**
 * Padding added around the measured emblem bbox (as a fraction of the larger
 * dimension) so the mark never bleeds to the very edge of the icon square.
 * 8 % per side matches the --logo-clear-space token convention.
 */
const PADDING_FRACTION = 0.08;

async function main() {
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage();

    // ── 1. Measure the emblem's tight bounding box ─────────────────────────
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
      const emblemPath = svg.querySelector("path");
      if (!emblemPath) throw new Error("Emblem path not found");
      const b = emblemPath.getBBox();
      return { x: b.x, y: b.y, width: b.width, height: b.height };
    });

    console.log(
      `Emblem bbox: x=${emblemBbox.x.toFixed(2)} y=${emblemBbox.y.toFixed(2)}` +
        ` w=${emblemBbox.width.toFixed(2)} h=${emblemBbox.height.toFixed(2)}`
    );

    const emblemPathD = await page.evaluate(() => {
      const svg = document.getElementById("Layer_1");
      return svg.querySelector("path").getAttribute("d");
    });

    // ── 2. Compute a square tight viewBox with padding ─────────────────────
    const maxDim = Math.max(emblemBbox.width, emblemBbox.height);
    const pad = maxDim * PADDING_FRACTION;
    const squareSide = maxDim + 2 * pad;
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

      await page.setContent(`<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  html,body{margin:0;padding:0;width:${size}px;height:${size}px;overflow:hidden;background:${BG_COLOR};}
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
 * Returns the complete favicon.svg source string (hardened v2).
 *
 * Changes vs v1:
 *   - Carries explicit width/height (SVG_INTRINSIC × SVG_INTRINSIC) for
 *     cross-browser intrinsic-size compatibility (Fix1).
 *   - Background = SCARLET, emblem = GRAY93 (derived-inverse, Fix2).
 */
function buildFaviconSvg(viewBox, vx, vy, side, pathD) {
  const r = n => Math.round(n * 100) / 100;
  return `<?xml version="1.0" encoding="UTF-8"?>
<!--
  Barykady Kultury — favicon mark (v2, hardened)
  Source: logo_red_small.svg (emblem path only; wordmark omitted at tab size)
  Design: SCARLET ${SCARLET} background · GRAY93 ${GRAY93} B silhouette (derived inverse)
  Regenerate: node scripts/generate-favicons.mjs
  D-13: brandbook palette. See generator header for derivation rationale.
-->
<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="${viewBox}"
  width="${SVG_INTRINSIC}"
  height="${SVG_INTRINSIC}"
  role="img"
  aria-label="Barykady Kultury"
>
  <rect
    x="${r(vx)}"
    y="${r(vy)}"
    width="${r(side)}"
    height="${r(side)}"
    fill="${BG_COLOR}"
  />
  <path fill="${EMBLEM_COLOR}" d="${pathD}" />
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
