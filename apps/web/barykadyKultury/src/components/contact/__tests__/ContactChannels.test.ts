import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import ContactChannels from "@/components/contact/ContactChannels.vue";
import type { ContactDetails } from "@/config/organization";
import { createTestI18n } from "@/test-utils/mount";

/**
 * Spec axis: docs/tickets/T-021-contact-page.md — "render only configured
 * channels; each optional and omitted when empty" and "configured values render
 * as working `mailto:`/`tel:` links with accessible names".
 */

const EMPTY: ContactDetails = {
  email: "",
  phone: "",
  address: "",
  officeHours: ""
};

const FULL: ContactDetails = {
  email: "kontakt@example.org",
  phone: "+48 61 000 00 00",
  address: "ul. Przykładowa 1, 00-000 Poznań",
  officeHours: "Mon–Fri 10:00–16:00"
};

function render(details: ContactDetails, locale: "en" | "pl" | "uk" = "en") {
  return mount(ContactChannels, {
    props: { details },
    global: { plugins: [createTestI18n(locale)] }
  });
}

describe("ContactChannels", () => {
  it("renders a semantic address with a definition list of all channels", () => {
    const wrapper = render(FULL);

    expect(wrapper.find("address").exists()).toBe(true);
    expect(wrapper.findAll("dt").map(term => term.text())).toEqual([
      "Email",
      "Phone",
      "Address",
      "Office hours"
    ]);
    expect(wrapper.text()).toContain("ul. Przykładowa 1, 00-000 Poznań");
    expect(wrapper.text()).toContain("Mon–Fri 10:00–16:00");
  });

  it("exposes the email as a mailto link whose accessible name is the address", () => {
    const wrapper = render(FULL);
    const link = wrapper.get('a[href^="mailto:"]');

    expect(link.text()).toBe("kontakt@example.org");
    expect(link.attributes("href")).toBe(
      `mailto:kontakt@example.org?subject=${encodeURIComponent("Message from the website")}`
    );
  });

  it("exposes the phone as a normalized tel link while showing the raw number", () => {
    const wrapper = render(FULL);
    const link = wrapper.get('a[href^="tel:"]');

    expect(link.attributes("href")).toBe("tel:+48610000000");
    expect(link.text()).toBe("+48 61 000 00 00");
  });

  it("omits every channel that is not configured", () => {
    const wrapper = render({ ...EMPTY, email: "kontakt@example.org" });

    expect(wrapper.findAll("dt").map(term => term.text())).toEqual(["Email"]);
    expect(wrapper.find('a[href^="tel:"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain("Office hours");
  });

  it("renders nothing at all when no channel is configured", () => {
    const wrapper = render(EMPTY);

    expect(wrapper.find("address").exists()).toBe(false);
    expect(wrapper.text()).toBe("");
  });

  it("localizes the field labels", () => {
    const wrapper = render({ ...EMPTY, email: "kontakt@example.org" }, "pl");

    expect(wrapper.get("dt").text()).toBe("E-mail");
  });
});
