import { describe, expect, it } from "vitest";

import { mailtoHref, telHref } from "@/shared/links";

/**
 * Spec axis: docs/tickets/T-021-contact-page.md — TDD plan step 3.
 *
 * `mailto:` URIs must percent-encode the prefilled subject so spaces and
 * reserved characters (`&`, `#`, non-Latin letters) survive the trip through a
 * mail client, and `tel:` URIs must strip human formatting so the number is
 * dialable.
 */
describe("mailtoHref", () => {
  it("builds a plain mailto link when no subject is given", () => {
    expect(mailtoHref("kontakt@barykadykultury.org")).toBe(
      "mailto:kontakt@barykadykultury.org"
    );
  });

  it("trims a padded address", () => {
    expect(mailtoHref("  kontakt@barykadykultury.org  ")).toBe(
      "mailto:kontakt@barykadykultury.org"
    );
  });

  it("percent-encodes spaces in the prefilled subject", () => {
    expect(mailtoHref("k@x.org", "Message from the website")).toBe(
      "mailto:k@x.org?subject=Message%20from%20the%20website"
    );
  });

  it("percent-encodes reserved characters in the subject", () => {
    expect(mailtoHref("k@x.org", "Question & topic #1")).toBe(
      "mailto:k@x.org?subject=Question%20%26%20topic%20%231"
    );
  });

  it("round-trips a non-Latin subject", () => {
    const subject = "Питання щодо подій";
    const href = mailtoHref("k@x.org", subject);

    expect(href).toBe(`mailto:k@x.org?subject=${encodeURIComponent(subject)}`);
    expect(decodeURIComponent(href.split("subject=")[1] ?? "")).toBe(subject);
  });
});

describe("telHref", () => {
  it("strips spaces from an international format", () => {
    expect(telHref("+48 61 000 00 00")).toBe("tel:+48610000000");
  });

  it("strips punctuation from a national format", () => {
    expect(telHref("(61) 000-00-00")).toBe("tel:610000000");
  });

  it("trims surrounding whitespace", () => {
    expect(telHref("  61 000 00 00  ")).toBe("tel:610000000");
  });
});
