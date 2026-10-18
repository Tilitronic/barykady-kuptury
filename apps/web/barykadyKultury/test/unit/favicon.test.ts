import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * T-034 (partial) — Favicon brand check.
 *
 * Verifies that:
 *  1. index.html links `favicon.svg` with the correct MIME type — the SVG
 *     link is how modern browsers (Chrome, Firefox, Safari, Edge) pick up
 *     the tab icon, so its absence means every user sees the Quasar default.
 *  2. The generated favicon.svg is not the Quasar placeholder — it must
 *     contain the brand SCARLET colour (#c60001) and not the old Quasar
 *     blue (#1976d2, the Quasar primary that appears in its default icons).
 *  3. The generated favicon.ico is tiny (< 2 KB) — the old Quasar ICO was
 *     69 KB; a fresh brand ICO with a single 32×32 PNG payload is < 1 KB.
 *     This serves as a cheap regression guard against accidentally shipping
 *     the old file.
 *  4. Every icon path referenced in index.html actually exists on disk.
 *
 * These are file-system / static-asset checks so they run in Node, not
 * happy-dom, and need no component setup.
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

describe("favicon — brand mark (T-034 partial)", () => {
  it("index.html links favicon.svg with type=image/svg+xml", () => {
    const html = readIndexHtml();
    // Must contain the SVG icon link with the correct type attribute.
    expect(html).toMatch(
      /<link\s[^>]*type="image\/svg\+xml"[^>]*href="favicon\.svg"/
    );
  });

  it("index.html does not reference the old Quasar ICO type (image/ico)", () => {
    const html = readIndexHtml();
    // The old Quasar markup used type="image/ico"; correct is "image/x-icon".
    expect(html).not.toMatch(/type="image\/ico"/);
  });

  it("index.html references favicon.ico with type=image/x-icon", () => {
    const html = readIndexHtml();
    expect(html).toMatch(
      /<link\s[^>]*type="image\/x-icon"[^>]*href="favicon\.ico"/
    );
  });

  it("favicon.svg contains the brand SCARLET colour", () => {
    const svg = readPublicText("favicon.svg");
    // The brand mark must use the D-13 SCARLET value — not Quasar blue.
    expect(svg).toContain("#c60001");
  });

  it("favicon.svg does not contain the Quasar default blue", () => {
    const svg = readPublicText("favicon.svg");
    // Quasar's default favicon uses #1976d2 (Material Design primary blue).
    expect(svg).not.toContain("#1976d2");
  });

  it("favicon.svg contains a GRAY93 background", () => {
    const svg = readPublicText("favicon.svg");
    expect(svg).toContain("#ededed");
  });

  it("favicon.ico is a brand icon (< 2 KB — Quasar default was 69 KB)", () => {
    const ico = readPublic("favicon.ico");
    // The generated ICO wraps a single 32×32 PNG; total size is well under 2 KB.
    // The old Quasar ICO was 69 KB — if this fails the old file was restored.
    expect(ico.byteLength).toBeLessThan(2048);
  });

  it("favicon.ico starts with valid ICO magic bytes", () => {
    const ico = readPublic("favicon.ico");
    // ICO header: reserved=0x0000, type=0x0001 (ICO)
    expect(ico[0]).toBe(0x00);
    expect(ico[1]).toBe(0x00);
    expect(ico[2]).toBe(0x01);
    expect(ico[3]).toBe(0x00);
  });

  it("all icon paths referenced in index.html exist on disk", () => {
    const html = readIndexHtml();
    // Extract all href values from icon-related <link> tags.
    const iconHrefs = [
      ...html.matchAll(
        /<link\s[^>]*rel="(?:icon|apple-touch-icon)"[^>]*href="([^"]+)"/g
      )
    ].map(m => m[1]);

    expect(iconHrefs.length).toBeGreaterThan(0);

    for (const href of iconHrefs) {
      // href is root-relative (e.g. "favicon.svg", "icons/favicon-16x16.png")
      const absPath = join(PUBLIC_DIR, href!);
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
