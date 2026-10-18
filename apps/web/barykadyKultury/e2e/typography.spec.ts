import { expect } from "@playwright/test";

import { test } from "./support/network-guard";

/**
 * T-007 — Typography E2E checks.
 *
 * What these tests prove:
 * 1. Inter Variable is loaded and covers Latin (English + Polish diacritics).
 * 2. Inter Variable covers Ukrainian Cyrillic (і ї є ґ).
 * 3. No request to fonts.googleapis.com or fonts.gstatic.com is made
 *    (self-hosting verification in the live build artifact).
 *
 * Strategy for font checks:
 *   `document.fonts.load(spec, text)` triggers downloading the subset that
 *   covers `text` and resolves when it is ready.  `document.fonts.check(spec,
 *   text)` then returns true if the font was loaded for that text.  This proves
 *   that the specific woff2 subset was fetched from the server, not just that
 *   a font face declaration exists in the CSS.
 *
 * The `test` import extends Playwright's base with the "no live services"
 * network-guard fixture (e2e/support/network-guard.ts).  Any request to a
 *  non-app origin (including Google Fonts CDNs) is aborted and fails the test
 *  automatically — the explicit Google Fonts assertion below is belt-and-
 *  suspenders to provide a clearer failure message.
 */

const FONT_SPEC = '"Inter Variable"';

test.describe("typography", () => {
  test("Inter Variable loads and covers Latin (English + Polish diacritics)", async ({
    page
  }) => {
    await page.goto("/en");

    // Wait for fonts to be ready, then load the Latin/Latin-ext subset.
    const loaded = await page.evaluate(async (spec: string) => {
      await document.fonts.ready;
      // Trigger download of the latin + latin-ext subsets.
      // Polish diacritics: ą ć ę ł ń ó ś ź ż (latin-ext subset).
      await document.fonts.load(
        `16px ${spec}`,
        "Hello Barykady Kultury ą ć ę ł ń ó ś ź ż"
      );
      return document.fonts.check(`16px ${spec}`, "ą ć ę ł ń ó ś ź ż");
    }, FONT_SPEC);

    expect(loaded).toBe(true);
  });

  test("Inter Variable loads and covers Ukrainian Cyrillic (і ї є ґ)", async ({
    page
  }) => {
    await page.goto("/en");

    const loaded = await page.evaluate(async (spec: string) => {
      await document.fonts.ready;
      // Trigger download of the cyrillic subset.
      // Ukrainian-specific characters: і (U+0456), ї (U+0457), є (U+0454), ґ (U+0491).
      await document.fonts.load(`16px ${spec}`, "і ї є ґ");
      return document.fonts.check(`16px ${spec}`, "і ї є ґ");
    }, FONT_SPEC);

    expect(loaded).toBe(true);
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
