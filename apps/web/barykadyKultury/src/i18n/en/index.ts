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
    /**
     * Visible label of the dark-mode switch — the wrapping <label> makes it
     * also the accessible name (WCAG 2.5.3: name == visible text).
     */
    darkMode: "Dark mode"
  },
  home: {
    title: "Barykady Kultury",
    description: "Official website of the Barykady Kultury association.",
    /** Homepage section headings (T-025; UI copy, not organizational text). */
    sections: {
      mission: "Our mission",
      events: "Upcoming events",
      projects: "Featured projects",
      explore: "Explore"
    },
    allEvents: "All events",
    allProjects: "All projects",
    /**
     * Home events section when the calendar holds nothing upcoming.
     * Intentionally shorter than `events.empty` (no onward "check back"
     * clause — the section's "All events" link carries the reader on);
     * do not merge the two keys.
     */
    eventsEmpty: "No upcoming events right now.",
    /**
     * M2 (T-025 review): the mission is pending, the page is not missing —
     * `content.empty` ("This page is not available.") is wrong here.
     */
    missionEmpty: "Our story is being prepared — check back soon."
  },
  contact: {
    title: "Contact",
    description: "Contact information for Barykady Kultury.",
    /** Listing state while no contact channel is published (T-021, D-04). */
    notConfigured: "Contact details have not been published yet.",
    /** Guidance shown next to the in-page routes to About and Support. */
    guidance:
      "In the meantime, you can learn more about us or find ways to support us:",
    /** Prefilled subject line for the `mailto:` link. */
    emailSubject: "Message from the website",
    /** Labels for the contact definition list. */
    fields: {
      email: "Email",
      phone: "Phone",
      address: "Address",
      officeHours: "Office hours"
    }
  },
  about: {
    title: "About us",
    description: "About the Barykady Kultury association.",
    placeholder: "Information about us is being prepared."
  },
  aboutTeam: {
    title: "Team",
    description: "The Barykady Kultury team.",
    /** Listing state while no member is published (T-018). */
    empty: "No team members are published yet."
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
    /** Rendered only when at least one option is configured (D-06). */
    intro: "You can support our activities in the following ways.",
    /** D-06 OPEN: truthful state while no support destination exists. */
    empty:
      "Ways to support the association are being prepared. Please check back later.",
    /** Boundary statement: shown in every state, never removed. */
    noPayment:
      "We do not process card payments on this website. Support is given directly on the verified destination's own page or by bank transfer.",
    actions: {
      donation: "Support us with a donation",
      volunteering: "Volunteer with us"
    },
    bank: {
      heading: "Bank transfer",
      accountNumber: "Account number",
      recipient: "Recipient",
      paymentTitle: "Payment title"
    }
  },
  events: {
    title: "Events",
    description: "Upcoming events organized by Barykady Kultury.",
    /** Listing state when the calendar holds no upcoming events (T-024). */
    empty: "No upcoming events right now — check back soon.",
    /** Calendar adapter failure — the rest of the page stays usable. */
    calendarUnavailable: "The event calendar is temporarily unavailable.",
    retry: "Try again",
    /** Fallback destination while the calendar is down (PRD §5). */
    contactFallback: "Contact us about upcoming events",
    /** SR-only live-region outcome (M1): success carries the result count. */
    loaded: "Upcoming events shown: {count}.",
    /**
     * D-14 (open) default: calendar text is shown as-is because the wire has
     * no language field; this note — once per list — explains why.
     */
    languageNote:
      "Event details are provided by the organizer in their original language.",
    /** All-day badge: text, never color alone (DESIGN_SYSTEM.md §6). */
    allDay: "All-day",
    /** Visible label; the SR-only suffix carries the event title. */
    register: "Register",
    registerFor: "for {title}",
    /** SR-only date-range relation between the two <time> elements (D3). */
    rangeTo: "to",
    /** SR-only prefix of the project link (visible text is the project title). */
    projectLabel: "Related project:"
  },
  publications: {
    title: "Publications",
    description: "Publications by Barykady Kultury.",
    /** Listing state when no publication is published yet (T-020). */
    empty: "No publications are available yet.",
    detail: {
      back: "Back to publications",
      filesHeading: "Available files"
    },
    /** Card availability indicator: files win over the external URL. */
    availability: {
      download: "Download",
      online: "Online"
    },
    external: "Open online"
  },
  projects: {
    title: "Projects",
    description: "Projects run by the Barykady Kultury association.",
    /** Listing state when no project is published yet (T-019). */
    empty: "No projects are available yet.",
    detail: {
      back: "Back to projects"
    },
    /**
     * Localized lifecycle labels. The public surfaces show published content
     * only, so the chip renders only for a non-published status reaching a
     * view (defensive; never raw enum jargon — T-019 placement decision).
     */
    status: {
      published: "Published",
      draft: "Draft",
      archived: "Archived"
    }
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
