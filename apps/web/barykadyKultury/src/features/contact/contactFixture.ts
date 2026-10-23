import type { ContactDetails } from "@/config/organization";

import { CONTACT_FIELDS } from "./contactDetails";

/**
 * E2E-only contact fixture seam (T-032 gate fix for J7).
 *
 * D-04 is open, so the shipped `organization.contact` block must stay empty.
 * The configured rendering branch still needs end-to-end proof, and inventing
 * real NGO contact data is forbidden (AGENTS.md rule 6). This seam exists only
 * in a build that explicitly sets `VITE_E2E_CONTACT_FIXTURE=1` (the Playwright
 * webServer does; production/netlify builds do not), and the value is read from
 * localStorage so a test can choose configured vs unconfigured per scenario
 * without rebuilding.
 *
 * The parser accepts only the four known string fields; unknown shapes or
 * malformed JSON fall back to `null`, which keeps the shipped empty state.
 */
const CONTACT_FIXTURE_KEY = "bk.e2e.contact";

export function readContactFixture(): ContactDetails | null {
  if (
    typeof __BK_E2E_CONTACT_FIXTURE__ === "undefined" ||
    __BK_E2E_CONTACT_FIXTURE__ !== true
  ) {
    return null;
  }
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(CONTACT_FIXTURE_KEY);
    if (raw === null) return null;

    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object") return null;

    const record = parsed as Record<string, unknown>;
    const details: ContactDetails = {
      email: "",
      phone: "",
      address: "",
      officeHours: ""
    };

    for (const field of CONTACT_FIELDS) {
      const value = record[field];
      if (typeof value === "string") details[field] = value;
    }

    return details;
  } catch {
    return null;
  }
}
