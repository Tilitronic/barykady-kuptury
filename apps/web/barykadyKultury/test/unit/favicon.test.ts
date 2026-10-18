import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * T-034 (partial) — Favicon brand check (hardened v2).
 *
 * Verifies that:
 *  1. index.html links `favicon.svg?v=2` with the correct MIME type AND
 *     carries `sizes="any"` so scalable SVG favicons are reliably picked up
 *     by Firefox and Safari (Fix1).
 *  2. favicon.svg has explicit width/height attributes (Fix1 — intrinsic size).
 *  3. The generated favicon.svg is SCARLET background + GRAY93 B silhouette
 *     (derived-inverse hardening, Fix2). Both brand colours must be present.
 *  4. All icon hrefs carry the ?v=<N> cache-busting query (Fix3) and the
 *     underlying files exist on disk when the query string is stripped.
 *  5. The generated favicon.ico is a brand icon, not the 69 KB Quasar default.
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

describe("favicon — brand mark (T-034 partial, hardened v2)", () => {
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

  // ── Fix 2: Visibility — SCARLET bg + GRAY93 emblem ───────────────────────

  it("favicon.svg background is SCARLET (#c60001) — visible on light chrome", () => {
    const svg = readPublicText("favicon.svg");
    // The rect fill must be SCARLET so the icon is visible on light tab strips.
    expect(svg).toMatch(/<rect[^>]*fill="#c60001"/);
  });

  it("favicon.svg emblem is GRAY93 (#ededed) — derived-inverse design", () => {
    const svg = readPublicText("favicon.svg");
    // The path fill must be GRAY93 (the B silhouette on the SCARLET surface).
    expect(svg).toMatch(/<path[^>]*fill="#ededed"/);
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
