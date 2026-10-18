import type { ContactDetails } from "@/config/organization";

/**
 * Contact-details helpers (T-021).
 *
 * The shipped `organization.contact` block is the single source of truth and is
 * empty while D-04 is open. These helpers are pure so the config matrix
 * (all/partial/none) is testable without mocking a whole module.
 */

/** Every contact field, in rendering order. */
export const CONTACT_FIELDS = [
  "email",
  "phone",
  "address",
  "officeHours"
] as const satisfies readonly (keyof ContactDetails)[];

/**
 * True when at least one channel carries non-whitespace content.
 * The page renders the contact block only when this is true; otherwise it shows
 * the translated "not published yet" state.
 */
export function hasContactDetails(details: ContactDetails): boolean {
  return CONTACT_FIELDS.some(field => details[field].trim().length > 0);
}
