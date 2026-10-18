import { describe, expect, it } from "vitest";

import { organization, type ContactDetails } from "@/config/organization";
import {
  hasContactDetails,
  resolveContactDetails
} from "@/features/contact/contactDetails";

/**
 * Spec axis: docs/tickets/T-021-contact-page.md — config matrix and the D-04
 * truthfulness guard.
 *
 * `resolveContactDetails` is the pure merge used by the page; the E2E fixture
 * seam (see `contactDetails.ts`) feeds it an override, and the shipped
 * organization config must stay empty until the NGO supplies verified values.
 */

const EMPTY: ContactDetails = {
  email: "",
  phone: "",
  address: "",
  officeHours: ""
};

describe("resolveContactDetails", () => {
  it("returns the base unchanged when there is no override", () => {
    expect(resolveContactDetails(EMPTY)).toEqual(EMPTY);
  });

  it("applies only the supplied override fields", () => {
    expect(resolveContactDetails(EMPTY, { email: "a@b.org" })).toEqual({
      ...EMPTY,
      email: "a@b.org"
    });
  });

  it("lets an explicit empty override clear a base value", () => {
    const base: ContactDetails = { ...EMPTY, phone: "123" };

    expect(resolveContactDetails(base, { phone: "" }).phone).toBe("");
  });
});

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
