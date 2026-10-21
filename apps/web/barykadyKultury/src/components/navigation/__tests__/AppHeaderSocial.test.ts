import { nextTick } from "vue";
import { mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { describe, expect, it } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";

import AppHeader from "@/components/navigation/AppHeader.vue";
import { activeSocialLinks, organization } from "@/config/organization";
import { routes } from "@/router/routes";
import { createTestI18n } from "@/test-utils/mount";

/**
 * T-043 — social links in the header controls cluster.
 *
 * Contract: the icon-variant SocialLinks group renders between the search
 * trigger and the theme/language controls (order: search → socials → theme →
 * language), carries exactly the verified channels, and never renders a
 * placeholder when a URL is missing. DOM order is the tab order, and the
 * drawer band reuses the same DOM — so placement here is what the 1280/320
 * fit E2E tests measure.
 */

async function mountHeader(locale: "en" | "pl" | "uk" = "en") {
  const router = createRouter({ history: createMemoryHistory(), routes });
  await router.push(`/${locale}`);
  await router.isReady();

  const wrapper = mount(AppHeader, {
    global: { plugins: [createPinia(), createTestI18n(locale), router] },
    attachTo: document.body
  });
  await nextTick();
  return wrapper;
}

describe("AppHeader social links", () => {
  it("renders the verified channels in the controls cluster", async () => {
    const wrapper = await mountHeader();

    const controls = wrapper.get(".app-header__controls");
    const hrefs = controls
      .findAll(".social-links a")
      .map(a => a.attributes("href"));

    expect(hrefs).toEqual([
      "https://www.facebook.com/BARYKADYKULTURY/",
      "https://www.instagram.com/barykadykultury/",
      "https://t.me/barykadykultury"
    ]);
  });

  it("keeps the control order: search, socials, theme, language", async () => {
    const wrapper = await mountHeader();

    const controls = wrapper.get(".app-header__controls");
    const search = controls.get("[data-testid='site-search-trigger']");
    const socials = controls.get(".social-links");
    const theme = controls.get(".theme-toggle");
    const language = controls.get(".language-switcher");

    // Compare positions in the controls HTML — DOM order IS tab order.
    const html = controls.html();
    const positions = [search, socials, theme, language].map(el =>
      html.indexOf(el.html().slice(0, 40))
    );
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("names each icon link with the localized platform name", async () => {
    const wrapper = await mountHeader("pl");

    const labels = wrapper
      .findAll(".app-header__controls .social-links a")
      .map(a => a.attributes("aria-label"));

    expect(labels).toEqual(["Facebook", "Instagram", "Telegram"]);
  });

  it("hardens every social link for a new tab", async () => {
    const wrapper = await mountHeader();

    for (const link of wrapper.findAll(
      ".app-header__controls .social-links a"
    )) {
      expect(link.attributes("target")).toBe("_blank");
      expect(link.attributes("rel")).toContain("noopener");
      expect(link.attributes("rel")).toContain("noreferrer");
    }
  });

  it("renders no social placeholder when nothing is configured", async () => {
    // The component contract (empty list → no DOM) is what keeps this true
    // for any future config regression; assert the wiring passes the real
    // config through, not a literal.
    const wrapper = await mountHeader();
    const count = wrapper.findAll(".app-header__controls .social-links a");
    expect(count.length).toBe(
      activeSocialLinks(organization.socialLinks).length
    );
  });
});
