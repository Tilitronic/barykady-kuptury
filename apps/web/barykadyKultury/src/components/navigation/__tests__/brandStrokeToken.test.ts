import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Brand-stroke single-source guard.
 *
 * The active-page nav underline must keep the same thickness as the left
 * stem of the "B" monogram in the header logotype. The measurement lives in
 * tokens.css as one token chain
 * (`--brand-wordmark-stem-ratio` x `--brand-logo-height-md` ->
 * `--nav-active-stroke`); this test fails if any consumer re-hardcodes a
 * px value, which is how the two would silently drift apart.
 *
 * Ratio source: Chromium raster of logotype_red_web.svg — the B's left stem
 * is 108 px at a 1000 px render height (0.108 of height). E2E
 * (e2e/brand-stroke.spec.ts) asserts the RENDERED thickness in both themes
 * and the drawer band; this file pins the wiring.
 */
const appRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../.."
);

function read(relative: string): string {
  return readFileSync(`${appRoot}/${relative}`, "utf8");
}

describe("brand stroke token chain", () => {
  it("tokens.css defines the stem ratio, the md logo height and the derived stroke", () => {
    const tokens = read("src/css/tokens.css");

    expect(tokens).toContain("--brand-wordmark-stem-ratio: 0.108;");
    expect(tokens).toContain("--brand-logo-height-md: 48px;");
    // The calc may be line-wrapped by the formatter — match the wiring, not
    // the formatting.
    expect(tokens).toMatch(
      /--nav-active-stroke:\s*calc\(\s*var\(--brand-logo-height-md\)\s*\*\s*var\(--brand-wordmark-stem-ratio\)\s*\)/
    );
  });

  it("BrandLogo's md size reads the same height token (no second 48px source)", () => {
    const logo = read("src/components/brand/BrandLogo.vue");

    expect(logo).toContain(
      "--logo-size: var(--brand-logo-size, var(--brand-logo-height-md, 48px));"
    );
  });

  it("AppHeader strokes the active link from the token — underline AND drawer rule", () => {
    const header = read("src/components/navigation/AppHeader.vue");

    expect(header).toContain("border-bottom: var(--nav-active-stroke) solid");
    expect(header).toContain("border-left: var(--nav-active-stroke) solid");
    // The pre-token hardcoded 2 px underline must be gone from the nav link.
    expect(header).not.toContain("border-bottom: 2px solid transparent");
  });
});
