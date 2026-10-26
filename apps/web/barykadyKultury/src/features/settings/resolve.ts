import { organization } from "@/config/organization";
import type { ContactDetails, SocialLink } from "@/config/organization";
import type { Locale } from "@/features/i18n/locales";

import {
  SETTING_DEFINITIONS,
  type SettingDefinition,
  type SettingValue
} from "./definition";

/**
 * T-048 — resolve settings rows into the public organization shape.
 *
 * Design authority:
 *   * docs/architecture.md §6.1 visibility rule — a hidden row must render
 *     nothing; an anonymous payload never contains hidden rows.
 *   * docs/tickets/T-048 — "current hardcoded org facts become settings-driven;
 *     keep rendering identical when all flags are visible".
 *
 * Why "any row exists" disables the static defaults:
 *   The public API deliberately returns only visible rows, so an absent key is
 *   ambiguous between "never configured" and "hidden". The table is
 *   all-or-nothing for that reason: no rows at all is the legacy/static mode
 *   (seed parity), while one or more rows means the settings store is the
 *   authority and every absent key is treated as hidden/unpublished. The admin
 *   form always saves the complete definition set, so a real installation
 *   moves to the authoritative mode on its first save.
 */

/** One row of the `organization_settings` table as read by the app. */
export interface OrganizationSettingsRow {
  readonly key: string;
  readonly value: SettingValue;
  readonly visible: boolean;
  readonly updated_by: string | null;
  readonly updated_by_email: string | null;
  readonly updated_at: string | null;
}

/** Contact facts plus the paper-mail line (T-048). */
export interface ResolvedContactDetails extends ContactDetails {
  /** Postal correspondence address; differs from the seat/office address. */
  readonly paperMailAddress: string;
}

/** The public-safe organization shape. `null` means hidden/unconfigured. */
export interface ResolvedOrganization {
  readonly name: string;
  readonly seat: string;
  readonly nip: string | null;
  readonly regon: string | null;
  readonly privacyUrl: string;
  readonly contact: ResolvedContactDetails;
  readonly socialLinks: readonly SocialLink[];
}

const EMPTY_CONTACT: ResolvedContactDetails = {
  email: "",
  phone: "",
  address: "",
  officeHours: "",
  paperMailAddress: ""
};

function localizedFromDefinition(
  definition: SettingDefinition,
  locale: Locale
): string {
  const exact = definition.defaultValue[locale];
  return exact ?? definition.defaultValue.en ?? "";
}

/** True when at least one contact field (including paper mail) is set. */
export function hasResolvedContact(
  details: ContactDetails & { readonly paperMailAddress?: string }
): boolean {
  return (
    details.email.trim().length > 0 ||
    details.phone.trim().length > 0 ||
    details.address.trim().length > 0 ||
    details.officeHours.trim().length > 0 ||
    (details.paperMailAddress ?? "").trim().length > 0
  );
}

export interface ResolveOptions {
  /**
   * Force static defaults on/off. The public state passes `false` once a
   * settings read has succeeded — even an empty visible result is
   * authoritative ("everything is hidden"), so defaults must not resurrect.
   * Omitted = legacy inference (`rows.length === 0`), which keeps the unit
   * contract and seed parity simple.
   */
  readonly allowDefaults?: boolean;
}

/**
 * Resolves rows for one UI locale.
 *
 * With no rows (and defaults allowed) the static parity shape is returned.
 * Otherwise only rows that exist AND are visible contribute; missing keys are
 * intentionally empty.
 */
export function resolveOrganizationSettings(
  rows: readonly OrganizationSettingsRow[],
  locale: Locale,
  options: ResolveOptions = {}
): ResolvedOrganization {
  const byKey = new Map(rows.map(row => [row.key, row]));
  const useDefaults = options.allowDefaults ?? rows.length === 0;

  function read(definition: SettingDefinition): string {
    const row = byKey.get(definition.key);
    if (row !== undefined) {
      if (!row.visible) return "";
      const raw = definition.localized
        ? (row.value[locale] ?? row.value.en)
        : row.value.en;
      return typeof raw === "string" ? raw.trim() : "";
    }
    if (!useDefaults) return "";
    return localizedFromDefinition(definition, locale).trim();
  }

  function definition(key: string): SettingDefinition {
    const found = SETTING_DEFINITIONS.find(entry => entry.key === key);
    if (!found) throw new Error(`unknown organization setting ${key}`);
    return found;
  }

  const nip = read(definition("org.nip"));
  const regon = read(definition("org.regon"));

  const socialLinks: SocialLink[] = [];
  for (const setting of SETTING_DEFINITIONS) {
    if (setting.socialPlatform === undefined) continue;
    const url = read(setting);
    if (url === "") continue;
    socialLinks.push({
      platform: setting.socialPlatform,
      // The public list localizes the platform name; this label is the
      // fallback used if a catalogue key is ever missing (T-043 contract).
      // Reuse the verified static label so seed parity is exact.
      label:
        organization.socialLinks.find(
          link => link.platform === setting.socialPlatform
        )?.label ?? setting.socialPlatform,
      url
    });
  }

  return {
    name: read(definition("org.name")),
    seat: read(definition("org.seat")),
    nip: nip === "" ? null : nip,
    regon: regon === "" ? null : regon,
    privacyUrl: read(definition("org.privacy_url")),
    contact: {
      email: read(definition("contact.email")),
      phone: read(definition("contact.phone")),
      address: read(definition("contact.address")),
      officeHours: read(definition("contact.office_hours")),
      paperMailAddress: read(definition("contact.paper_mail_address"))
    },
    socialLinks
  };
}

/**
 * The static parity shape used when no settings exist. Exposed for the
 * seed-parity test and for components that need a non-null fallback.
 */
export function staticOrganizationFor(locale: Locale): ResolvedOrganization {
  return resolveOrganizationSettings([], locale);
}

/** Empty resolved shape for a test or a future "everything hidden" state. */
export const EMPTY_RESOLVED_ORGANIZATION: ResolvedOrganization = {
  name: "",
  seat: "",
  nip: null,
  regon: null,
  privacyUrl: "",
  contact: EMPTY_CONTACT,
  socialLinks: []
};
