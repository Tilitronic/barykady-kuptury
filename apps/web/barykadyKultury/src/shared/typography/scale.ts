/**
 * T-007 — Type scale: single source of truth.
 *
 * Brandbook anchors (DESIGN_SYSTEM.md §2, brandbook p. 13–14):
 *   display:         64 px (Medium / Bold)
 *   section heading: 34 px (Bold)   — mapped to h2
 *   body:            16 px (Regular)
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
// A2 (review finding): h4 weight set to 600 (Semi-bold) rather than 700.
//   h3 (18 px, 700) vs h4 (16 px, 700) produces a 2 px size gap at the same
//   weight, which is not reliably distinct.  600 vs 700 is visibly different in
//   Inter Variable across the 16–18 px range, creating clear hierarchy without
//   relying on size alone.
//
// A3 (review finding): display weight set to 500 (Medium), not 700 (Bold).
//   Brandbook p. 13 lists "Medium/Bold" for display — two sanctioned options.
//   At 40–64 px, 500 reads as a more refined editorial register appropriate for
//   a cultural NGO, and creates stronger contrast with the 700 heading weight
//   below it.  The display achieves dominance through sheer size; weight 500
//   keeps it from competing with h1/h2 in visual density.

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
 * Numeric values matching CSS `font-weight`.
 */
export const weights = {
  /** Medium — editorial display register (A3: see note above). */
  display: 500,
  /** Bold — all headings h1–h3 use this weight. */
  heading: 700,
  /**
   * Semi-bold — h4 only (A2: see note above).
   * 600 vs 700 is visibly distinct in Inter Variable at 16–18 px.
   */
  h4: 600,
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
