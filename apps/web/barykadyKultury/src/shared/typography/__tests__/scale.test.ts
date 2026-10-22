/**
 * T-007 — Type scale unit tests.
 *
 * WHY this test exists:
 * The brandbook anchors (DESIGN_SYSTEM.md §2) must be enforced mechanically so
 * a future edit to scale.ts cannot silently drift from the brandbook or from
 * typography.css. scale.ts is the single source of truth; these tests are the
 * contract between the TypeScript module and the CSS file.
 *
 * Review findings applied (rev-2, B):
 *   The gate now covers ALL 7 font-size tokens (not just display + body),
 *   plus all line-height, weight, and measure tokens. A future edit to
 *   scale.ts that is not mirrored in typography.css will fail this suite.
 *
 * D-40 (brand typeface → GNU FreeSerif): the file inventory, weight literals
 *   and real-face invariants below encode the replacement — 9 static faces,
 *   weights restricted to {400, 700}, real italic for <em>/fallback styles,
 *   and the brand-critical Polish + Ukrainian unicode ranges gated in CSS.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, beforeAll } from "vitest";
import {
  scale,
  lineHeights,
  weights,
  measure
} from "@/shared/typography/scale";

// ─── 1. Brandbook anchors ────────────────────────────────────────────────────

describe("type scale — brandbook anchors (DESIGN_SYSTEM.md §2, brandbook p.13–14)", () => {
  it("display desktop value equals 64px (brandbook anchor)", () => {
    expect(scale.display.desktop).toBe("64px");
  });

  it("section heading (h2) desktop value equals 34px (brandbook anchor)", () => {
    expect(scale.h2.desktop).toBe("34px");
  });

  it("body desktop value equals 16px (brandbook anchor)", () => {
    expect(scale.body.desktop).toBe("16px");
  });
});

// ─── 2. Monotonic scale at mobile and desktop ────────────────────────────────

/**
 * Parse the numeric pixel value from a string like "64px" → 64.
 * Throws if the string is not in `<number>px` form — a deliberate guard
 * against silent parse failures (e.g. a future change to rem units would
 * break this assertion rather than silently passing).
 */
function px(value: string): number {
  const match = /^(\d+(?:\.\d+)?)px$/.exec(value);
  if (!match?.[1]) throw new Error(`Expected a px value, got: "${value}"`);
  return parseFloat(match[1]);
}

describe("type scale — monotonic at mobile design width (375 px)", () => {
  it("display > h1 > h2 > h3 > h4 > body > small", () => {
    expect(px(scale.display.mobile)).toBeGreaterThan(px(scale.h1.mobile));
    expect(px(scale.h1.mobile)).toBeGreaterThan(px(scale.h2.mobile));
    expect(px(scale.h2.mobile)).toBeGreaterThan(px(scale.h3.mobile));
    expect(px(scale.h3.mobile)).toBeGreaterThan(px(scale.h4.mobile));
    expect(px(scale.h4.mobile)).toBeGreaterThan(px(scale.body.mobile));
    expect(px(scale.body.mobile)).toBeGreaterThan(px(scale.small.mobile));
  });

  it("no two adjacent levels overlap at mobile", () => {
    const levels = [
      scale.display,
      scale.h1,
      scale.h2,
      scale.h3,
      scale.h4,
      scale.body,
      scale.small
    ];
    for (let i = 0; i < levels.length - 1; i++) {
      // Mobile value of each level must be strictly larger than the next.
      expect(px(levels[i]!.mobile)).toBeGreaterThan(px(levels[i + 1]!.mobile));
    }
  });
});

describe("type scale — monotonic at desktop design width (1280 px)", () => {
  it("display > h1 > h2 > h3 > h4 > body > small", () => {
    expect(px(scale.display.desktop)).toBeGreaterThan(px(scale.h1.desktop));
    expect(px(scale.h1.desktop)).toBeGreaterThan(px(scale.h2.desktop));
    expect(px(scale.h2.desktop)).toBeGreaterThan(px(scale.h3.desktop));
    expect(px(scale.h3.desktop)).toBeGreaterThan(px(scale.h4.desktop));
    expect(px(scale.h4.desktop)).toBeGreaterThan(px(scale.body.desktop));
    expect(px(scale.body.desktop)).toBeGreaterThan(px(scale.small.desktop));
  });
});

// ─── Shared CSS fixture ───────────────────────────────────────────────────────

const TYPOGRAPHY_CSS_PATH = join(process.cwd(), "src/css/typography.css");

// Helper: strip CSS comments and collapse whitespace for reliable contains()
// checks. This prevents comment-only appearances of a value from passing the
// assertion.
function strippedCss(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "") // remove /* ... */ comments
    .replace(/\s+/g, " ") // collapse whitespace
    .trim();
}

// ─── 3. Font file coverage in typography.css ─────────────────────────────────
//
// WHY: The font loading strategy must be proven, not assumed (T-007 scope).
// D-40 replaces Inter with GNU FreeSerif: three static weights-worth of faces
// (normal 400, bold 700, italic 400) across three unicode-range subsets. This
// gate pins the distributed file inventory and the brand-critical unicode
// ranges inside the CSS so a future edit cannot silently drop Polish or
// Ukrainian coverage.

/** Extract @font-face blocks (comment-stripped) from the raw CSS source. */
function fontFaceBlocks(text: string): string[] {
  const withoutComments = text.replace(/\/\*[\s\S]*?\*\//g, "");
  return withoutComments.match(/@font-face\s*\{[^}]+\}/g) ?? [];
}

describe("typography.css — FreeSerif subset coverage (D-40)", () => {
  let cssText = "";

  beforeAll(() => {
    cssText = readFileSync(TYPOGRAPHY_CSS_PATH, "utf-8");
  });

  const subsets = ["latin", "latin-ext", "cyrillic"] as const;
  const faces = ["normal", "bold", "italic"] as const;

  for (const subset of subsets) {
    for (const face of faces) {
      it(`references freeserif-${subset}-${face}.woff2`, () => {
        expect(cssText).toContain(`freeserif-${subset}-${face}.woff2`);
      });
    }
  }

  it("declares exactly 9 @font-face rules (3 subsets × 3 faces)", () => {
    expect(fontFaceBlocks(cssText)).toHaveLength(9);
  });

  it("every @font-face declares the FreeSerif family (no Inter remnants)", () => {
    for (const block of fontFaceBlocks(cssText)) {
      expect(block).toMatch(/font-family:\s*"FreeSerif"/);
      expect(block).not.toMatch(/Inter/);
    }
  });

  it("every @font-face pins a real weight: 400 or 700 only (no faux-bold axis)", () => {
    // FreeSerif ships static instances; a range like `font-weight: 100 900`
    // or an intermediate 500/600 would mean the browser picks a nearest
    // face and the design token no longer describes what renders.
    for (const block of fontFaceBlocks(cssText)) {
      const match = /font-weight:\s*([^;]+);/.exec(block);
      expect(match?.[1]?.trim()).toMatch(/^(400|700)$/);
    }
  });

  it("every @font-face declares one of the real styles: normal or italic", () => {
    for (const block of fontFaceBlocks(cssText)) {
      expect(block).toMatch(/font-style:\s*(normal|italic);/);
    }
    const italics = fontFaceBlocks(cssText).filter(b =>
      /font-style:\s*italic/.test(b)
    );
    // <em> (reader + richText) and the card fallback styles use italic — the
    // real face must exist for every subset, never the synthesized oblique.
    expect(italics).toHaveLength(3);
  });

  it("cyrillic subset claims the Ukrainian letters (U+0400-045F + Ґ U+0490-0491)", () => {
    const cyrillic = fontFaceBlocks(cssText).filter(b =>
      b.includes("freeserif-cyrillic")
    );
    expect(cyrillic).toHaveLength(3);
    for (const block of cyrillic) {
      expect(block).toContain("U+0400-045F");
      expect(block).toContain("U+0490-0491");
    }
  });

  it("latin-ext subset claims the Polish Latin Ext-A range (U+0100-02BA)", () => {
    const latinExt = fontFaceBlocks(cssText).filter(b =>
      b.includes("freeserif-latin-ext")
    );
    expect(latinExt.length).toBeGreaterThan(0);
    for (const block of latinExt) {
      expect(block).toContain("U+0100-02BA");
    }
  });

  it("all @font-face declarations use font-display: swap", () => {
    // Every @font-face block must opt into swap display (T-007 scope).
    const fontFaceBlocksParsed = fontFaceBlocks(cssText);
    expect(fontFaceBlocksParsed.length).toBeGreaterThan(0);
    for (const block of fontFaceBlocksParsed) {
      expect(block).toContain("font-display: swap");
    }
  });

  it("does not reference fonts.googleapis.com or fonts.gstatic.com (no third-party CDN)", () => {
    expect(cssText).not.toMatch(/fonts\.(googleapis|gstatic)\.com/i);
  });
});

// ─── 4. CSS custom properties — ALL font sizes gate (rev-2 finding B) ────────
//
// WHY all 7 (not just display + body):
//   scale.ts claims to be the source of truth. Gating only 2 of 7 leaves 5
//   sizes free to drift silently. This gate makes drift mechanically impossible
//   for every token.

describe("typography.css — ALL --font-size-* tokens match scale.ts (rev-2 gate)", () => {
  let css = "";

  beforeAll(() => {
    css = strippedCss(readFileSync(TYPOGRAPHY_CSS_PATH, "utf-8"));
  });

  const cases: [keyof typeof scale, string][] = [
    ["display", "--font-size-display"],
    ["h1", "--font-size-h1"],
    ["h2", "--font-size-h2"],
    ["h3", "--font-size-h3"],
    ["h4", "--font-size-h4"],
    ["body", "--font-size-body"],
    ["small", "--font-size-small"]
  ];

  for (const [level, prop] of cases) {
    it(`${prop} equals scale.${level}.fluid`, () => {
      expect(css).toContain(`${prop}: ${scale[level].fluid}`);
    });
  }
});

// ─── 5. CSS custom properties — line-heights, weights, measure gate ───────────

describe("typography.css — line-height tokens match scale.ts lineHeights", () => {
  let css = "";

  beforeAll(() => {
    css = strippedCss(readFileSync(TYPOGRAPHY_CSS_PATH, "utf-8"));
  });

  it("--line-height-display equals lineHeights.display", () => {
    expect(css).toContain(`--line-height-display: ${lineHeights.display}`);
  });

  it("--line-height-heading equals lineHeights.heading", () => {
    expect(css).toContain(`--line-height-heading: ${lineHeights.heading}`);
  });

  it("--line-height-body equals lineHeights.body", () => {
    expect(css).toContain(`--line-height-body: ${lineHeights.body}`);
  });

  it("--line-height-small equals lineHeights.small", () => {
    expect(css).toContain(`--line-height-small: ${lineHeights.small}`);
  });
});

describe("typography.css — font-weight tokens match scale.ts weights", () => {
  let css = "";

  beforeAll(() => {
    css = strippedCss(readFileSync(TYPOGRAPHY_CSS_PATH, "utf-8"));
  });

  it("--font-weight-display equals weights.display (400 — D-40: real Regular, size-led display)", () => {
    expect(css).toContain(`--font-weight-display: ${weights.display}`);
  });

  it("--font-weight-heading equals weights.heading (700 — real Bold)", () => {
    expect(css).toContain(`--font-weight-heading: ${weights.heading}`);
  });

  it("--font-weight-h4 equals weights.h4 (700 — D-40: real Bold, no Semi axis)", () => {
    expect(css).toContain(`--font-weight-h4: ${weights.h4}`);
  });

  it("--font-weight-body equals weights.body (400 — Regular)", () => {
    expect(css).toContain(`--font-weight-body: ${weights.body}`);
  });

  it("--font-weight-small equals weights.small (400 — Regular)", () => {
    expect(css).toContain(`--font-weight-small: ${weights.small}`);
  });
});

// ─── 5b. D-40 weight contract (literal, not just CSS↔TS mirroring) ───────────
//
// WHY literals: the mirror gate above proves CSS and scale.ts agree, but both
// could agree on a value FreeSerif cannot render. GNU FreeSerif ships exactly
// two weights (Regular 400, Bold 700) — any intermediate token (500, 600)
// would silently re-map to a neighbour face, making the token a lie about what
// renders ("faux" hierarchy). D-40 therefore freezes the token vocabulary to
// the real faces and rebuilds hierarchy through size/tracking instead.

describe("scale.ts — D-40 real-face weight contract", () => {
  it("display is 400 — Medium (500) does not exist in FreeSerif; dominance via size", () => {
    expect(weights.display).toBe(400);
  });

  it("h4 is 700 — Semi-bold (600) does not exist; h3/h4 separate by size (24/20 px)", () => {
    expect(weights.h4).toBe(700);
  });

  it("every weight token is a face the build actually ships (400 or 700)", () => {
    for (const [name, value] of Object.entries(weights)) {
      expect(
        [400, 700],
        `weights.${name} = ${value} has no real face`
      ).toContain(value);
    }
  });
});

describe("typography.css — measure token matches scale.ts measure", () => {
  let css = "";

  beforeAll(() => {
    css = strippedCss(readFileSync(TYPOGRAPHY_CSS_PATH, "utf-8"));
  });

  it("--prose-measure equals measure.prose (68ch)", () => {
    expect(css).toContain(`--prose-measure: ${measure.prose}`);
  });
});

// ─── 6. Element layer and utility classes present ────────────────────────────
//
// WHY: A1 review finding requires bare h1–h4, p, small to receive scale tokens.
// These tests confirm the element rules exist in the CSS (structural presence).

describe("typography.css — base element layer present (A1 review finding)", () => {
  let cssText = "";

  beforeAll(() => {
    cssText = readFileSync(TYPOGRAPHY_CSS_PATH, "utf-8");
  });

  it("h1 rule applies --font-size-h1", () => {
    expect(cssText).toContain("font-size: var(--font-size-h1)");
  });

  it("h2 rule applies --font-size-h2", () => {
    expect(cssText).toContain("font-size: var(--font-size-h2)");
  });

  it("h3 rule applies --font-size-h3", () => {
    expect(cssText).toContain("font-size: var(--font-size-h3)");
  });

  it("h4 rule applies --font-size-h4 and --font-weight-h4 explicitly (A2, A4)", () => {
    expect(cssText).toContain("font-size: var(--font-size-h4)");
    expect(cssText).toContain("font-weight: var(--font-weight-h4)");
  });

  it("p rule applies --font-size-body", () => {
    expect(cssText).toContain("font-size: var(--font-size-body)");
  });

  it("small rule applies --font-size-small", () => {
    expect(cssText).toContain("font-size: var(--font-size-small)");
  });

  it(".text-display utility applies --font-size-display (hero/display usage)", () => {
    expect(cssText).toContain(".text-display");
    expect(cssText).toContain("font-size: var(--font-size-display)");
  });

  it(".prose utility applies --prose-measure (NOT on bare <p>)", () => {
    expect(cssText).toContain(".prose");
    expect(cssText).toContain("max-width: var(--prose-measure)");
  });
});
