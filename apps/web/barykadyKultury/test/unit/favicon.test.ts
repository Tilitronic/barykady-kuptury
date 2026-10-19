import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * T-034 (partial) — Favicon brand check (v3: bold letter-B mark).
 *
 * Verifies that:
 *  1. index.html links `favicon.svg?v=<N>` with the correct MIME type AND
 *     carries `sizes="any"` so scalable SVG favicons are reliably picked up
 *     by Firefox and Safari (Fix1).
 *  2. favicon.svg has explicit width/height attributes (Fix1 — intrinsic size).
 *  3. The mark is the approved v3 design: a solid SCARLET background with a
 *     bold GRAY93 letter "B" drawn as path outlines (no <text>, so no font
 *     dependency). Both brand colours must be present.
 *  4. public/favicon.svg is a VERBATIM copy of the committed source of truth
 *     src/assets/brand/favicon_mark.svg — the generator only rasterises; it
 *     never re-derives geometry (deterministic regeneration contract).
 *  5. All icon hrefs carry the ?v=<N> cache-busting query (Fix3; bumped to
 *     v=3 with this redesign) and the underlying files exist on disk when
 *     the query string is stripped.
 *  6. The generated favicon.ico is a brand icon, not the 69 KB Quasar default.
 *
 * These are file-system / static-asset checks run in Node (not happy-dom).
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
// test/unit/ → test/ → apps/web/barykadyKultury/
const APP_ROOT = join(__dirname, "..", "..");
const PUBLIC_DIR = join(APP_ROOT, "public");

function readPublic(relPath: string): Buffer {
  return readFileSync(join(PUBLIC_DIR, relPath));
}

function readPublicText(relPath: string): string {
  return readFileSync(join(PUBLIC_DIR, relPath), "utf8");
}

function readIndexHtml(): string {
  return readFileSync(join(APP_ROOT, "index.html"), "utf8");
}

describe("favicon — brand mark (T-034 partial, v3 letter-B)", () => {
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

  // ── v3 design: SCARLET bg + bold GRAY93 letter B (path outlines) ─────────

  it("favicon.svg background is SCARLET (#c60001) — visible on light chrome", () => {
    const svg = readPublicText("favicon.svg");
    // The rect fill must be SCARLET so the icon is visible on light tab strips.
    expect(svg).toMatch(/<rect[^>]*fill="#c60001"/);
  });

  it("favicon.svg glyph is the GRAY93 (#ededed) letter B on the SCARLET block", () => {
    const svg = readPublicText("favicon.svg");
    // The path fill must be GRAY93 (the bold B on the SCARLET surface).
    expect(svg).toMatch(/<path[^>]*fill="#ededed"/);
  });

  it("favicon.svg draws the B as font-independent path outlines", () => {
    const svg = readPublicText("favicon.svg");
    // evenodd counters (bowl holes) prove it is a real letterform path.
    expect(svg).toMatch(/fill-rule="evenodd"/);
    // A <text> element would silently depend on an installed/loaded font.
    expect(svg).not.toMatch(/<text[\s>]/);
  });

  it("favicon.svg uses a square 512-canvas viewBox", () => {
    const svg = readPublicText("favicon.svg");
    expect(svg).toMatch(/viewBox="0 0 512 512"/);
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

  it("favicon.svg contains the brand SCARLET colour", () => {
    const svg = readPublicText("favicon.svg");
    expect(svg).toContain("#c60001");
  });

  it("favicon.svg contains the brand GRAY93 colour", () => {
    const svg = readPublicText("favicon.svg");
    // Both brand colours are present in the SVG markup (bg + emblem).
    expect(svg).toContain("#ededed");
  });

  it("favicon.svg does not contain the Quasar default blue", () => {
    const svg = readPublicText("favicon.svg");
    expect(svg).not.toContain("#1976d2");
  });

  // ── Fix 3: Cache-busting query string ────────────────────────────────────

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
