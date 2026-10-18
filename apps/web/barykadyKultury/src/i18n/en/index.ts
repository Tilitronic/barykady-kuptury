/**
 * English messages. Master schema for all locales.
 *
 * Only verified organization facts belong here — no placeholder contact
 * details. `MessageSchema` is the compile-time parity contract: the Polish and
 * Ukrainian catalogues annotate themselves with it, so a missing or renamed key
 * fails type-checking (T-009).
 */
const en = {
  app: {
    name: "Barykady Kultury"
  },
  brand: {
    /**
     * Accessible name for the BrandLogo component when used in a non-decorative
     * context (role="img" or alt text). Grounded in the verified organisation
     * name only — no invented taglines (T-008 scope).
     */
    logoLabel: "Barykady Kultury"
  },
  common: {
    skipToContent: "Skip to main content"
  },
  nav: {
    language: "Language",
    /** Mobile drawer controls (DESIGN_SYSTEM.md §4 — explicit open/close state). */
    openMenu: "Open navigation menu",
    closeMenu: "Close navigation menu",
    /** Accessible name for the header nav landmark. */
    mainNav: "Main navigation",
    /** Top-level destinations (PRODUCT_REQUIREMENTS.md §4). */
    contact: "Contact",
    about: "About us",
    support: "Support us",
    projects: "Projects",
    events: "Events",
    publications: "Publications",
    /** About sub-navigation items. */
    aboutOrg: "Organization",
    team: "Team",
    documents: "Documents"
  },
  footer: {
    /** Screen-reader label for the footer navigation landmark. */
    nav: "Footer navigation",
    /** Privacy policy link text — only rendered when privacyUrl is configured. */
    privacyPolicy: "Privacy policy",
    /** Accessible label for the social media links list. */
    socialNav: "Social media"
  },
  theme: {
    toggleLabel: "Toggle dark theme"
  },
  home: {
    title: "Barykady Kultury",
    description: "Official website of the Barykady Kultury association.",
    placeholder: "Website content is being prepared."
  },
  contact: {
    title: "Contact",
    description: "Contact information for Barykady Kultury.",
    placeholder: "Contact information is being prepared."
  },
  about: {
    title: "About us",
    description: "About the Barykady Kultury association.",
    placeholder: "Information about us is being prepared."
  },
  aboutTeam: {
    title: "Team",
    description: "The Barykady Kultury team.",
    placeholder: "Team information is being prepared."
  },
  aboutDocuments: {
    title: "Documents",
    description: "Organizational documents of Barykady Kultury.",
    placeholder: "Documents are being prepared.",
    /** Listing state when no document is published yet. */
    empty: "No documents are available yet.",
    reader: {
      back: "Back to documents",
      /** Accessible name for the in-view language switcher group. */
      languageLabel: "Document language",
      notFound: "This document is not available.",
      unavailable: "This document is not available in the selected language."
    },
    /**
     * Localized `document_type` labels. An unknown type falls back to the raw
     * stored label so a new type never renders blank copy.
     */
    types: {
      regulations: "Regulations",
      statute: "Statute",
      report: "Report"
    }
  },
  support: {
    title: "Support us",
    description: "Support the Barykady Kultury association.",
    placeholder: "Support options are being prepared."
  },
  events: {
    title: "Events",
    description: "Upcoming events organized by Barykady Kultury.",
    placeholder: "Events are being prepared."
  },
  publications: {
    title: "Publications",
    description: "Publications by Barykady Kultury.",
    placeholder: "Publications are being prepared."
  },
  projects: {
    title: "Projects",
    description: "Projects run by the Barykady Kultury association.",
    placeholder: "Projects are being prepared."
  },
  notFound: {
    title: "Page not found",
    description: "The page you requested could not be found.",
    message: "The page you requested could not be found."
  },
  content: {
    loading: "Loading…",
    empty: "This page is not available.",
    unavailable: "This content is temporarily unavailable.",
    fallbackNote: "This content is only available in {language}.",
    fallbackLanguage: "English",
    opensInNewTab: "opens in a new tab"
  }
};

export type MessageSchema = typeof en;

export default en;
