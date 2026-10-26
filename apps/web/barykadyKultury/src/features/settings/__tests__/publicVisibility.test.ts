import { afterEach, describe, expect, it } from "vitest";

import AppFooter from "@/components/navigation/AppFooter.vue";
import { mountWithPlugins } from "@/test-utils/mount";
import ContactPage from "@/pages/[locale]/contact.vue";

import { applyOrganizationSettings, resetOrganizationSettings } from "../state";
import type { OrganizationSettingsRow } from "../resolve";

/**
 * T-048 — visibility plumbing at the public boundary.
 *
 * A hidden fact must render nothing (ticket acceptance criterion 2). The
 * resolution rule is shared by the footer, header and contact page, so these
 * component tests prove the wiring rather than re-testing each markup branch.
 */

function row(
  key: string,
  value: Record<string, string>,
  visible = true
): OrganizationSettingsRow {
  return {
    key,
    value,
    visible,
    updated_by: null,
    updated_by_email: null,
    updated_at: null
  };
}

const FULL: OrganizationSettingsRow[] = [
  row("org.name", { en: "Barykady Kultury" }),
  row("org.seat", { en: "Poznań" }),
  row("org.nip", { en: "7831961912" }),
  row("org.regon", { en: "545503070" }),
  row("contact.email", { en: "kontakt@example.test" }),
  row("contact.phone", { en: "+48 000 000 000" }),
  row("contact.address", { en: "Test Street 1, 00-000 Poznań" }),
  row("contact.office_hours", { en: "Mon 10:00–14:00" }),
  row("contact.paper_mail_address", { en: "PO Box 1, 00-000 Poznań" }),
  row("social.facebook", { en: "https://example.test/facebook" }),
  row("social.instagram", { en: "https://example.test/instagram" })
];

afterEach(() => {
  resetOrganizationSettings();
});

describe("footer visibility", () => {
  it("renders every visible fact in the existing shape", async () => {
    applyOrganizationSettings(FULL);

    const wrapper = await mountWithPlugins(AppFooter, {
      initialRoute: "/en/contact"
    });

    expect(wrapper.text()).toContain("NIP");
    expect(wrapper.text()).toContain("7831961912");
    expect(wrapper.text()).toContain("REGON");
    expect(wrapper.text()).toContain("545503070");
    expect(wrapper.text()).toContain("kontakt@example.test");
    expect(
      wrapper.find('a[href="https://example.test/facebook"]').exists()
    ).toBe(true);
  });

  it("renders nothing for hidden NIP, REGON, contact and social facts", async () => {
    applyOrganizationSettings(
      FULL.map(entry =>
        entry.key === "org.nip" ||
        entry.key === "org.regon" ||
        entry.key === "contact.email" ||
        entry.key === "social.facebook"
          ? { ...entry, visible: false }
          : entry
      )
    );

    const wrapper = await mountWithPlugins(AppFooter, {
      initialRoute: "/en/contact"
    });

    expect(wrapper.text()).not.toContain("7831961912");
    expect(wrapper.text()).not.toContain("545503070");
    expect(wrapper.text()).not.toContain("NIP");
    expect(wrapper.text()).not.toContain("REGON");
    expect(wrapper.text()).not.toContain("kontakt@example.test");
    expect(
      wrapper.find('a[href="https://example.test/facebook"]').exists()
    ).toBe(false);
    // The remaining visible social link still renders.
    expect(
      wrapper.find('a[href="https://example.test/instagram"]').exists()
    ).toBe(true);
  });
});

describe("contact page visibility", () => {
  it("shows visible channels and the paper-mail/address lines", async () => {
    applyOrganizationSettings(FULL);

    const wrapper = await mountWithPlugins(ContactPage, {
      initialRoute: "/en/contact"
    });

    expect(wrapper.text()).toContain("kontakt@example.test");
    expect(wrapper.text()).toContain("Test Street 1");
    expect(wrapper.text()).toContain("PO Box 1");
  });

  it("falls back to the not-configured state when every contact fact is hidden", async () => {
    applyOrganizationSettings(
      FULL.map(entry =>
        entry.key.startsWith("contact.") ? { ...entry, visible: false } : entry
      )
    );

    const wrapper = await mountWithPlugins(ContactPage, {
      initialRoute: "/en/contact"
    });

    expect(wrapper.text()).not.toContain("kontakt@example.test");
    expect(wrapper.text()).not.toContain("Test Street 1");
    expect(wrapper.text()).toContain(
      "Contact details have not been published yet."
    );
  });
});
