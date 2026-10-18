/**
 * Organization configuration — single source of truth for verified facts.
 *
 * Design constraint: D-04 (contact data — OPEN), D-05 (social URLs — OPEN).
 * Never invent data. Fields that are empty here stay hidden in the UI.
 *
 * Verified facts (NGOinfoSources/govIds.txt, brandbook p. 1, D-13):
 *   name   — "Barykady Kultury"
 *   seat   — Poznań
 *   NIP    — 7831961912
 *   REGON  — 545503070
 */

/** A configured social media channel. */
export interface SocialLink {
  /** Platform identifier, also used for icon selection. */
  platform: "facebook" | "instagram" | "youtube" | "twitter" | "linkedin";
  /** Human-readable accessible name for the icon-only link (DESIGN_SYSTEM.md §4). */
  label: string;
  /**
   * Canonical URL for this channel.
   * An empty string means "not configured" — the link will not render (D-05).
   */
  url: string;
}

/**
 * Public contact details — the single place D-04 data lands (T-021).
 *
 * Every field is optional *by convention*: an empty string means "not
 * configured", and the UI omits that channel entirely rather than rendering a
 * placeholder. Keeping this a nested block (rather than loose top-level fields)
 * makes "the contact block" one value that can be resolved, overridden in tests
 * and passed to a component without reaching into unrelated organization facts.
 */
export interface ContactDetails {
  /** Public contact email. `mailto:` when non-empty. */
  email: string;
  /** Public contact phone. `tel:` when non-empty. */
  phone: string;
  /** Public postal/street address. Rendered as text when non-empty. */
  address: string;
  /** Public office/opening hours. Rendered as text when non-empty. */
  officeHours: string;
}

/** Complete organization configuration shape. */
export interface OrganizationConfig {
  /** Verified legal name. Source: brandbook / govIds.txt. */
  name: string;
  /** Registered seat city. Source: govIds.txt. */
  seat: string;
  /**
   * When true, NIP and REGON may appear in the footer legal line.
   * The identifiers are verified (govIds.txt) and are ordinary association
   * identifiers (NIP + REGON; no KRS — not required for ordinary associations).
   */
  showLegalIds: boolean;
  /** Verified NIP (Numer Identyfikacji Podatkowej). */
  nip: string;
  /** Verified REGON (Rejestr Gospodarki Narodowej). */
  regon: string;
  /**
   * Public contact details.
   * D-04 OPEN — every field is empty until the project owner supplies a
   * verified value. The footer contact block and the Contact page render only
   * the non-empty channels; an entirely empty block renders nothing.
   */
  contact: ContactDetails;
  /**
   * Configured social media channels.
   * D-05 OPEN — the list is empty until the project owner supplies real URLs.
   * SocialLinks renders nothing when this list is empty or all URLs are empty.
   */
  socialLinks: SocialLink[];
  /**
   * Privacy policy page URL.
   * Renders in the footer only when non-empty.
   */
  privacyUrl: string;
}

/**
 * The live organization configuration.
 *
 * D-04: `contact` is intentionally empty — the footer contact block and the
 *       Contact page stay hidden/empty until the NGO owner supplies verified
 *       data (T-021).
 * D-05: socialLinks is intentionally empty — the social block renders nothing.
 */
export const organization: OrganizationConfig = {
  name: "Barykady Kultury",
  seat: "Poznań",
  showLegalIds: true,
  nip: "7831961912",
  regon: "545503070",
  // D-04 OPEN: render nothing until verified data is supplied.
  contact: {
    email: "",
    phone: "",
    address: "",
    officeHours: ""
  },
  // D-05 OPEN: render nothing until real URLs are supplied.
  socialLinks: [],
  privacyUrl: ""
};
