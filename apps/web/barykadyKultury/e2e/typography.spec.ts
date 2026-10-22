import { expect } from "@playwright/test";

import { test } from "./support/network-guard";

/**
 * D-40 — Typography font contract E2E checks.
 *
 * What these tests prove (against the live production build artifact):
 * 1. FreeSerif (self-hosted) loads and covers Latin + full Polish diacritics
 *    (ąćęłńóśźż incl. capitals) in the normal AND the real-bold face.
 * 2. FreeSerif covers the Ukrainian letters Ґґ Єє Іі Її natively — the hard
 *    codepoint gate from D-40, verified through the shipped cyrillic subset.
 * 3. The distributed @font-face inventory is exactly 9 faces
 *    (latin/latin-ext/cyrillic × normal-400/bold-700/italic-400). Weights
 *    outside {400, 700} are rejected (no faux-bold), and a real italic face
 *    exists (no synthetic oblique for <em> or the card fallback styles).
 * 4. The latin normal subset is preloaded, and the browser fetches the
 *    cyrillic subset for Cyrillic text — proving the subsets are distributed,
 *    not just declared.
 * 5. No request to fonts.googleapis.com / fonts.gstatic.com (self-hosted).
 *
 * Strategy:
 *   `document.fonts.load(spec, text)` triggers the unicode-range matching and
 *   downloads the covering subset; it resolves with the FontFace objects that
 *   matched, so an empty array means no self-hosted face covers the text (the
 *   glyphs would fall through to the system fallback). `document.fonts.check`
 *   alone is not trusted as coverage proof — it also returns true for codepoints
 *   no face claims — so every coverage assertion requires a non-empty load
 *   result AND asserts the subset file was fetched over the network.
 *
 * The `test` import extends Playwright's base with the "no live services"
 * network-guard fixture (e2e/support/network-guard.ts). Any request to a
 * non-app origin is aborted and fails the test automatically — the explicit
 * Google Fonts assertion below is belt-and-suspenders for a clearer failure
 * message.
 */

const FONT_SPEC = '"FreeSerif"';

/** Subset files that must exist under /fonts/ (D-40 9-face inventory). */
const SUBSETS = ["latin", "latin-ext", "cyrillic"] as const;
const FACES = ["normal", "bold", "italic"] as const;

function fontFileUrl(subset: string, face: string): string {
  return `/fonts/freeserif-${subset}-${face}.woff2`;
}

test.describe("typography — FreeSerif font contract (D-40)", () => {
  test("body text renders the FreeSerif family stack", async ({ page }) => {
    await page.goto("/en");

    const family = await page.evaluate(() =>
      getComputedStyle(document.body).fontFamily.replace(/["']/g, "")
    );
    expect(family, "body stack must lead with FreeSerif").toContain(
      "FreeSerif"
    );
  });

  test("preload references the latin normal FreeSerif subset", async ({
    page
  }) => {
    await page.goto("/en");

    const href = await page.evaluate(
      () =>
        document
          .querySelector('link[rel="preload"][as="font"]')
          ?.getAttribute("href") ?? null
    );
    expect(href).toBe(fontFileUrl("latin", "normal"));
  });

  test("FreeSerif normal + bold cover Latin and Polish diacritics natively", async ({
    page
  }) => {
    await page.goto("/en");

    const result = await page.evaluate(async (spec: string) => {
      await document.fonts.ready;
      const text = "Barykady Kultury ą ć ę ł ń ó ś ź ż Ą Ć Ę Ł Ń Ó Ś Ź Ż";
      const normal = await document.fonts.load(`16px ${spec}`, text);
      const normalOk = document.fonts.check(`16px ${spec}`, text);
      // The bold faces are the only way to get real (not synthesized) bold
      // under D-40 — they must claim the same Polish letters.
      const bold = await document.fonts.load(`bold 16px ${spec}`, text);
      const boldOk = document.fonts.check(`bold 16px ${spec}`, text);
      return {
        normalCount: normal.length,
        normalOk,
        boldCount: bold.length,
        boldOk
      };
    }, FONT_SPEC);

    expect(
      result.normalCount,
      "no FreeSerif face claims the PL/Latin text"
    ).toBeGreaterThan(0);
    expect(result.normalOk).toBe(true);
    expect(
      result.boldCount,
      "no FreeSerif bold face claims the PL/Latin text"
    ).toBeGreaterThan(0);
    expect(result.boldOk).toBe(true);
  });

  test("FreeSerif covers Ukrainian Ґґ Єє Іі Її via the cyrillic subset (hard gate)", async ({
    page
  }) => {
    await page.goto("/en");

    const fetched = new Set<string>();
    page.on("response", response => {
      if (/\/fonts\/freeserif-.*\.woff2$/.test(response.url())) {
        fetched.add(new URL(response.url()).pathname);
      }
    });

    const result = await page.evaluate(async (spec: string) => {
      await document.fonts.ready;
      // The exact D-40 letter pairs plus a real Ukrainian phrase.
      const text = "Ґґ Єє Іі Її і ї є — Барикади культури";
      const loaded = await document.fonts.load(`16px ${spec}`, text);
      const ok = document.fonts.check(`16px ${spec}`, text);
      return { count: loaded.length, ok };
    }, FONT_SPEC);

    // Non-empty load proves a self-hosted face CLAIMS these codepoints (a
    // missing Ґ/ґ would resolve to [] and fall through to the system font);
    // the response assertion proves the cyrillic subset was actually shipped
    // and fetched. Both are required — neither alone is sufficient.
    expect(
      result.count,
      "FreeSerif subsets do not claim the UA letters"
    ).toBeGreaterThan(0);
    expect(result.ok).toBe(true);
    expect(
      [...fetched],
      "cyrillic subset was never fetched over the network"
    ).toContain(fontFileUrl("cyrillic", "normal"));
  });

  test("face inventory is exactly 9 real faces — no faux-bold, no synthesized italic", async ({
    page
  }) => {
    await page.goto("/en");

    const faces = await page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts]
        .filter(f => f.family.replace(/^["']|["']$/g, "") === "FreeSerif")
        .map(f => ({
          style: f.style,
          weight: f.weight.replace(/^["']|["']$/g, "")
        }));
    });

    // 3 subsets × {400 normal, 700 bold, 400 italic} = 9 declared faces.
    expect(faces).toHaveLength(9);
    const byWeight = faces.reduce<Record<string, number>>((acc, f) => {
      const key = `${f.style}/${f.weight}`;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
    expect(byWeight).toEqual({
      "normal/400": 3,
      "normal/700": 3,
      "italic/400": 3
    });

    // Italic must be a REAL face for the brand text — <em> and the card
    // fallback styles depend on it (brandbook uses no italics, the product
    // does; synthesis is the only thing that is banned).
    const italicOk = await page.evaluate(async (spec: string) => {
      await document.fonts.ready;
      const loaded = await document.fonts.load(
        `italic 16px ${spec}`,
        "Barykady łąki"
      );
      return (
        loaded.length > 0 && document.fonts.check(`italic 16px ${spec}`, "łą")
      );
    }, FONT_SPEC);
    expect(
      italicOk,
      "no real italic face — browser would synthesize oblique"
    ).toBe(true);
  });

  test("every shipped subset file resolves 200 (self-hosted artifacts exist)", async ({
    page
  }) => {
    await page.goto("/en");

    for (const subset of SUBSETS) {
      for (const face of FACES) {
        const url = fontFileUrl(subset, face);
        const response = await page.request.get(url);
        expect(response.status(), `${url} missing`).toBe(200);
        expect(
          response.headers()["content-type"] ?? "",
          `${url} wrong type`
        ).toMatch(/font\/woff2|application\/octet-stream/);
      }
    }
  });

  test("no request to fonts.googleapis.com or fonts.gstatic.com (self-hosted)", async ({
    page
  }) => {
    // Belt-and-suspenders: the network-guard fixture already aborts all external
    // requests, but this explicit assertion produces a specific, actionable
    // failure message if a Google Fonts URL ever appears in the build output.
    const googleFontRequests: string[] = [];

    await page.route("**/*", async route => {
      const url = route.request().url();
      if (/fonts\.(googleapis|gstatic)\.com/i.test(url)) {
        googleFontRequests.push(url);
        await route.abort("blockedbyclient");
        return;
      }
      await route.fallback();
    });

    await page.goto("/en");
    await page.evaluate(() => document.fonts.ready);

    expect(
      googleFontRequests,
      `Expected zero Google Fonts CDN requests but found:\n${googleFontRequests.join("\n")}`
    ).toHaveLength(0);
  });
});
