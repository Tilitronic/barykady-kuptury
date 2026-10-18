/**
 * Navigation model — single source of truth for header, footer, and mobile
 * drawer (T-011 TDD refactor step).
 *
 * Components consume this config and must not hard-code route lists. The model
 * stores path *segments* (without the locale prefix); components prepend the
 * active locale at render time.
 *
 * Destination order follows PRODUCT_REQUIREMENTS.md §4:
 *   Contact, About us, Support us, Projects, Events, Publications.
 */

/** A navigable destination understood by the public layout. */
export interface NavItem {
  /** Key suffix under the i18n `nav.*` namespace, e.g. "contact" → t("nav.contact"). */
  labelKey: string;
  /**
   * URL path segment(s) without leading slash and without the locale prefix.
   * Examples: "contact", "about", "about/team".
   */
  path: string;
  /** Vue Router route name (used for aria-current matching). */
  routeName: string;
}

/**
 * Top-level navigation destinations.
 * Rendered by AppHeader desktop nav, mobile drawer, and AppFooter nav column.
 */
export const mainNavItems: NavItem[] = [
  { labelKey: "contact", path: "contact", routeName: "contact" },
  { labelKey: "about", path: "about", routeName: "about" },
  { labelKey: "support", path: "support", routeName: "support" },
  { labelKey: "projects", path: "projects", routeName: "projects" },
  { labelKey: "events", path: "events", routeName: "events" },
  { labelKey: "publications", path: "publications", routeName: "publications" }
];

/**
 * About sub-navigation items.
 * Rendered by the About landing page secondary nav and AppFooter.
 * The landing page itself is the first item.
 */
export const aboutSubNavItems: NavItem[] = [
  { labelKey: "aboutOrg", path: "about", routeName: "about" },
  { labelKey: "team", path: "about/team", routeName: "about-team" },
  {
    labelKey: "documents",
    path: "about/documents",
    routeName: "about-documents"
  }
];
