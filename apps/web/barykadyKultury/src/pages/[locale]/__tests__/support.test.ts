import { describe, expect, it } from "vitest";

import SupportPage from "@/pages/[locale]/support.vue";
import type { SupportOptions } from "@/config/support";
import { mountWithPlugins } from "@/test-utils/mount";

/**
 * Spec axis: docs/tickets/T-022-support-page.md — the shipped state (D-06
 * open) is the translated empty message plus the truthful no-payment
 * statement, with nothing invented. The configured matrix (option ordering,
 * primary/secondary hierarchy, link safety) is proven here by passing the
 * options as a plain prop — no runtime test seam in production code (the
 * T-021 review rule).
 */

function options(overrides: Partial<SupportOptions> = {}): SupportOptions {
  return {
    donationUrl: "",
    donationLabel: "",
    bankTransfer: { accountNumber: "", recipient: "", paymentTitle: "" },
    volunteeringEmail: "",
    ...overrides
  };
}

async function mountSupport(
  locale: "en" | "pl" | "uk" = "en",
  props: Record<string, unknown> = {}
) {
  return mountWithPlugins(SupportPage, {
    locale,
    props,
    initialRoute: `/${locale}/support`,
    routes: [
      {
        path: "/:locale(en|pl|uk)/support",
        name: "support",
        component: SupportPage
      }
    ]
  });
}

describe("support page — shipped empty state", () => {
  it("shows the translated empty message and the no-payment statement", async () => {
    const wrapper = await mountSupport("en");

    expect(wrapper.get("h1").text()).toBe("Support us");
    expect(wrapper.text()).toContain(
      "Ways to support the association are being prepared."
    );
    expect(wrapper.get(".support-page__no-payment").text()).toContain(
      "We do not process card payments on this website."
    );
  });

  it("shows the empty message translated into Polish", async () => {
    const wrapper = await mountSupport("pl");

    expect(wrapper.text()).toContain("Formy wsparcia stowarzyszenia");
    expect(wrapper.get(".support-page__no-payment").text()).toContain(
      "Nie przetwarzamy płatności kartowych"
    );
    expect(wrapper.text()).not.toContain("Ways to support");
  });

  it("invents nothing: no action links, no account numbers, no external hrefs", async () => {
    const wrapper = await mountSupport("en");

    expect(wrapper.find(".action-link").exists()).toBe(false);
    expect(wrapper.find(".support-bank").exists()).toBe(false);
    expect(wrapper.find('a[href^="http"]').exists()).toBe(false);
    expect(wrapper.find('a[href^="mailto:"]').exists()).toBe(false);
  });

  it("renders no payment form or iframe anywhere (acceptance criterion)", async () => {
    const wrapper = await mountSupport("en");

    expect(wrapper.find("form").exists()).toBe(false);
    expect(wrapper.find("iframe").exists()).toBe(false);
    expect(wrapper.find("input, select").exists()).toBe(false);
  });
});

describe("support page — configured options (prop-injected)", () => {
  it("renders only the configured donation link, as the primary action, opening safely", async () => {
    const wrapper = await mountSupport("en", {
      options: options({ donationUrl: "https://help.example.org/bk" })
    });

    const links = wrapper.findAll(".action-link");
    expect(links).toHaveLength(1);
    expect(links[0]?.attributes("href")).toBe("https://help.example.org/bk");
    expect(links[0]?.classes()).toContain("action-link--primary");
    expect(links[0]?.attributes("target")).toBe("_blank");
    expect(links[0]?.attributes("rel")).toBe("noopener noreferrer");
    expect(wrapper.find(".support-bank").exists()).toBe(false);
    // The intro replaces the empty message once options exist.
    expect(wrapper.text()).toContain("You can support our activities");
    expect(wrapper.text()).not.toContain("are being prepared");
  });

  it("uses the configured donation label when supplied", async () => {
    const wrapper = await mountSupport("en", {
      options: options({
        donationUrl: "https://help.example.org",
        donationLabel: "Help on the NGO portal"
      })
    });

    expect(wrapper.get(".action-link").text()).toContain(
      "Help on the NGO portal"
    );
  });

  it("renders bank details as selectable labelled text with optional fields collapsed", async () => {
    const wrapper = await mountSupport("pl", {
      options: options({
        bankTransfer: {
          accountNumber: "12 3456 7890 1234 5678 9012",
          recipient: "Stowarzyszenie Barykady Kultury",
          paymentTitle: ""
        }
      })
    });

    expect(wrapper.get(".support-bank__heading").text()).toBe(
      "Przelew bankowy"
    );
    const terms = wrapper.findAll(".support-bank__term");
    expect(terms).toHaveLength(2); // payment title omitted, never a blank row
    expect(terms.map(term => term.text())).toEqual(["Numer konta", "Odbiorca"]);
    expect(wrapper.get(".support-bank__account").text()).toBe(
      "12 3456 7890 1234 5678 9012"
    );
    expect(wrapper.find(".action-link").exists()).toBe(false);
  });

  it("orders every option donation → bank → volunteering, first one primary", async () => {
    const wrapper = await mountSupport("en", {
      options: options({
        donationUrl: "https://help.example.org",
        bankTransfer: {
          accountNumber: "123",
          recipient: "BK",
          paymentTitle: "Darowizna"
        },
        volunteeringEmail: "volunteer@example.org"
      })
    });

    const sections = wrapper.findAll(".support-option");
    expect(sections).toHaveLength(3);
    expect(sections[0]?.find(".action-link--primary").exists()).toBe(true);
    expect(sections[1]?.find(".support-bank__heading").exists()).toBe(true);

    const volunteering = sections[2]?.get(".action-link");
    expect(volunteering?.classes()).toContain("action-link--secondary");
    expect(volunteering?.attributes("href")).toBe(
      "mailto:volunteer@example.org"
    );
    // Same-tab link: no new-tab attributes on mailto.
    expect(volunteering?.attributes("target")).toBeUndefined();
  });

  it("still renders no payment form or iframe when configured", async () => {
    const wrapper = await mountSupport("en", {
      options: options({
        donationUrl: "https://help.example.org",
        bankTransfer: {
          accountNumber: "123",
          recipient: "BK",
          paymentTitle: "t"
        }
      })
    });

    expect(wrapper.find("form").exists()).toBe(false);
    expect(wrapper.find("iframe").exists()).toBe(false);
    // The no-payment statement stays visible with real options present.
    expect(wrapper.get(".support-page__no-payment").text()).toContain(
      "We do not process card payments"
    );
  });
});
