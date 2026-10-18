import { describe, expect, it } from "vitest";

import ContactPage from "@/pages/[locale]/contact.vue";
import { mountWithPlugins } from "@/test-utils/mount";

/**
 * Spec axis: docs/tickets/T-021-contact-page.md — empty state, no fabricated
 * channels, and the D-09 form guard.
 *
 * The shipped organization config carries no verified contact data (D-04), so
 * the default rendered state is the translated "not published yet" message with
 * in-page routes to About and Support.
 */

async function mountContact(locale: "en" | "pl" | "uk" = "en") {
  return mountWithPlugins(ContactPage, {
    locale,
    initialRoute: `/${locale}`
  });
}

describe("contact page", () => {
  it("renders exactly one h1 with the localized title", async () => {
    const wrapper = await mountContact("pl");

    expect(wrapper.findAll("h1")).toHaveLength(1);
    expect(wrapper.get("h1").text()).toBe("Kontakt");
  });

  it("shows the translated not-published state when no channel is configured", async () => {
    const wrapper = await mountContact("en");

    expect(wrapper.text()).toContain(
      "Contact details have not been published yet."
    );
  });

  it("routes to About and Support instead of inventing an email", async () => {
    const wrapper = await mountContact("en");
    const hrefs = wrapper.findAll("a").map(link => link.attributes("href"));

    expect(hrefs).toContain("/en/about");
    expect(hrefs).toContain("/en/support");
  });

  it("renders no address, email or phone when the config is empty", async () => {
    const wrapper = await mountContact("en");
    const html = wrapper.html();

    expect(html).not.toContain("<address");
    expect(html).not.toContain("mailto:");
    expect(html).not.toContain("tel:");
  });

  it("guard: ships no form while no delivery endpoint is configured (D-09)", async () => {
    const wrapper = await mountContact("en");

    // Tripwire: enabling a contact form requires a configured server-side
    // delivery endpoint (docs/architecture.md §7). If a form is ever added,
    // this guard must fail until that endpoint exists and the test is updated
    // deliberately — never ship a form that silently drops messages (D-09).
    expect(wrapper.html()).not.toContain("<form");
    expect(
      wrapper.findAll('button[type="submit"], input[type="submit"]')
    ).toHaveLength(0);
  });
});
