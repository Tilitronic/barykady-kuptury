import type { ContactDetails } from "@/config/organization";

/**
 * Contact-details resolution (T-021).
 *
 * The shipped `organization.contact` block is the source of truth and is empty
 * while D-04 is open. `resolveContactDetails` is a pure merge so the config
 * matrix (all/partial/none) is testable without mocking a whole module.
 */

/** Every contact field, in rendering order. Single list shared by the merge. */
export const CONTACT_FIELDS = [
  "email",
  "phone",
  "address",
  "officeHours"
] as const satisfies readonly (keyof ContactDetails)[];

/**
 * Merges a partial override over the base contact details.
 *
 * An explicit empty string in the override wins over a non-empty base value
 * (only `undefined` falls through), so a caller can clear a channel.
 */
export function resolveContactDetails(
  base: ContactDetails,
  override?: Partial<ContactDetails>
): ContactDetails {
  if (!override) return base;

  return {
    email: override.email ?? base.email,
    phone: override.phone ?? base.phone,
    address: override.address ?? base.address,
    officeHours: override.officeHours ?? base.officeHours
  };
}

/**
 * True when at least one channel carries non-whitespace content.
 * The page renders the contact block only when this is true; otherwise it shows
 * the translated "not published yet" state.
 */
export function hasContactDetails(details: ContactDetails): boolean {
  return CONTACT_FIELDS.some(field => details[field].trim().length > 0);
}

/**
 * E2E fixture seam — resolves contact details for the contact page.
 *
 * The page always starts from the verified static config. In the Playwright
 * build only (`VITE_CONTACT_FIXTURE === "enabled"`), a `window.__BK_CONTACT__`
 * object may supply fixture values so the configured-rendering branch can be
 * proven in a real browser without editing the committed, verified config. The
 * flag is a build-time constant: every build that does not opt in leaves the
 * seam inert, and production never sets the global.
 *
 * Only the four contact fields participate, and only string values are read —
 * anything else is ignored. This is a test seam, never a source of truth.
 */
const CONTACT_FIXTURE_SEAM_ENABLED =
  import.meta.env.VITE_CONTACT_FIXTURE === "enabled";

interface ContactFixtureGlobal {
  __BK_CONTACT__?: unknown;
}

/** Reads a validated fixture override, or `undefined` when the seam is off. */
export function readContactOverride(): Partial<ContactDetails> | undefined {
  if (!CONTACT_FIXTURE_SEAM_ENABLED || typeof window === "undefined") {
    return undefined;
  }

  const candidate = (window as unknown as ContactFixtureGlobal).__BK_CONTACT__;

  if (typeof candidate !== "object" || candidate === null) return undefined;

  const record = candidate as Record<string, unknown>;
  const override: Partial<ContactDetails> = {};

  for (const field of CONTACT_FIELDS) {
    const value = record[field];
    if (typeof value === "string") override[field] = value;
  }

  return Object.keys(override).length > 0 ? override : undefined;
}
