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
    /** Short label for the title attr + hover/focus tooltip (header lane). */
    triggerTooltip: "Search",
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
      decrease: "Decrease",
      increase: "Increase",
      reset: "Reset settings",
      resetDone: "Reading settings reset to defaults.",
      /* Original-file affordance (content-original endpoint). */
      downloadOriginal: "Download the original file."
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
    /** Phone band: the drawer holds the complete menu while the bottom bar is the main navigation. */
    fullMenu: "Full menu",
    /** Bottom-bar entry that opens the drawer with all destinations. */
    more: "More",
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
  /**
   * T-043 — localized accessible/visible names for social platforms. Brand
   * names stay in their official Latin form in every locale (the platforms'
   * own UI convention); a platform without an entry falls back to the
   * configured link label.
   */
  social: {
    labels: {
      facebook: "Facebook",
      instagram: "Instagram",
      telegram: "Telegram",
      youtube: "YouTube",
      twitter: "X (Twitter)",
      linkedin: "LinkedIn"
    }
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
    /** T-043 — heading above the labeled social block on the Contact page. */
    followUs: "Follow us",
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
    /**
     * T-027 — project management. Fields, per-locale tabs, lifecycle actions
     * and the draft preview. The form renders only these strings (no
     * hard-coded copy) and every message is localized in en/pl/uk.
     */
    projects: {
      title: "Projects",
      description: "Create and manage the organization's projects.",
      heading: "Projects",
      intro:
        "Create, edit, preview and publish projects. Drafts are never visible to the public.",
      newProject: "New project",
      filterLabel: "Filter by status",
      filterAll: "All statuses",
      statuses: {
        draft: "Draft",
        published: "Published",
        archived: "Archived"
      },
      empty: "No projects yet.",
      listFailed: "Projects could not be loaded.",
      retry: "Try again",
      updated: "Updated {date}",
      updatedLabel: "Updated",
      completeness: {
        label: "Translation completeness",
        complete: "Complete",
        incomplete: "Incomplete",
        notStarted: "Not started",
        missing: "Missing: {fields}"
      },
      fields: {
        slug: "URL slug",
        slugHint:
          "Shared by every language; lowercase letters, numbers and hyphens. It never changes automatically when the title changes.",
        status: "Status",
        featured: "Feature on the homepage",
        featuredHint: "Homepage order is managed separately.",
        startDate: "Start date",
        endDate: "End date",
        cover: "Cover image",
        coverHint: "PNG, JPEG or WebP. Optional.",
        coverChoose: "Choose an image",
        coverSelected: "Selected: {name}",
        coverCurrent:
          "A cover is already stored. Choosing a new image replaces it."
      },
      tabs: {
        label: "Language versions",
        en: "English",
        pl: "Polish",
        uk: "Ukrainian"
      },
      translation: {
        title: "Title",
        summary: "Summary",
        body: "Body",
        bodyHint: "Plain text or Markdown. Raw HTML is not rendered."
      },
      actions: {
        save: "Save",
        saving: "Saving…",
        publish: "Publish",
        publishing: "Publishing…",
        unpublish: "Unpublish",
        unpublishing: "Unpublishing…",
        archive: "Archive",
        archiving: "Archiving…",
        delete: "Delete",
        deleting: "Deleting…",
        preview: "Preview",
        cancel: "Cancel",
        back: "Back to projects"
      },
      messages: {
        draftSaved: "Draft saved.",
        published: "Published. The project is now public.",
        unpublished: "Unpublished. The project is no longer public.",
        archived: "Archived.",
        deleted: "Project deleted."
      },
      errors: {
        slugRequired: "Enter a URL slug.",
        slugFormat:
          "Use lowercase letters, numbers and hyphens, for example spring-workshop.",
        slugDuplicate: "This URL slug is already used by another project.",
        startDateInvalid: "Enter a valid start date.",
        endDateBeforeStart: "The end date must not be before the start date.",
        translationTitleRequired:
          "Enter a title before adding summary or body text.",
        publishFallbackIncomplete:
          "Add an English title and summary before publishing.",
        saveFailed: "The project could not be saved. Try again.",
        loadFailed: "The project could not be loaded.",
        unavailable: "The content service is not configured.",
        uploadFailed: "The cover image could not be uploaded.",
        notAnImage: "Choose a PNG, JPEG or WebP image.",
        deleteFailed: "The project could not be deleted. Try again.",
        notFound: "Project not found."
      },
      deleteDialog: {
        title: "Delete this project?",
        message:
          "This permanently deletes the project and its translations. This cannot be undone.",
        confirm: "Delete project"
      },
      preview: {
        title: "Draft preview",
        description: "Administrator preview of a project.",
        banner: "Draft preview — this project is not visible to the public.",
        incomplete:
          "No complete translation is available yet. Add a title, summary and body to preview this project.",
        back: "Back to editor"
      }
    },
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
        "Page, team, publication and event management tools are on the way — each will appear here as it is ready."
    },
    denied: {
      title: "Not authorized",
      description: "Admin access is not granted for the signed-in account.",
      heading: "Not authorized",
      message:
        "You are signed in, but this account does not have administrator access. Ask the organisation to invite you as an administrator, or sign in with a different account.",
      switchAccount: "Sign in with a different account"
    },
    import: {
      title: "Import content",
      description:
        "Import a document or publication language version from Markdown, Word or Google Docs.",
      heading: "Import content",
      intro:
        "Convert a file or a Google Doc, review the safe preview and metadata, then publish. Originals stay private.",
      provider: {
        legend: "Source",
        file: "File",
        google: "Google Docs"
      },
      fields: {
        kind: "Content type",
        document: "Document",
        publication: "Publication",
        locale: "Language",
        title: "Title",
        titleHint: "Required for every language version.",
        description: "Description or abstract",
        documentType: "Document type",
        slug: "URL slug",
        slugHint:
          "Shared by every language; lowercase letters, numbers and hyphens.",
        allowOriginalDownload: "Allow original download",
        allowOriginalDownloadHint:
          "Off by default. When on, the public reader offers a short-lived signed download."
      },
      file: {
        label: "Markdown or Word file",
        hint: "Accepted: .md and .docx. .odt/.docm are rejected with save-as-DOCX guidance.",
        choose: "Choose a file",
        selected: "Selected file",
        converting: "Converting…"
      },
      google: {
        label: "Google Doc ID or URL",
        hint: "Drive export is DOCX; the public site renders the stored copy, never an iframe.",
        import: "Import from Google",
        syncNow: "Sync now",
        check: "Check for changes",
        syncing: "Checking Google Drive…"
      },
      preview: {
        heading: "Safe preview",
        empty: "Choose a file or a Google Doc to see a preview.",
        blocking: "Resolve these issues before publishing:",
        warning: "Conversion notes:",
        altLabel: "Alternative text for {file}",
        altHint: "Required for every informative image."
      },
      actions: {
        publish: "Publish",
        publishing: "Publishing…",
        saveDraft: "Save draft",
        savingDraft: "Saving…"
      },
      status: {
        converted: "Converted. Review the preview and title, then publish.",
        published: "Published. The public reader can now show this version.",
        draftSaved: "Draft saved.",
        unchanged: "No new changes in Google Drive.",
        updateAvailable: "An update is available.",
        checking: "Checking…",
        failed: "The import did not complete."
      },
      sync: {
        heading: "Google sync",
        lastSynced: "Last synced: {time}",
        never: "Never synced",
        jobQueued: "Queued…",
        jobRunning: "Syncing…",
        jobSucceeded: "Sync complete.",
        jobUnchanged: "Already up to date.",
        jobBlocked: "Sync blocked by content issues.",
        jobFailed: "Sync failed. The published copy was not changed.",
        diffHeading: "Change summary",
        blocks: "{previous} → {next} blocks",
        headings: "{count} headings",
        images: "{count} images",
        tables: "{count} tables",
        added: "Added: {items}",
        removed: "Removed: {items}"
      },
      errors: {
        titleRequired: "Enter a title.",
        slugRequired: "Enter a URL slug.",
        noFile: "Choose a file first.",
        conversionFailed: "The file could not be converted.",
        publishFailed: "The import could not be saved.",
        googleFailed: "Google sync could not be started.",
        noSupabase: "The content service is not configured.",
        blocking: "Missing image alt text blocks publishing."
      },
      schedule: {
        heading: "Scheduled freshness",
        description:
          "A nightly job checks Google Docs and updates changed copies. Manual sync remains an override.",
        lastRun: "Last scheduled run",
        checked: "Checked {count}",
        updated: "Updated {count}",
        failed: "Failed {count}",
        skipped: "Skipped {count}",
        none: "No scheduled run recorded yet."
      }
    }
  },
  /**
   * T-041 content import. The converter returns stable issue/error codes;
   * these strings are the only user-facing text (EN/PL/UK parity is enforced
   * by the catalogue test).
   */
  import: {
    title: "Import content",
    description:
      "Import a Markdown or Word (.docx) file and review the converted content before publishing.",
    acceptedFormats: "Accepted formats: Markdown (.md) and Word (.docx).",
    errors: {
      emptyFile: "The selected file is empty.",
      fileTooLarge: "The file is too large to import.",
      invalidSize: "The file size is invalid.",
      invalidFileName: "The file name is not valid.",
      unsupportedExtension:
        "This file type cannot be imported. Use Markdown (.md) or Word (.docx).",
      unsupportedMime: "The file's reported type is not supported.",
      mimeExtensionMismatch: "The file name and file type do not match.",
      activeContent:
        "Active content such as HTML, SVG or JavaScript cannot be imported.",
      odtDeferred:
        "OpenDocument text (.odt) is not supported yet. Save the document as Word (.docx) in your editor, then import the .docx file.",
      docmRejected:
        "Macro-enabled Word documents (.docm) are not accepted. Save the document as .docx without macros, then import it.",
      docxUnsafeZip:
        "The Word file is damaged or exceeds the safe import limits.",
      docxMacros:
        "The Word file contains macros, which are not allowed. Save it as .docx without macros.",
      docxInvalid: "The Word file could not be read.",
      emptyDocument: "The file contains no readable content.",
      conversionFailed:
        "The file could not be converted. Check the file and try again.",
      conversionTimeout: "Conversion took too long and was stopped."
    },
    warnings: {
      rawHtmlDropped: "Raw HTML was removed from the Markdown.",
      unsafeLink:
        "A link with an unsupported address was converted to plain text.",
      remoteImageStripped:
        "A remote image was removed. Upload the image to the site and insert its asset reference instead.",
      imageUnresolved:
        "An image could not be linked to an uploaded asset and was removed.",
      nestedListFlattened:
        "A nested list was flattened to match the reader format.",
      unsupportedFormatting: "Some formatting was simplified for the reader.",
      imageAltMissing:
        "An image has no alternative text. Add a description before publishing.",
      imageUnsupported:
        "An image in an unsupported format was removed. Use PNG, JPEG or WebP.",
      docxWarning: "The Word file produced a conversion warning."
    }
  },
  notFound: {
    title: "Page not found",
    description: "The page you requested could not be found.",
    message: "The page you requested could not be found."
  },
  content: {
    updateAvailable: "An update is available.",
    showUpdate: "Show update",
    updating: "Loading the update…",
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
