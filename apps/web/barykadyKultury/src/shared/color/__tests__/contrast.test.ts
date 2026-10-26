/**
 * T-006 rev-3: WCAG 2.x contrast utility tests.
 *
 * WHY this file exists (D-18 — binding):
 * Every token pair documented in tokens.css must carry a measured WCAG ratio.
 * This test is the machine-enforceable version of that documentation.
 *
 * ARCHITECTURE (rev-2, Finding 1):
 * Token hex values are now derived at test time by PARSING src/css/tokens.css.
 * Hard-coding the hex strings here would allow silent drift — a token change
 * in the CSS would never break this test.  With parsing, any edit to a token
 * hex immediately causes the relevant assertions to fail.
 *
 * Test sections
 * ─────────────
 * 1. Unit tests for `relativeLuminance` and `contrastRatio` primitives.
 *    These use hard-coded values because they validate the ALGORITHM, not
 *    token values.
 *
 * 2. Brandbook reference pairs (D-13) — hard-coded against the three brand
 *    hexes.  If any of these fail the WCAG formula implementation is wrong.
 *
 * 3. CSS-driven pair table — one canonical table of (fg token, bg token,
 *    minRatio, themes[]) asserted against ACTUAL hex values parsed from
 *    tokens.css.  A change to any hex in the CSS breaks the matching test.
 *
 * 4. Forbidden-pair assertion — SCARLET on NERO MUST NOT be used as normal
 *    text.  Hard-coded because it validates a brand constraint, not a token.
 *
 * 5. Brand focus on white — SCARLET focus ring on form-bg (#FFFFFF) must
 *    clear ≥ 3:1.  #FFFFFF is not a token; hard-coded as a brand constraint.
 */

import { describe, it, expect } from "vitest";
import { relativeLuminance, contrastRatio } from "@/shared/color/contrast";
import { loadThemeHexes } from "./parseTokensCss";

// ─── Brand palette (D-13) — never changes, algorithm validation only ─────────
const SCARLET = "#C60001"; // brandbook primary accent
const NERO = "#262424"; // brandbook primary text / dark bg
const GRAY93 = "#EDEDED"; // brandbook primary background
const WHITE = "#FFFFFF";

// ─── CSS-sourced hex maps — parsed once at module-load time ──────────────────
// Vitest evaluates top-level describe callbacks synchronously; reading the file
// here ensures any block below can access parsed values without async setup.
const { light, dark } = loadThemeHexes();

/**
 * Retrieve a required hex from a theme map.
 * Throws a descriptive error when the token is absent or not a plain hex,
 * so the failing test names the missing token clearly.
 */
function requireHex(
  hexes: Record<string, string | null>,
  token: string,
  theme: "light" | "dark"
): string {
  const h = hexes[token];
  if (!h) {
    throw new Error(
      `Token --${token} not found or not a hex value in the ${theme} theme of src/css/tokens.css. ` +
        `Add --${token} with a #RRGGBB value to the ${theme === "light" ? ":root" : '[data-theme="dark"]'} block.`
    );
  }
  return h;
}

// ─── Pair table ───────────────────────────────────────────────────────────────
/**
 * Canonical contrast-pair table (D-18, T-006 rev-2).
 *
 * Each entry defines:
 *   role      — human description of the use case
 *   fg        — bare CSS custom-property name of the foreground colour token
 *   bg        — bare CSS custom-property name of the background colour token
 *   minRatio  — minimum required WCAG 2.x contrast ratio:
 *               4.5 = normal body text (SC 1.4.3 AA)
 *               3.0 = large text / UI component boundaries (SC 1.4.11 AA)
 *   themes    — which themes this pair must pass in
 *
 * EDITING THIS TABLE: add a row whenever a new text/link/focus token is
 * introduced.  The test will automatically fail until the CSS carries a
 * value that meets the ratio, preventing silent regressions.
 */
interface ContrastPair {
  readonly role: string;
  readonly fg: string;
  readonly bg: string;
  readonly minRatio: 4.5 | 3.0;
  readonly themes: ReadonlyArray<"light" | "dark">;
}

const CONTRAST_PAIRS: readonly ContrastPair[] = [
  // ── Body text ──────────────────────────────────────────────────────────────
  {
    role: "body text on background",
    fg: "color-text",
    bg: "color-background",
    minRatio: 4.5,
    themes: ["light", "dark"]
  },
  {
    role: "body text on surface",
    fg: "color-text",
    bg: "color-surface",
    minRatio: 4.5,
    themes: ["light", "dark"]
  },
  {
    role: "body text on surface-raised",
    fg: "color-text",
    bg: "color-surface-raised",
    minRatio: 4.5,
    themes: ["light", "dark"]
  },

  // ── Muted text ─────────────────────────────────────────────────────────────
  {
    role: "muted text on background",
    fg: "color-text-muted",
    bg: "color-background",
    minRatio: 4.5,
    themes: ["light", "dark"]
  },
  {
    role: "muted text on surface",
    fg: "color-text-muted",
    bg: "color-surface",
    minRatio: 4.5,
    themes: ["light", "dark"]
  },
  {
    role: "muted text on surface-raised",
    fg: "color-text-muted",
    bg: "color-surface-raised",
    minRatio: 4.5,
    themes: ["light", "dark"]
  },

  // ── Accent ─────────────────────────────────────────────────────────────────
  // Accent-text is the text colour placed ON an accent-coloured surface (e.g.
  // primary buttons and badges).
  {
    role: "accent-text on accent surface",
    fg: "color-accent-text",
    bg: "color-accent",
    minRatio: 4.5,
    themes: ["light", "dark"]
  },
  // D-18 certified dark accent: lightened SCARLET (L=0.661 → #FA4C3C) on NERO.
  // Kept here so any change to --color-accent in dark mode is immediately caught.
  {
    role: "dark accent on background (D-18 certified pair)",
    fg: "color-accent",
    bg: "color-background",
    minRatio: 4.5,
    themes: ["dark"]
  },

  // ── Links — must pass on ALL three background levels ──────────────────────
  // rev-2 Finding 4: dark --color-link was #FA4C3C (3.68:1 on surface-raised —
  // below AA).  Fixed to #FF6D5A (OKLCH L=0.756, C=0.213, H=29.1°, gamut-
  // clipped) which clears 4.5:1 on all three dark surfaces.
  {
    role: "link on background",
    fg: "color-link",
    bg: "color-background",
    minRatio: 4.5,
    themes: ["light", "dark"]
  },
  {
    role: "link on surface",
    fg: "color-link",
    bg: "color-surface",
    minRatio: 4.5,
    themes: ["light", "dark"]
  },
  {
    role: "link on surface-raised",
    fg: "color-link",
    bg: "color-surface-raised",
    minRatio: 4.5,
    themes: ["light", "dark"]
  },

  // ── Status colours on primary background ──────────────────────────────────
  {
    role: "success text on background",
    fg: "color-success",
    bg: "color-background",
    minRatio: 4.5,
    themes: ["light", "dark"]
  },
  {
    role: "warning text on background",
    fg: "color-warning",
    bg: "color-background",
    minRatio: 4.5,
    themes: ["light", "dark"]
  },
  {
    role: "danger text on background",
    fg: "color-danger",
    bg: "color-background",
    minRatio: 4.5,
    themes: ["light", "dark"]
  },

  // ── Danger text on danger surface (error banners) — rev-2 addition ────────
  // --color-surface-danger is a tinted error background; --color-danger must
  // remain readable ON it.  Measured: light 6.80:1, dark 6.07:1.
  {
    role: "danger text on surface-danger (error banner)",
    fg: "color-danger",
    bg: "color-surface-danger",
    minRatio: 4.5,
    themes: ["light", "dark"]
  },

  // ── Focus ring — non-text UI boundary ≥ 3:1 (WCAG 2.4.11) ────────────────
  {
    role: "focus ring on background",
    fg: "color-focus",
    bg: "color-background",
    minRatio: 3.0,
    themes: ["light", "dark"]
  },
  {
    role: "focus ring on surface",
    fg: "color-focus",
    bg: "color-surface",
    minRatio: 3.0,
    themes: ["light", "dark"]
  },
  {
    role: "focus ring on surface-raised",
    fg: "color-focus",
    bg: "color-surface-raised",
    minRatio: 3.0,
    themes: ["light", "dark"]
  },

  // ── Form-field border — non-text UI component boundary (SC 1.4.11 ≥ 3:1) ──
  // rev-3: form-border was below 3:1 on form-bg in both themes (light 1.62:1,
  // dark 1.59:1 — a documented gap from rev-2). Fixed to ≥ 3:1 by raising the
  // border to a warm near-achromatic at OKLCH H=17°, C≈0.003.
  // Note: form-bg fill vs page-bg is only 1.15:1 (white on GRAY93) — the fill
  // alone cannot identify the field; the border must carry the boundary contrast.
  {
    role: "form-border (UI boundary) on form-bg (SC 1.4.11)",
    fg: "color-form-border",
    bg: "color-form-bg",
    minRatio: 3.0,
    themes: ["light", "dark"]
  },

  // ── T-033: re-verification of every *rendered* pair ──────────────────────
  // These rows came out of the T-033 audit: status texts render inside cards
  // (--color-surface / --color-surface-raised) and banners, dialog and field
  // surfaces carry their own text/muted/focus users, and a form boundary must
  // clear 3:1 against the *page* next to the field too — not only against the
  // input fill. The light form-border was measured at 2.64:1 on GRAY93 and
  // fixed by one documented −0.035 border step (#949292 → #8A8787, SC 1.4.11).
  {
    role: "form-border (UI boundary) on background (SC 1.4.11)",
    fg: "color-form-border",
    bg: "color-background",
    minRatio: 3.0,
    themes: ["light", "dark"]
  },
  {
    role: "form-border (UI boundary) on surface (SC 1.4.11)",
    fg: "color-form-border",
    bg: "color-surface",
    minRatio: 3.0,
    themes: ["light", "dark"]
  },
  {
    role: "body text on form-bg",
    fg: "color-text",
    bg: "color-form-bg",
    minRatio: 4.5,
    themes: ["light", "dark"]
  },
  {
    role: "muted helper text on form-bg",
    fg: "color-text-muted",
    bg: "color-form-bg",
    minRatio: 4.5,
    themes: ["light", "dark"]
  },
  {
    role: "focus ring on form-bg",
    fg: "color-focus",
    bg: "color-form-bg",
    minRatio: 3.0,
    themes: ["light", "dark"]
  },
  {
    role: "body text in dialog",
    fg: "color-text",
    bg: "color-dialog-bg",
    minRatio: 4.5,
    themes: ["light", "dark"]
  },
  {
    role: "muted text in dialog",
    fg: "color-text-muted",
    bg: "color-dialog-bg",
    minRatio: 4.5,
    themes: ["light", "dark"]
  },
  {
    role: "link text in dialog",
    fg: "color-link",
    bg: "color-dialog-bg",
    minRatio: 4.5,
    themes: ["light", "dark"]
  },
  {
    role: "focus ring in dialog",
    fg: "color-focus",
    bg: "color-dialog-bg",
    minRatio: 3.0,
    themes: ["light", "dark"]
  },
  {
    role: "success text on surface",
    fg: "color-success",
    bg: "color-surface",
    minRatio: 4.5,
    themes: ["light", "dark"]
  },
  {
    role: "warning text on surface",
    fg: "color-warning",
    bg: "color-surface",
    minRatio: 4.5,
    themes: ["light", "dark"]
  },
  {
    role: "danger text on surface",
    fg: "color-danger",
    bg: "color-surface",
    minRatio: 4.5,
    themes: ["light", "dark"]
  },
  {
    role: "success text on surface-raised",
    fg: "color-success",
    bg: "color-surface-raised",
    minRatio: 4.5,
    themes: ["light", "dark"]
  },
  {
    role: "warning text on surface-raised",
    fg: "color-warning",
    bg: "color-surface-raised",
    minRatio: 4.5,
    themes: ["light", "dark"]
  },
  {
    role: "danger text on surface-raised (error banner on card)",
    fg: "color-danger",
    bg: "color-surface-raised",
    minRatio: 4.5,
    themes: ["light", "dark"]
  },
  {
    role: "active nav link (link token) on surface (header band)",
    fg: "color-link",
    bg: "color-surface",
    minRatio: 4.5,
    themes: ["light", "dark"]
  }
];

// ════════════════════════════════════════════════════════════════════════════
// 1. Pure algorithm unit tests — hard-coded, validate the WCAG formula itself
// ════════════════════════════════════════════════════════════════════════════

describe("relativeLuminance", () => {
  it("returns 0 for pure black", () => {
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
  });

  it("returns 1 for pure white", () => {
    expect(relativeLuminance("#FFFFFF")).toBeCloseTo(1, 5);
  });

  it("returns ~0.2126 for pure red (#FF0000)", () => {
    expect(relativeLuminance("#FF0000")).toBeCloseTo(0.2126, 3);
  });

  it("handles lowercase hex", () => {
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
  });

  it("handles mixed-case hex", () => {
    expect(relativeLuminance("#EdEdEd")).toBeCloseTo(
      relativeLuminance("#EDEDED"),
      6
    );
  });

  // rev-3: malformed input must throw a clear error, not propagate NaN
  it("throws for a non-hex string", () => {
    expect(() => relativeLuminance("not-a-color")).toThrow(/6-digit hex/);
  });

  it("throws for an empty string", () => {
    expect(() => relativeLuminance("")).toThrow(/6-digit hex/);
  });

  it("throws for invalid hex characters (#GGGGGG)", () => {
    expect(() => relativeLuminance("#GGGGGG")).toThrow(/6-digit hex/);
  });

  it("throws for a 3-digit shorthand (#FFF — not accepted)", () => {
    expect(() => relativeLuminance("#FFF")).toThrow(/6-digit hex/);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("contrastRatio", () => {
  it("returns 21:1 for black on white", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 0);
  });

  it("is symmetric — fg/bg order does not matter", () => {
    const r1 = contrastRatio(NERO, GRAY93);
    const r2 = contrastRatio(GRAY93, NERO);
    expect(r1).toBeCloseTo(r2, 6);
  });

  it("returns ≥ 1 for any pair (minimum is 1:1 identical colors)", () => {
    expect(contrastRatio(NERO, NERO)).toBeGreaterThanOrEqual(1);
  });

  // rev-3: propagated-NaN guard — malformed second argument also throws
  it("throws for a malformed second argument", () => {
    expect(() => contrastRatio("#FFFFFF", "oops")).toThrow(/6-digit hex/);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 2. Brandbook reference pairs (D-13) — hard-coded algorithm validation
// ════════════════════════════════════════════════════════════════════════════

/** Assert ratio within ±0.12 to accommodate rounding in reference tables. */
function expectRatio(
  fg: string,
  bg: string,
  expectedRatio: number,
  tolerance = 0.12
) {
  const actual = contrastRatio(fg, bg);
  expect(actual).toBeGreaterThanOrEqual(expectedRatio - tolerance);
  expect(actual).toBeLessThanOrEqual(expectedRatio + tolerance);
}

describe("Brandbook reference pairs (DESIGN_SYSTEM.md §1)", () => {
  it("NERO on GRAY93 ≈ 13.19 (AAA)", () => {
    expectRatio(NERO, GRAY93, 13.19);
  });

  it("white on SCARLET ≈ 6.17 (AA)", () => {
    expectRatio(WHITE, SCARLET, 6.17);
  });

  it("SCARLET on GRAY93 ≈ 5.27 (AA)", () => {
    expectRatio(SCARLET, GRAY93, 5.27);
  });

  it("SCARLET on NERO ≈ 2.50 — FORBIDDEN for normal text use", () => {
    const ratio = contrastRatio(SCARLET, NERO);
    expectRatio(SCARLET, NERO, 2.5);
    // This pair MUST remain below 4.5; using it for text is an error.
    expect(ratio).toBeLessThan(4.5);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 3. CSS-driven pair table — all hex values parsed from src/css/tokens.css
//
//    HOW THE GATE WORKS:
//    Each test retrieves the hex value from `light` or `dark` (parsed at load
//    time from the actual CSS file).  If you edit a token hex in tokens.css
//    and run `pnpm vitest run src/shared/color`, the test for every pair that
//    uses that token will fail.  Hard-coded copies in this file would not fail.
//
//    PROOF (T-006 rev-2 log): mutate any token hex in tokens.css, re-run →
//    the matching test in this suite fails.  Revert → all tests pass again.
// ════════════════════════════════════════════════════════════════════════════

describe("CSS-driven contrast gate — all hex values parsed from tokens.css", () => {
  for (const pair of CONTRAST_PAIRS) {
    for (const theme of pair.themes) {
      const hexes = theme === "light" ? light : dark;
      it(`[${theme}] ${pair.role}: --${pair.fg} on --${pair.bg} ≥ ${pair.minRatio}:1`, () => {
        const fg = requireHex(hexes, pair.fg, theme);
        const bg = requireHex(hexes, pair.bg, theme);
        const ratio = contrastRatio(fg, bg);
        expect(
          ratio,
          `Expected ${fg} on ${bg} (${pair.role}, ${theme}) to be ≥ ${pair.minRatio}:1 but got ${ratio.toFixed(2)}:1`
        ).toBeGreaterThanOrEqual(pair.minRatio);
      });
    }
  }
});

// ════════════════════════════════════════════════════════════════════════════
// 4. Forbidden pair — brand constraint, hard-coded
// ════════════════════════════════════════════════════════════════════════════

describe("Disabled-state documentation — WCAG SC 1.4.3 Note 1 exemption (T-033)", () => {
  // Disabled controls are explicitly exempt from contrast minimums, and
  // tokens.css deliberately ships a "clearly inactive" low-contrast value.
  // This guard documents the exemption MECHANICALLY: the disabled text must
  // stay visible enough to read the label as disabled (≥ 1.5:1 against its
  // own surface) but remain below the 3:1 UI boundary threshold, and it must
  // stay dimmer than enabled text so state is never ambiguous.
  for (const theme of ["light", "dark"] as const) {
    const hexes = theme === "light" ? light : dark;
    it(`[${theme}] disabled text is deliberately de-emphasised but legible`, () => {
      const disabled = requireHex(hexes, "color-disabled-text", theme);
      const bg = requireHex(hexes, "color-disabled-bg", theme);
      const text = requireHex(hexes, "color-text", theme);
      const ratioDisabled = contrastRatio(disabled, bg);
      const ratioEnabled = contrastRatio(text, bg);

      expect(
        ratioDisabled,
        `${disabled} on ${bg}: disabled text drifted below visibility floor`
      ).toBeGreaterThanOrEqual(1.5);
      expect(
        ratioDisabled,
        `${disabled} on ${bg}: disabled text now looks enabled — state cue lost`
      ).toBeLessThan(3);
      expect(ratioEnabled).toBeGreaterThan(ratioDisabled);
    });
  }
});

describe("Forbidden pair — SCARLET on NERO must NOT be used as body text", () => {
  it("SCARLET on NERO is below 4.5:1 — forbidden for normal text", () => {
    const ratio = contrastRatio(SCARLET, NERO);
    expectRatio(SCARLET, NERO, 2.5, 0.12);
    expect(ratio).toBeLessThan(4.5);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 5. Quasar internals — dark-mode `--q-*` parity (T-033, D-20)
//
// Quasar renders its component internals (button label colours, floating
// field labels, error icons, body--dark page background) from CSS custom
// properties `--q-primary … --q-dark-page` that are frozen at build time
// from quasar.variables.scss — `Dark.set()` only toggles the body class.
// Without dark overrides the brand's light-only values render onto NERO
// surfaces (T-033 axe finding: SCARLET outline-button label 2.50:1, danger
// field label 1.85:1). tokens.css therefore re-publishes the certified
// DARK token values under the Quasar names. This gate pins the mapping so
// the two palettes can never drift apart.
// ════════════════════════════════════════════════════════════════════════════

const QUASAR_DARK_PARITY: readonly [qVar: string, brandToken: string][] = [
  ["q-primary", "color-accent"],
  ["q-accent", "color-accent"],
  ["q-positive", "color-success"],
  ["q-negative", "color-danger"],
  ["q-warning", "color-warning"],
  ["q-dark", "color-background"],
  ["q-dark-page", "color-background"]
];

describe("Quasar --q-* dark parity with brand tokens (T-033)", () => {
  for (const [qVar, brandToken] of QUASAR_DARK_PARITY) {
    it(`[dark] --${qVar} equals the certified dark --${brandToken}`, () => {
      const qHex = requireHex(dark, qVar, "dark");
      const brandHex = requireHex(dark, brandToken, "dark");
      expect(
        qHex.toLowerCase(),
        `--${qVar} drifted from dark --${brandToken}`
      ).toBe(brandHex.toLowerCase());
    });
  }

  it("[dark] remapped primary keeps NERO label contrast on the accent surface", () => {
    const accent = requireHex(dark, "q-primary", "dark");
    const accentText = requireHex(dark, "color-accent-text", "dark");
    expect(contrastRatio(accent, accentText)).toBeGreaterThanOrEqual(4.5);
  });

  it("[dark] remapped negative reads as text on every dark surface", () => {
    const negative = requireHex(dark, "q-negative", "dark");
    for (const bg of [
      "color-background",
      "color-surface",
      "color-surface-raised"
    ]) {
      expect(
        contrastRatio(negative, requireHex(dark, bg, "dark")),
        `--q-negative on dark --${bg}`
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 6. Brand focus ring on white form background — brand constraint, hard-coded
//    #FFFFFF is the form-bg token value but also an absolute anchor;
//    hard-coded so it validates the brand SCARLET focus ring on any white surface.
// ════════════════════════════════════════════════════════════════════════════

describe("Focus ring on white form background — brand constraint", () => {
  it("SCARLET focus ring on white (#FFFFFF) ≥ 3:1 (WCAG 2.4.11)", () => {
    expect(contrastRatio(SCARLET, WHITE)).toBeGreaterThanOrEqual(3.0);
  });
});
