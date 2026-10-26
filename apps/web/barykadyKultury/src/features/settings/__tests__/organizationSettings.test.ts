import { describe, expect, it } from "vitest";

import { organization } from "@/config/organization";

import {
  SETTING_DEFINITIONS,
  SETTING_DEFINITION_BY_KEY,
  type SettingDefinition
} from "../definition";
import {
  resolveOrganizationSettings,
  type OrganizationSettingsRow
} from "../resolve";
import { validateSettingValue } from "../validation";

/**
 * T-048 — organization settings contract.
 *
 * Design authority:
 *   * docs/architecture.md §6.1 — one row per fact, per-locale textual values,
 *     global `visible` flag, anonymous reads only for visible rows.
 *   * docs/tickets/T-048-org-settings-visibility.md — every listed fact is
 *     editable and toggleable, values are validated by kind, hidden facts are
 *     absent from public rendering, and a hidden row is indistinguishable from
 *     "not configured" at the public boundary.
 *   * AGENTS.md rule 6 — no invented org facts. Defaults are the already
 *     verified static configuration; new contact facts stay empty.
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

function def(key: string): SettingDefinition {
  const found = SETTING_DEFINITION_BY_KEY.get(key);
  if (!found) throw new Error(`unknown setting ${key}`);
  return found;
}

describe("setting definitions", () => {
  it("declares every key exactly once with a group and a kind", () => {
    const keys = SETTING_DEFINITIONS.map(definition => definition.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const definition of SETTING_DEFINITIONS) {
      expect(["general", "contacts"]).toContain(definition.group);
      expect(["plain", "email", "url", "nip", "regon"]).toContain(
        definition.kind
      );
      expect(definition.labelKey.startsWith("admin.settings.fields.")).toBe(
        true
      );
    }
  });

  it("covers the ticket facts: NIP, REGON, seat, paper mail, contacts, social", () => {
    const keys = new Set(SETTING_DEFINITIONS.map(definition => definition.key));

    for (const key of [
      "org.name",
      "org.seat",
      "org.nip",
      "org.regon",
      "org.privacy_url",
      "contact.email",
      "contact.phone",
      "contact.address",
      "contact.office_hours",
      "contact.paper_mail_address",
      "social.facebook",
      "social.instagram",
      "social.telegram",
      "social.youtube",
      "social.twitter",
      "social.linkedin"
    ]) {
      expect(keys.has(key), key).toBe(true);
    }
  });

  it("never allows credential-like keys in the public settings store", () => {
    for (const definition of SETTING_DEFINITIONS) {
      expect(definition.key).not.toMatch(
        /secret|token|password|credential|service_role|api_key/
      );
    }
  });
});

describe("validateSettingValue (kind-based, localized field errors)", () => {
  it("accepts the verified NIP checksum and rejects a malformed one", () => {
    expect(
      validateSettingValue(def("org.nip"), { en: "7831961912" })
    ).toBeNull();
    expect(validateSettingValue(def("org.nip"), { en: "1234567890" })).toBe(
      "nip"
    );
    expect(validateSettingValue(def("org.nip"), { en: "783196191" })).toBe(
      "nip"
    );
    expect(validateSettingValue(def("org.nip"), { en: "" })).toBeNull();
  });

  it("checks REGON length/checksum for 9 and 14 digit forms", () => {
    expect(
      validateSettingValue(def("org.regon"), { en: "545503070" })
    ).toBeNull();
    expect(validateSettingValue(def("org.regon"), { en: "54550307" })).toBe(
      "regon"
    );
  });

  it("accepts empty (not configured) and valid emails, rejects malformed", () => {
    expect(validateSettingValue(def("contact.email"), { en: "" })).toBeNull();
    expect(
      validateSettingValue(def("contact.email"), { en: "kontakt@example.test" })
    ).toBeNull();
    expect(
      validateSettingValue(def("contact.email"), { en: "not-an-email" })
    ).toBe("email");
    expect(validateSettingValue(def("contact.email"), { en: "a@b" })).toBe(
      "email"
    );
  });

  it("accepts absolute http(s) URLs and rejects relative/other schemes", () => {
    expect(
      validateSettingValue(def("social.facebook"), {
        en: "https://example.test/page"
      })
    ).toBeNull();
    expect(
      validateSettingValue(def("social.facebook"), { en: "/relative" })
    ).toBe("url");
    expect(
      validateSettingValue(def("social.facebook"), {
        en: "javascript:alert(1)"
      })
    ).toBe("url");
    expect(validateSettingValue(def("social.facebook"), { en: "" })).toBeNull();
  });

  it("allows plain text as-is", () => {
    expect(validateSettingValue(def("org.seat"), { en: "Poznań" })).toBeNull();
  });
});

describe("resolveOrganizationSettings — seed parity and visibility", () => {
  it("renders identically to the static configuration when no rows exist", () => {
    const resolved = resolveOrganizationSettings([], "en");

    expect(resolved.name).toBe(organization.name);
    expect(resolved.seat).toBe(organization.seat);
    expect(resolved.nip).toBe(organization.nip);
    expect(resolved.regon).toBe(organization.regon);
    expect(resolved.contact).toEqual({
      ...organization.contact,
      // T-048 adds a paper-mail line that the static config never carried.
      paperMailAddress: ""
    });
    expect(resolved.socialLinks).toEqual(organization.socialLinks);
    expect(resolved.privacyUrl).toBe("");
  });

  it("treats an authoritative empty result as everything hidden", () => {
    // After a successful public read, an empty visible set means every fact is
    // hidden — it must NOT resurrect the static defaults.
    const resolved = resolveOrganizationSettings([], "en", {
      allowDefaults: false
    });

    expect(resolved.name).toBe("");
    expect(resolved.nip).toBeNull();
    expect(resolved.socialLinks).toEqual([]);
  });

  it("drops a hidden fact instead of falling back to its default", () => {
    // Once ANY settings exist, an absent key means hidden/unpublished — never
    // the legacy default. Otherwise unchecking a box would resurrect the very
    // value it was meant to hide.
    const rows: OrganizationSettingsRow[] = [
      row("org.name", { en: "Barykady Kultury" }),
      row("org.nip", { en: "7831961912" }, false)
    ];

    const resolved = resolveOrganizationSettings(rows, "en");

    expect(resolved.name).toBe("Barykady Kultury");
    expect(resolved.nip).toBeNull();
    expect(resolved.regon).toBeNull();
    // Contact + social have no row in this partial set, so they are empty.
    expect(resolved.contact.email).toBe("");
    expect(resolved.socialLinks).toEqual([]);
  });

  it("keeps a visible fact and resolves localized values with an EN fallback", () => {
    const rows: OrganizationSettingsRow[] = [
      row("contact.email", { en: "kontakt@example.test" }),
      row("contact.address", {
        en: "Test Street 1",
        pl: "Ulica Testowa 1",
        uk: "Тестова 1"
      }),
      row("social.facebook", { en: "https://example.test/fb" })
    ];

    const pl = resolveOrganizationSettings(rows, "pl");
    expect(pl.contact.email).toBe("kontakt@example.test");
    expect(pl.contact.address).toBe("Ulica Testowa 1");
    expect(pl.contact.officeHours).toBe("");

    // Missing PL never falls through to a different fact.
    const rowsEnOnly: OrganizationSettingsRow[] = [
      row("contact.address", { en: "Test Street 1" })
    ];
    expect(resolveOrganizationSettings(rowsEnOnly, "uk").contact.address).toBe(
      "Test Street 1"
    );
  });

  it("omits social links with an empty URL even when marked visible", () => {
    const rows: OrganizationSettingsRow[] = [
      row("social.facebook", { en: "https://example.test/fb" }),
      row("social.instagram", { en: "" })
    ];

    const resolved = resolveOrganizationSettings(rows, "en");
    expect(resolved.socialLinks.map(link => link.platform)).toEqual([
      "facebook"
    ]);
  });

  it("treats a whitespace-only value as not configured", () => {
    const rows: OrganizationSettingsRow[] = [
      row("contact.email", { en: "   " }),
      row("org.nip", { en: "  " })
    ];

    const resolved = resolveOrganizationSettings(rows, "en");
    expect(resolved.contact.email).toBe("");
    expect(resolved.nip).toBeNull();
  });
});
