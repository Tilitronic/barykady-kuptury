import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import SocialLinks from "@/components/navigation/SocialLinks.vue";
import type { SocialLink } from "@/config/organization";
import { createTestI18n } from "@/test-utils/mount";

/**
 * T-011 — SocialLinks component contract.
 *
 * D-05: social URLs are OPEN — the component must render nothing when all
 * links have empty URLs.  When a URL is present every link needs an accessible
 * name so icon-only controls are not ambiguous (DESIGN_SYSTEM.md §4/§6 and
 * PRODUCT_REQUIREMENTS.md §4).
 */

function mountLinks(links: SocialLink[] = []) {
  return mount(SocialLinks, {
    props: { links },
    // useI18n is called inside SocialLinks (for footer.socialNav list label).
    global: { plugins: [createTestI18n()] }
  });
}

const facebook: SocialLink = {
  platform: "facebook",
  label: "Barykady Kultury on Facebook",
  url: "https://facebook.com/barykadykultury"
};

const emptyFacebook: SocialLink = {
  platform: "facebook",
  label: "Barykady Kultury on Facebook",
  url: ""
};

const instagram: SocialLink = {
  platform: "instagram",
  label: "Barykady Kultury on Instagram",
  url: "https://instagram.com/barykadykultury"
};

describe("SocialLinks", () => {
  it("renders nothing when no links configured", () => {
    const wrapper = mountLinks([]);

    expect(wrapper.find("a").exists()).toBe(false);
  });

  it("renders nothing when all URLs are empty strings", () => {
    const wrapper = mountLinks([emptyFacebook]);

    expect(wrapper.find("a").exists()).toBe(false);
  });

  it("renders only the entries with a non-empty URL", () => {
    const wrapper = mountLinks([emptyFacebook, facebook]);

    const links = wrapper.findAll("a");
    expect(links).toHaveLength(1);
  });

  it("gives each icon an accessible name via aria-label", () => {
    const wrapper = mountLinks([facebook]);

    const link = wrapper.get("a");
    expect(link.attributes("aria-label")).toBe(facebook.label);
  });

  it("applies rel='noopener noreferrer' to every link", () => {
    const wrapper = mountLinks([facebook, instagram]);

    wrapper.findAll("a").forEach(link => {
      expect(link.attributes("rel")).toContain("noopener");
      expect(link.attributes("rel")).toContain("noreferrer");
    });
  });

  it("sets the href to the configured URL", () => {
    const wrapper = mountLinks([facebook]);

    expect(wrapper.get("a").attributes("href")).toBe(facebook.url);
  });

  it("opens in a new tab", () => {
    const wrapper = mountLinks([facebook]);

    expect(wrapper.get("a").attributes("target")).toBe("_blank");
  });
});
