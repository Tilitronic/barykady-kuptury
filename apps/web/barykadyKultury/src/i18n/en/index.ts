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
  /** Table of contents for consolidated area pages (T-039, D-25). */
  toc: {
    onThisPage: "On this page"
  },
  /**
   * Header site search (T-039, D-26): instant navigation results plus
   * debounced Postgres/calendar content. All dialog chrome lives here —
   * the search data layer ships machine codes only.
   */
  search: {
    trigger: "Search the site",
    dialogTitle: "Site search",
    inputLabel: "Search",
    placeholder: "Search pages, projects, publications…",
    close: "Close search",
    hint: "Type at least two characters. Navigation results appear instantly.",
    navSection: "Navigation",
    contentSection: "Content",
    loading: "Searching…",
    noContent: "No content results.",
    errorContent: "Content results are unavailable.",
    errorEvents: "Event results are unavailable.",
    retry: "Try again",
    /** Polite live region — never moves focus. */
    counts: "{navCount} navigation and {contentCount} content results",
    filtersLabel: "Filter results",
    filters: {
      all: "All",
      pages: "Pages",
      projects: "Projects",
      publications: "Publications",
      documents: "Documents",
      team: "Team",
      events: "Events"
    },
    navKinds: {
      page: "Page",
      section: "Section"
    },
    contentKinds: {
      page: "Page",
      project: "Project",
      publication: "Publication",
      document: "Document",
      team: "Team member",
      event: "Event"
    },
    /**
     * Registry display text (T-039 review: the search index is structural;
     * all labels resolve through these keys). Keys mirror the registry ids;
     * the parity test in navigationIndex.test.ts fails on any missing pair.
     */
    navEntries: {
      home: {
        title: "Home",
        description: "Homepage and organization overview"
      },
      about: {
        title: "About us",
        description: "Mission, history, values, aims, team and documents"
      },
      projects: {
        title: "Projects",
        description: "All projects, featured first"
      },
      publications: {
        title: "Publications",
        description: "Reports and materials by year"
      },
      events: {
        title: "Events",
        description: "Upcoming events and the calendar"
      },
      support: {
        title: "Support us",
        description: "Ways to support the association"
      },
      contact: {
        title: "Contact",
        description: "Contact details for the association"
      },
      "about-mission": {
        title: "Mission",
        description: "Mission section of the About page"
      },
      "about-history": {
        title: "History",
        description: "History section of the About page"
      },
      "about-values": {
        title: "Values",
        description: "Values section of the About page"
      },
      "about-aims": {
        title: "Aims",
        description: "Aims section of the About page"
      },
      "about-team": {
        title: "Team",
        description: "Team members on the About page"
      },
      "about-documents": {
        title: "Documents",
        description: "Regulations, reports and official files"
      },
      "projects-featured": {
        title: "Featured",
        description: "Featured projects section on the Projects page"
      },
      "projects-all": {
        title: "All projects",
        description: "Every published project on the Projects page"
      },
      "events-upcoming": {
        title: "Upcoming",
        description: "Upcoming events section on the Events page"
      },
      "events-past": {
        title: "Past",
        description: "Past events section on the Events page"
      },
      "events-calendar": {
        title: "Calendar",
        description: "Calendar information on the Events page"
      },
      "home-mission": {
        title: "Our mission",
        description: "Mission section on the homepage"
      },
      "home-upcoming": {
        title: "Upcoming events",
        description: "Upcoming events on the homepage"
      },
      "home-featured": {
        title: "Featured projects",
        description: "Featured projects on the homepage"
      },
      "home-explore": {
        title: "Explore",
        description: "Contact, support and further links"
      },
      year: { description: "Publications from {year}" }
    }
  },
  /** Unified long-form reader (T-040, D-27/D-32/D-34/D-36/D-38). */
  reader: {
    retry: "Try again",
    language: {
      label: "Reading language"
    },
    toc: {
      label: "Table of contents",
      show: "Show table of contents",
      hide: "Hide table of contents"
    },
    controls: {
      heading: "Reading settings",
      textSize: "Text size",
      /* Step 0 is the 16 px baseline — labels start at "Normal". */
      sizes: {
        "0": "Normal",
        "1": "Large",
        "2": "Extra large",
        "3": "Maximum"
      },
      spacingValues: {
        "0": "Standard",
        "1": "Relaxed",
        "2": "Open",
        "3": "Wide"
      },
      measure: "Line width",
      measureValues: {
        narrow: "Narrow",
        medium: "Medium",
        wide: "Wide"
      },
      lineSpacing: "Line spacing",
      paragraphSpacing: "Paragraph spacing",
      decrease: "Decrease",
      increase: "Increase",
      reset: "Reset settings",
      resetDone: "Reading settings reset to defaults."
    },
    states: {
      empty: "This text is not available.",
      unsupported: "This text is not available in a readable version yet.",
      /* The download sentence renders ONLY when files exist (rev-1 F). */
      unsupportedDownload: " The original file can still be downloaded below."
    }
  },
  nav: {
    language: "Language",
    /**
     * Tooltip/hint on the language switcher trigger — states the action so
     * it is obvious the control changes the language (hover, tap or Enter).
     */
    changeLanguage: "Change language",
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
    publications: "Publications"
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
    /** T-039 area-page sections (TOC labels + headings). */
    upcoming: "Upcoming",
    past: "Past",
    calendar: "Calendar",
    /**
     * Honest state for the past section: the reviewed calendar adapter is
     * upcoming-only (past `from` is clamped to now), so past events are not
     * available on this site yet. Do not remove the section — search and
     * deep links reference `#past`.
     */
    pastEmpty:
      "Past events are not published here yet — the calendar feed carries upcoming events only.",
    /** `#calendar` section: where the list comes from + the question route. */
    calendarNote:
      "This list is published from the organisation's event calendar. Have a question about an event?",
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
    /** T-039: year grouping fallback for rows without `publication_date`. */
    undated: "Undated",
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
    /** T-039 area-page sections (TOC labels + headings). */
    featured: "Featured",
    all: "All projects",
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
  /**
   * Admin shell (T-026). Invited administrators only — there is no
   * registration and no self-service password reset in V1 (deliberate
   * omissions recorded in docs/tickets/T-026-admin-auth.md; accounts are
   * provisioned through trusted Supabase administration,
   * docs/PRODUCT_REQUIREMENTS.md §6).
   */
  admin: {
    title: "Admin",
    description: "Administrator area of the Barykady Kultury website.",
    /** Badge next to the brand mark — text, never color alone. */
    badge: "Admin",
    navLabel: "Admin navigation",
    dashboard: "Dashboard",
    backToSite: "Back to public site",
    signOut: "Sign out",
    signIn: {
      title: "Sign in",
      description: "Administrator sign-in for the Barykady Kultury website.",
      heading: "Administrator sign in",
      intro:
        "Access is limited to invited administrators. Accounts are created by the organisation — there is no self-registration.",
      emailLabel: "Email",
      passwordLabel: "Password",
      submit: "Sign in",
      /** Submission state announced in the live region (WCAG 4.1.3). */
      submitting: "Signing in…",
      /**
       * Neutral on purpose: the destination after sign-in can be any admin
       * path (the preserved redirect), so the announcement must not promise
       * the dashboard specifically.
       */
      success: "Signed in. Opening…",
      errors: {
        emailRequired: "Enter your email address.",
        emailInvalid: "Enter a valid email address.",
        passwordRequired: "Enter your password.",
        invalidCredentials: "The email or password is incorrect.",
        unavailable: "Sign-in is not configured for this site yet.",
        unexpected: "Sign-in failed. Please try again."
      }
    },
    dashboardPage: {
      title: "Admin dashboard",
      description: "Overview of the Barykady Kultury administration area.",
      heading: "Dashboard",
      welcome: "Signed in as {email}.",
      placeholderHeading: "What will appear here",
      placeholder:
        "Project, page, team, publication and event management tools are on the way — each will appear here as it is ready."
    },
    denied: {
      title: "Not authorized",
      description: "Admin access is not granted for the signed-in account.",
      heading: "Not authorized",
      message:
        "You are signed in, but this account does not have administrator access. Ask the organisation to invite you as an administrator, or sign in with a different account.",
      switchAccount: "Sign in with a different account"
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
    /**
     * rev-1 F: the reader names the ACTUAL resolved fallback language.
     * Grammatical forms per UI locale (EN bare names, PL/UK the case form
     * the surrounding sentence requires). Keys are CONTENT locales.
     */
    fallbackLanguageNames: {
      en: "English",
      pl: "Polish",
      uk: "Ukrainian"
    },
    opensInNewTab: "opens in a new tab"
  }
};

export type MessageSchema = typeof en;

export default en;
