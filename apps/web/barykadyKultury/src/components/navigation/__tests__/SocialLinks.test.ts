import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import SocialLinks from "@/components/navigation/SocialLinks.vue";
import type { SocialLink } from "@/config/organization";
import { createTestI18n } from "@/test-utils/mount";

/**
 * T-011 + T-043 — SocialLinks component contract.
 *
 * D-05: the component must render nothing when all links have empty URLs.
 * T-043 adds inline SVG icons (no more "FB"/"IG" text abbreviations), an
 * `icon`/`labeled` variant axis, and localized accessible names from
 * `social.labels.<platform>` with a fallback to the configured link label.
 */

function mountLinks(
  links: SocialLink[] = [],
  props: Record<string, unknown> = {},
  locale: "en" | "pl" | "uk" = "en"
) {
  return mount(SocialLinks, {
    props: { links, ...props },
    global: { plugins: [createTestI18n(locale)] }
  });
}

const facebook: SocialLink = {
  platform: "facebook",
  label: "Barykady Kultury on Facebook",
  url: "https://www.facebook.com/BARYKADYKULTURY/"
};

const emptyFacebook: SocialLink = {
  platform: "facebook",
  label: "Barykady Kultury on Facebook",
  url: ""
};

const instagram: SocialLink = {
  platform: "instagram",
  label: "Barykady Kultury on Instagram",
  url: "https://www.instagram.com/barykadykultury/"
};

const telegram: SocialLink = {
  platform: "telegram",
  label: "Barykady Kultury on Telegram",
  url: "https://t.me/barykadykultury"
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
    expect(link.attributes("aria-label")).toBeTruthy();
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

  describe("T-043: inline SVG icons", () => {
    it("renders an inline SVG icon instead of a text abbreviation", () => {
      const wrapper = mountLinks([facebook]);

      const svg = wrapper.find("a svg");
      expect(svg.exists()).toBe(true);
      // The old temporary icons were text abbreviations ("FB", "IG", …) —
      // they must be gone from the accessible AND visible content.
      expect(wrapper.get("a").text()).toBe("");
    });

    it("marks the decorative SVG aria-hidden", () => {
      const wrapper = mountLinks([facebook]);

      expect(wrapper.get("a svg").attributes("aria-hidden")).toBe("true");
    });

    it("supports the telegram platform", () => {
      const wrapper = mountLinks([telegram]);

      expect(wrapper.findAll("a")).toHaveLength(1);
      expect(wrapper.find("a svg").exists()).toBe(true);
      expect(wrapper.get("a").attributes("aria-label")).toBe("Telegram");
    });

    it("renders a fallback icon for platforms without a dedicated glyph", () => {
      // The union type blocks unknown platforms at compile time; a stale or
      // hand-edited config could still carry one — the component must not
      // render a blank control (the link keeps its label + a generic icon).
      const unknown = {
        platform: "mastodon",
        label: "Mastodon",
        url: "https://mastodon.social/@barykady"
      } as unknown as SocialLink;

      const wrapper = mountLinks([unknown]);

      expect(wrapper.find("a svg").exists()).toBe(true);
      expect(wrapper.get("a").attributes("aria-label")).toBe("Mastodon");
    });
  });

  describe("T-043: localized accessible labels", () => {
    it("uses social.labels.<platform> for the aria-label in English", () => {
      const wrapper = mountLinks([facebook, telegram], {}, "en");

      const labels = wrapper.findAll("a").map(a => a.attributes("aria-label"));
      expect(labels).toEqual(["Facebook", "Telegram"]);
    });

    it("uses localized labels in Polish and Ukrainian", () => {
      const pl = mountLinks([facebook], {}, "pl");
      expect(pl.get("a").attributes("aria-label")).toBe("Facebook");

      const uk = mountLinks([telegram], {}, "uk");
      expect(uk.get("a").attributes("aria-label")).toBe("Telegram");
    });

    it("falls back to the configured link label when no translation exists", () => {
      const unknown = {
        platform: "youtube",
        // Deliberately blank: the component must fall back to a name, and
        // with no translation for a made-up platform the configured label is
        // the only candidate.
        label: "Our YouTube channel",
        url: "https://youtube.com/@barykadykultury"
      };
      const wrapper = mountLinks([
        { ...unknown, platform: "unknown" as SocialLink["platform"] }
      ]);

      expect(wrapper.get("a").attributes("aria-label")).toBe(
        "Our YouTube channel"
      );
    });

    it("mirrors the accessible name in the title attribute", () => {
      const wrapper = mountLinks([telegram]);

      expect(wrapper.get("a").attributes("title")).toBe("Telegram");
    });
  });

  describe("T-043: icon vs labeled variants", () => {
    it("defaults to the icon variant with no visible text", () => {
      const wrapper = mountLinks([facebook]);

      expect(wrapper.get("a").classes()).toContain("social-links__link--icon");
      expect(wrapper.get("a").text()).toBe("");
    });

    it("labeled variant shows the platform name next to the icon", () => {
      const wrapper = mountLinks([facebook, telegram], { variant: "labeled" });

      const [fb, tg] = wrapper.findAll("a");
      expect(fb!.classes()).toContain("social-links__link--labeled");
      expect(fb!.text()).toBe("Facebook");
      expect(tg!.text()).toBe("Telegram");
    });
  });
});
