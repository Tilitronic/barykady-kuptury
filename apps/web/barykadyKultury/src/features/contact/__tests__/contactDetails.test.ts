import { describe, expect, it } from "vitest";

import { organization, type ContactDetails } from "@/config/organization";
import { hasContactDetails } from "@/features/contact/contactDetails";

/**
 * Spec axis: docs/tickets/T-021-contact-page.md — config matrix and the D-04
 * truthfulness guard.
 *
 * The shipped organization config must stay empty until the NGO supplies
 * verified values, and the page only renders a contact block when at least one
 * channel carries content.
 */

const EMPTY: ContactDetails = {
  email: "",
  phone: "",
  address: "",
  officeHours: ""
};

describe("hasContactDetails", () => {
  it("is false for the empty defaults", () => {
    expect(hasContactDetails(EMPTY)).toBe(false);
  });

  it("is false when fields contain only whitespace", () => {
    expect(hasContactDetails({ ...EMPTY, address: "   " })).toBe(false);
  });

  it("is true when any single channel is configured", () => {
    expect(
      hasContactDetails({ ...EMPTY, officeHours: "Mon–Fri 10:00–16:00" })
    ).toBe(true);
  });
});

describe("shipped organization config (D-04 open)", () => {
  it("commits no unverified contact data", () => {
    expect(organization.contact).toEqual({
      email: "",
      phone: "",
      address: "",
      officeHours: ""
    });
  });
});
