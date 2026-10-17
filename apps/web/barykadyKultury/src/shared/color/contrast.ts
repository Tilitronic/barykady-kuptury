/**
 * WCAG 2.x relative-luminance and contrast-ratio utilities.
 *
 * WHY this module exists: D-18 requires every design token pair to be
 * documented with a _measured_ WCAG 2.x contrast ratio.  This module is
 * the single authoritative implementation of that measurement so test
 * assertions and token comments are computed by the same algorithm.
 *
 * References
 * ----------
 * WCAG 2.2 SC 1.4.3, 1.4.6, 1.4.11
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 * https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 */

/**
 * Convert a single sRGB channel byte (0–255) to its linearised value.
 *
 * Uses the exact threshold and formula from the WCAG 2.x specification
 * (IEC 61966-2-1 encoded with the 0.03928 cut-off used in the WCAG formula).
 */
function linearise(channelByte: number): number {
  const v = channelByte / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/** Regex for a valid 6-digit sRGB hex string (no `#` prefix). */
const HEX6_RE = /^[0-9a-fA-F]{6}$/;

/**
 * Compute the WCAG 2.x relative luminance of a colour given as a hex string.
 *
 * Accepts `#RRGGBB` (with or without leading `#`, case-insensitive).
 * Returns a value in [0, 1] where 0 is pure black and 1 is pure white.
 *
 * Throws a descriptive `Error` when the argument is not a valid 6-digit hex
 * string so that malformed input fails loudly rather than propagating `NaN`
 * silently through downstream calculations.
 *
 * @param hex - CSS hex colour e.g. `#C60001` or `c60001`
 */
export function relativeLuminance(hex: string): number {
  const clean = hex.startsWith("#") ? hex.slice(1) : hex;
  if (!HEX6_RE.test(clean)) {
    throw new Error(
      `relativeLuminance: expected a 6-digit hex colour (with or without "#") ` +
        `but received "${hex}". ` +
        `Valid examples: "#C60001", "c60001".`
    );
  }
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return 0.2126 * linearise(r) + 0.7152 * linearise(g) + 0.0722 * linearise(b);
}

/**
 * Compute the WCAG 2.x contrast ratio between two colours.
 *
 * Argument order does not matter — the lighter colour is always divided by
 * the darker colour as required by the specification.
 *
 * Returns a value in [1, 21].  Required thresholds:
 * - ≥ 4.5:1  normal body text  (WCAG AA SC 1.4.3)
 * - ≥ 7.0:1  normal body text  (WCAG AAA SC 1.4.6)
 * - ≥ 3.0:1  large text / UI component boundaries (WCAG AA SC 1.4.3 / 1.4.11)
 *
 * Throws when either argument is not a valid 6-digit hex string (inherits the
 * validation from `relativeLuminance`).
 *
 * @param hex1 - First colour hex string
 * @param hex2 - Second colour hex string
 */
export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}
