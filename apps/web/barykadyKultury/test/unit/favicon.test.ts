import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * T-034 (partial) — Favicon brand check (v4: the REAL brand emblem).
 *
 * User correction (2026-10-19): the favicon must be the actual supplied
 * brand emblem artwork (logo_red_small.svg — SCARLET "B" with white
 * interior "BARYKADY KULTURY" lettering), not the v3 hand-drawn letter "B".
 *
 * Verifies that:
 *  1. index.html links `favicon.svg?v=<N>` with the correct MIME type AND
 *     carries `sizes="any"` so scalable SVG favicons are reliably picked up
 *     by Firefox and Safari (Fix1).
 *  2. favicon.svg has explicit width/height attributes (Fix1 — intrinsic
 *     size) and the derived tight square viewBox (emblem bbox + 2-unit
 *     margin, centered — same precedent as the `_web` logotype files).
 *  3. The mark is the REAL emblem: the outer-path signature is taken
 *     verbatim from the supplied logo_red_small.svg, both brand colours
 *     (#c60001 SCARLET emblem, #fff white interior) are present, and there
 *     is no <text> element (no font dependency).
 *  4. public/favicon.svg is a VERBATIM copy of the committed source of truth
 *     src/assets/brand/favicon_mark.svg — the generator only rasterises; it
 *     never re-derives geometry (deterministic regeneration contract).
 *  5. All icon hrefs carry the ?v=4 cache-busting query (Fix3; bumped from
 *     v=3 with this correction) and the underlying files exist on disk when
 *     the query string is stripped.
 *  6. The generated favicon.ico is a small, valid brand icon, not the 69 KB
 *     Quasar default.
 *
 * These are file-system / static-asset checks run in Node (not happy-dom).
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
// test/unit/ → test/ → apps/web/barykadyKultury/
const APP_ROOT = join(__dirname, "..", "..");
const PUBLIC_DIR = join(APP_ROOT, "public");

/** Distinctive leading path data of the emblem's outer SCARLET path,
 *  byte-identical to the supplied NGOinfoSources logo_red_small.svg. */
const EMBLEM_PATH_SIGNATURE = 'd="M601.66,419.3c-1.59-2.37';

function readPublic(relPath: string): Buffer {
  return readFileSync(join(PUBLIC_DIR, relPath));
}

function readPublicText(relPath: string): string {
  return readFileSync(join(PUBLIC_DIR, relPath), "utf8");
}

function readIndexHtml(): string {
  return readFileSync(join(APP_ROOT, "index.html"), "utf8");
}

describe("favicon — real brand emblem (T-034 partial, v4)", () => {
  // ── Fix 1: SVG link correctness ──────────────────────────────────────────

  it("index.html SVG icon link has type=image/svg+xml and sizes=any", () => {
    const html = readIndexHtml();
    // The link element must carry both attributes in any order.
    expect(html).toMatch(
      /<link\s[^>]*type="image\/svg\+xml"[^>]*sizes="any"[^>]*href="favicon\.svg\?v=\d+"/
    );
  });

  it("favicon.svg carries explicit width and height (intrinsic size, Fix1)", () => {
    const svg = readPublicText("favicon.svg");
    expect(svg).toMatch(/\bwidth="512"/);
    expect(svg).toMatch(/\bheight="512"/);
  });

  // ── v4 design: the REAL supplied brand emblem ────────────────────────────

  it("favicon.svg carries the real emblem's path data verbatim", () => {
    const svg = readPublicText("favicon.svg");
    // Leading outer-path data copied byte-for-byte from the supplied
    // logo_red_small.svg — proves the real artwork, not redrawn geometry.
    expect(svg).toContain(EMBLEM_PATH_SIGNATURE);
  });

  it("favicon.svg uses the derived tight square viewBox (no rescaling)", () => {
    const svg = readPublicText("favicon.svg");
    // Measured emblem bbox + 2-unit margin, centered on a square canvas
    // (see the mark file header; same precedent as the `_web` files).
    expect(svg).toMatch(/viewBox="168\.92 160\.91 499\.31 499\.31"/);
  });

  it("favicon.svg contains the brand SCARLET colour (emblem field)", () => {
    const svg = readPublicText("favicon.svg");
    expect(svg).toContain("#c60001");
  });

  it("favicon.svg contains the white interior lettering colour", () => {
    const svg = readPublicText("favicon.svg");
    // logo_red_small.svg pairs #c60001 with #fff (the brandbook's
    // small-size variant); both fills must survive the derivation.
    expect(svg).toMatch(/fill:\s*#fff/);
  });

  it("favicon.svg is font-independent (path artwork, no <text>)", () => {
    const svg = readPublicText("favicon.svg");
    expect(svg).not.toMatch(/<text[\s>]/);
  });

  it("public/favicon.svg is a verbatim copy of src/assets/brand/favicon_mark.svg", () => {
    // Deterministic regeneration contract: the generator copies the
    // committed mark file byte-for-byte and only rasterises from it.
    const mark = readFileSync(
      join(APP_ROOT, "src", "assets", "brand", "favicon_mark.svg"),
      "utf8"
    );
    expect(readPublicText("favicon.svg")).toBe(mark);
  });

  it("favicon.svg does not contain the Quasar default blue", () => {
    const svg = readPublicText("favicon.svg");
    expect(svg).not.toContain("#1976d2");
  });

  // ── Fix 3: Cache-busting query string ────────────────────────────────────

  it("every icon href carries the v=4 cache-busting query (Fix3)", () => {
    const html = readIndexHtml();
    const iconHrefs = [
      ...html.matchAll(
        /<link\s[^>]*rel="(?:icon|apple-touch-icon)"[^>]*href="([^"]+)"/g
      )
    ].map(m => m[1]!);
    // svg + 4 PNGs + ico + apple-touch-icon
    expect(iconHrefs.length).toBeGreaterThanOrEqual(7);
    for (const href of iconHrefs) {
      expect(href, `icon href not bumped to v=4: ${href}`).toMatch(/\?v=4$/);
    }
    expect(html).not.toMatch(/\?v=3"/);
  });

  it("SVG icon href carries a version query string (cache-busting, Fix3)", () => {
    const html = readIndexHtml();
    expect(html).toMatch(/href="favicon\.svg\?v=\d+"/);
  });

  it("ICO icon href carries a version query string (Fix3)", () => {
    const html = readIndexHtml();
    expect(html).toMatch(
      /<link\s[^>]*type="image\/x-icon"[^>]*href="favicon\.ico\?v=\d+"/
    );
  });

  it("all PNG icon hrefs carry a version query string (Fix3)", () => {
    const html = readIndexHtml();
    const pngHrefs = [
      ...html.matchAll(/<link\s[^>]*type="image\/png"[^>]*href="([^"]+)"/g)
    ].map(m => m[1]!);
    expect(pngHrefs.length).toBeGreaterThanOrEqual(4);
    for (const href of pngHrefs) {
      expect(href, `PNG href missing version query: ${href}`).toMatch(
        /\?v=\d+$/
      );
    }
  });

  // ── Original checks (kept for regression) ────────────────────────────────

  it("index.html does not use the old Quasar ICO type (image/ico)", () => {
    const html = readIndexHtml();
    expect(html).not.toMatch(/type="image\/ico"/);
  });

  it("favicon.ico is a brand icon (< 2 KB — Quasar default was 69 KB)", () => {
    const ico = readPublic("favicon.ico");
    expect(ico.byteLength).toBeLessThan(2048);
  });

  it("favicon.ico starts with valid ICO magic bytes", () => {
    const ico = readPublic("favicon.ico");
    expect(ico[0]).toBe(0x00);
    expect(ico[1]).toBe(0x00);
    expect(ico[2]).toBe(0x01);
    expect(ico[3]).toBe(0x00);
  });

  it("all icon paths referenced in index.html exist on disk", () => {
    const html = readIndexHtml();
    // Strip the ?v=N query string before resolving the file path.
    const iconHrefs = [
      ...html.matchAll(
        /<link\s[^>]*rel="(?:icon|apple-touch-icon)"[^>]*href="([^"]+)"/g
      )
    ].map(m => m[1]!.replace(/\?[^"]*$/, ""));

    expect(iconHrefs.length).toBeGreaterThan(0);

    for (const href of iconHrefs) {
      const absPath = join(PUBLIC_DIR, href);
      let exists = true;
      try {
        readFileSync(absPath);
      } catch {
        exists = false;
      }
      expect(exists, `Missing icon file: ${href}`).toBe(true);
    }
  });
});
