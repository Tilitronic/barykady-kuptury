/**
 * T-007 — Type scale: single source of truth.
 *
 * Brandbook anchors (DESIGN_SYSTEM.md §2, brandbook p. 13–14):
 *   display:         64 px (Medium / Bold)  — rendered via REAL faces only
 *   section heading: 34 px (Bold)   — mapped to h2     (D-40: 400/700, no faux
 *   body:            16 px (Regular)                   steps; see weights)
 *
 * Design widths:
 *   mobile:  375 px viewport  (smallest safe phone width)
 *   desktop: 1280 px viewport (brandbook reference width)
 *
 * Fluid scaling strategy:
 *   Each level uses CSS clamp(mobile, slope*100vw + intercept, desktop).
 *   The slope and intercept are computed so the value equals `mobileSize` at
 *   375 px and `desktopSize` at 1280 px, then clamps outside that range.
 *
 * Monotonicity invariant:
 *   Every level is strictly larger than the one below it at BOTH the mobile
 *   and desktop design widths. The unit tests enforce this mechanically.
 *
 * Relationship to typography.css:
 *   The CSS custom properties in typography.css are HAND-MIRRORED from this
 *   module and MACHINE-GATED by scale.test.ts.  They are NOT auto-generated.
 *   If you edit any value here, update typography.css to match; the test will
 *   fail if the two drift apart, making the mismatch immediately visible.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** A single level of the type scale at the two design-width extremes. */
export interface ScaleEntry {
  /** Value at the mobile design width (375 px viewport). */
  mobile: string;
  /** Value at the desktop design width (1280 px viewport). */
  desktop: string;
  /** CSS clamp() expression for fluid scaling between mobile and desktop. */
  fluid: string;
}

/** Full seven-level type scale. */
export interface TypeScale {
  display: ScaleEntry;
  h1: ScaleEntry;
  h2: ScaleEntry;
  h3: ScaleEntry;
  h4: ScaleEntry;
  body: ScaleEntry;
  small: ScaleEntry;
}

// ─── Fluid clamp computation ──────────────────────────────────────────────────

/** Viewport widths that define the two anchor points (pixels). */
const MOBILE_W = 375;
const DESKTOP_W = 1280;

/**
 * Compute a CSS clamp() expression that interpolates linearly from
 * `mobilePx` at `MOBILE_W` to `desktopPx` at `DESKTOP_W`.
 *
 * Formula:
 *   slope     = (desktopPx − mobilePx) / (DESKTOP_W − MOBILE_W) expressed in vw
 *   intercept = desktopPx − slope * DESKTOP_W   expressed in px
 *
 * WHY parseFloat+toFixed instead of raw toFixed:
 *   toFixed(4) can produce trailing zeros (e.g. "1.9890"). CSS formatters
 *   (oxfmt) strip those zeros when they lint the CSS file. Using
 *   parseFloat(x.toFixed(4)).toString() produces the same stripped form that
 *   the formatter writes, keeping the TypeScript output and the CSS in sync
 *   so the machine-gate in scale.test.ts can compare them as plain strings.
 */
function fluidClamp(mobilePx: number, desktopPx: number): string {
  const range = DESKTOP_W - MOBILE_W; // 905
  const slope = (desktopPx - mobilePx) / range; // px per px
  const intercept = desktopPx - slope * DESKTOP_W;

  // Strip trailing zeros so the string matches what CSS formatters produce.
  const slopeVw = String(parseFloat((slope * 100).toFixed(4)));
  const interceptPx = String(parseFloat(intercept.toFixed(4)));

  return `clamp(${mobilePx}px, ${slopeVw}vw + ${interceptPx}px, ${desktopPx}px)`;
}

/** Build a ScaleEntry from two pixel values. */
function entry(mobilePx: number, desktopPx: number): ScaleEntry {
  return {
    mobile: `${mobilePx}px`,
    desktop: `${desktopPx}px`,
    fluid: fluidClamp(mobilePx, desktopPx)
  };
}

// ─── The scale ────────────────────────────────────────────────────────────────

/**
 * Barykady Kultury type scale.
 *
 * Mobile values (375 px) → Desktop values (1280 px):
 *   display  40 → 64  (brandbook: 64 px Medium/Bold)
 *   h1       28 → 46
 *   h2       22 → 34  (brandbook: 34 px Bold — section heading)
 *   h3       18 → 24
 *   h4       16 → 20
 *   body     15 → 16  (brandbook: 16 px Regular)
 *   small    12 → 14
 *
 * Monotonicity at mobile: 40 > 28 > 22 > 18 > 16 > 15 > 12 ✓
 * Monotonicity at desktop: 64 > 46 > 34 > 24 > 20 > 16 > 14 ✓
 */
export const scale: TypeScale = {
  display: entry(40, 64),
  h1: entry(28, 46),
  h2: entry(22, 34),
  h3: entry(18, 24),
  h4: entry(16, 20),
  body: entry(15, 16),
  small: entry(12, 14)
};

// ─── Supporting constants ─────────────────────────────────────────────────────
//
// These values are the authoritative source for the matching CSS custom
// properties in typography.css.  scale.test.ts gates them mechanically.
//
// DESIGN DECISIONS
// ----------------
// D-40 (brand typeface → GNU FreeSerif) supersedes review findings A2/A3.
//
// A3 (superseded): display was 500 (Medium) — a variable-font affordance of
//   Inter. FreeSerif ships only Regular (400) and Bold (700), so display is
//   now 400 and achieves dominance through SIZE at 40–64 px, exactly as D-40
//   prescribes ("display via size, no faux-bold"). The brandbook's own ladder
//   (BOLD at display sizes) sanctioned Regular display as long as hierarchy
//   stays readable — the 700 headings below provide the contrast.
//
// A2 (superseded): h4 was 600 (Semi-bold) to separate it from h3 at the same
//   nominal size step. 600 has no real face; h4 is now 700 (real Bold) and
//   separates from h3 by the existing size ladder (18→16 mobile, 24→20
//   desktop px) plus leading.
//
// The weight vocabulary is frozen to {400, 700} by scale.test.ts. Any new
// token value would either fake-synthesize (banned: `font-synthesis: none`
// on body) or silently re-map to a neighbouring face.

/**
 * Line-height tokens.
 * Unitless values (relative to font-size) for CSS `line-height`.
 */
export const lineHeights = {
  /** Tight leading for large hero text. */
  display: 1.1,
  /** Comfortable leading for multi-line headings. */
  heading: 1.25,
  /** Readable body leading (WCAG 1.4.8 recommends ≥ 1.5). */
  body: 1.6,
  /** Caption / small text leading. */
  small: 1.5
} as const;

/**
 * Font-weight tokens.
 * Numeric values matching CSS `font-weight`. D-40: FreeSerif ships exactly
 * two weights — these tokens may only ever be 400 or 700 (machine-gated by
 * scale.test.ts; `font-synthesis: none` forbids synthetic faces).
 */
export const weights = {
  /** Regular — display (D-40: dominance via size at 40–64 px, no faux-medium). */
  display: 400,
  /** Bold — all headings h1–h3 use this weight. */
  heading: 700,
  /**
   * Bold — h4 (D-40 supersedes the 600 Semi-bold token: no such face).
   * Separates from h3 by size (24 vs 20 px desktop) and leading, not weight.
   */
  h4: 700,
  /** Regular — body text. */
  body: 400,
  /** Regular — small / caption text. */
  small: 400
} as const;

/**
 * Typographic measure (max line length) tokens.
 */
export const measure = {
  /**
   * ~68ch constrains body prose to the comfortable 50–75 character range
   * for English, Polish, and Ukrainian (longer-word languages).
   * Applied via the `.prose` utility class, never globally on <p>.
   */
  prose: "68ch"
} as const;
