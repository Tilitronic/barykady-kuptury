/**
 * T-008 — Logo variant selection rule.
 *
 * Enforces the brandbook usage rule (p. 8–9, 12) that dictates which
 * logo format to use in each layout context:
 *
 *   compact / header  → logo mark only (the circular "B" symbol)
 *                        Space-efficient; instantly recognisable in small sizes.
 *
 *   wide / footer     → logotype (mark + "BARYKADY KULTURY" text)
 *                        Full brand presence; appropriate where width permits.
 *
 * WHY a pure function and not a prop default:
 *   Call sites should not pick freely between mark and logotype — the choice
 *   should be driven by context, not individual preference. Exporting this
 *   function makes the rule explicit, testable, and co-locatable with
 *   `BrandLogo` rather than scattered across every usage site.
 *
 * Usage:
 *   import { resolveLogoVariant } from '@/components/brand/resolveLogoVariant'
 *   const kind = resolveLogoVariant('header') // → 'logo'
 *   const kind = resolveLogoVariant('footer') // → 'logotype'
 */

/** Contexts in which the logo may be placed. */
export type LogoContext = "header" | "compact" | "footer" | "wide";

/** The two logo formats available in the brand asset set. */
export type LogoKind = "logo" | "logotype";

/**
 * Returns the correct logo format for a given layout context.
 *
 * @param context - The placement context from the caller's layout.
 * @returns `'logo'` for compact/header contexts; `'logotype'` for wide/footer.
 */
export function resolveLogoVariant(context: LogoContext): LogoKind {
  return context === "footer" || context === "wide" ? "logotype" : "logo";
}
