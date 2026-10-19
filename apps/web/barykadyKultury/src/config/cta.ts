/**
 * Homepage primary CTA configuration (T-025).
 *
 * Design constraint: PRODUCT_REQUIREMENTS.md §5 requires "a primary next
 * step appropriate to the NGO's mission (configured, not invented)". Until
 * the project owner supplies a verified destination, `homeCta` is `null` and
 * the homepage renders no CTA at all — the same OPEN-decision posture as
 * `support.ts` (D-06): no invented URLs, labels or causes (AGENTS.md rule 6).
 *
 * Documented example — a configured internal destination:
 *
 * ```ts
 * export const homeCta: HomeCta | null = {
 *   labelKey: "nav.support",  // existing i18n key; never free-form copy
 *   href: "support"           // locale-agnostic segment, e.g. "support"
 * };
 * ```
 *
 * An external destination uses an absolute `http(s)` URL in `href` and is
 * rendered as a safe new-tab link.
 */

/** One configured call-to-action. */
export interface HomeCta {
  /** i18n key for the visible label (must exist in every catalogue). */
  labelKey: string;
  /**
   * Locale-agnostic internal path segment(s) (e.g. "support",
   * "about/team"), or an absolute `http(s)` URL for an external
   * destination. Anything else (e.g. `javascript:`) is treated as an
   * internal segment and simply never resolves — it can never navigate
   * externally.
   */
  href: string;
}

/**
 * The live homepage CTA.
 *
 * `null` = not configured: the section is omitted, not stubbed with
 * placeholder copy.
 */
export const homeCta: HomeCta | null = null;

/** Only absolute http(s) counts as external; every other scheme stays inert. */
export function ctaIsExternal(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

/** Internal paths are locale-prefixed at render time (navigation.ts model). */
export function ctaInternalPath(href: string, locale: string): string {
  return `/${locale}/${href}`;
}
