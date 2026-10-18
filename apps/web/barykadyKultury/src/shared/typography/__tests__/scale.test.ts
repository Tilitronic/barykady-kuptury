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
// We read typography.css as a plain string and assert that the @font-face
// declarations reference both latin-ext and cyrillic woff2 files, providing
// real glyph coverage for Polish diacritics and Ukrainian Cyrillic as required
// by DESIGN_SYSTEM.md §2.

describe("typography.css — font subset coverage", () => {
  let cssText = "";

  beforeAll(() => {
    cssText = readFileSync(TYPOGRAPHY_CSS_PATH, "utf-8");
  });

  it("references inter-latin-ext-wght-normal.woff2 (Polish diacritics — latin-ext subset)", () => {
    expect(cssText).toContain("inter-latin-ext-wght-normal.woff2");
  });

  it("references inter-cyrillic-wght-normal.woff2 (Ukrainian Cyrillic subset)", () => {
    expect(cssText).toContain("inter-cyrillic-wght-normal.woff2");
  });

  it("references inter-latin-wght-normal.woff2 (Latin baseline subset)", () => {
    expect(cssText).toContain("inter-latin-wght-normal.woff2");
  });

  it("all @font-face declarations use font-display: swap", () => {
    // Every @font-face block must opt into swap display (T-007 scope).
    const fontFaceBlocks = cssText.match(/@font-face\s*\{[^}]+\}/g) ?? [];
    expect(fontFaceBlocks.length).toBeGreaterThan(0);
    for (const block of fontFaceBlocks) {
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

  it("--font-weight-display equals weights.display (500 — Medium, A3)", () => {
    expect(css).toContain(`--font-weight-display: ${weights.display}`);
  });

  it("--font-weight-heading equals weights.heading (700 — Bold)", () => {
    expect(css).toContain(`--font-weight-heading: ${weights.heading}`);
  });

  it("--font-weight-h4 equals weights.h4 (600 — Semi-bold, A2)", () => {
    expect(css).toContain(`--font-weight-h4: ${weights.h4}`);
  });

  it("--font-weight-body equals weights.body (400 — Regular)", () => {
    expect(css).toContain(`--font-weight-body: ${weights.body}`);
  });

  it("--font-weight-small equals weights.small (400 — Regular)", () => {
    expect(css).toContain(`--font-weight-small: ${weights.small}`);
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
