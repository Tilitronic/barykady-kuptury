import type { SocialLink } from "@/config/organization";
import { organization } from "@/config/organization";
import { SUPPORTED_LOCALES, type Locale } from "@/features/i18n/locales";

/**
 * T-048 — the single definition of every organization fact the admin may edit.
 *
 * Design authority:
 *   * docs/architecture.md §6.1 — one `organization_settings` row per fact,
 *     per-locale value where the fact is textual, one global `visible` flag.
 *   * docs/tickets/T-048-org-settings-visibility.md — exact fact list (NIP,
 *     REGON, seat, paper mail, contact emails/phones, social links) and
 *     kind-based validation.
 *   * AGENTS.md rule 6 — defaults are the already verified static values in
 *     `config/organization.ts`; no new org fact is invented here. Contact and
 *     paper-mail defaults are empty (D-04 still open).
 *
 * Why the defaults live here instead of in the database seed alone:
 *   The public site must render identically when the settings table is empty
 *   (fresh install, early migration, E2E fixtures). The seed-parity test pins
 *   that equivalence. Once ANY row exists the defaults stop applying — an
 *   absent key then means "hidden/unpublished", which is what makes the
 *   visibility toggle honest (otherwise unchecking a box would resurrect the
 *   default value).
 */

/** Supported value kinds. Every non-plain kind has a localized error message. */
export type SettingKind = "plain" | "email" | "url" | "nip" | "regon";

/** The two settings tabs; entity tabs host existing editors instead. */
export type SettingGroup = "general" | "contacts";

/** A per-locale value map. Scalars use the canonical `en` entry. */
export type SettingValue = Partial<Record<Locale, string>>;

export interface SettingDefinition {
  /** Stable row key, also the audit identity. */
  readonly key: string;
  readonly group: SettingGroup;
  readonly kind: SettingKind;
  /** True when the admin edits en/pl/uk; false for scalars (canonical `en`). */
  readonly localized: boolean;
  /** i18n key for the field label. */
  readonly labelKey: string;
  /** Value used while no settings rows exist at all (seed parity). */
  readonly defaultValue: SettingValue;
  /** Social rows carry the platform so the public link list keeps its order. */
  readonly socialPlatform?: SocialLink["platform"];
}

/** Locale-complete default from one static organization fact. */
function localized(value: string): SettingValue {
  return Object.fromEntries(
    SUPPORTED_LOCALES.map(locale => [locale, value])
  ) as SettingValue;
}

function scalar(value: string): SettingValue {
  return { en: value };
}

/** Social platforms in the same order as the public icon list (D-05). */
export const SOCIAL_PLATFORMS = [
  "facebook",
  "instagram",
  "telegram",
  "youtube",
  "twitter",
  "linkedin"
] as const satisfies readonly SocialLink["platform"][];

function socialDefault(platform: SocialLink["platform"]): string {
  return (
    organization.socialLinks.find(link => link.platform === platform)?.url ?? ""
  );
}

/**
 * Canonical definition order: General fields first, then Contacts, with social
 * rows last. The admin form and the public resolver both iterate this array so
 * a new fact cannot silently skip one of them.
 */
export const SETTING_DEFINITIONS: readonly SettingDefinition[] = [
  {
    key: "org.name",
    group: "general",
    kind: "plain",
    localized: false,
    labelKey: "admin.settings.fields.name",
    defaultValue: scalar(organization.name)
  },
  {
    key: "org.seat",
    group: "general",
    kind: "plain",
    localized: false,
    labelKey: "admin.settings.fields.seat",
    defaultValue: scalar(organization.seat)
  },
  {
    key: "org.nip",
    group: "general",
    kind: "nip",
    localized: false,
    labelKey: "admin.settings.fields.nip",
    defaultValue: scalar(organization.nip)
  },
  {
    key: "org.regon",
    group: "general",
    kind: "regon",
    localized: false,
    labelKey: "admin.settings.fields.regon",
    defaultValue: scalar(organization.regon)
  },
  {
    key: "org.privacy_url",
    group: "general",
    kind: "url",
    localized: false,
    labelKey: "admin.settings.fields.privacyUrl",
    defaultValue: scalar(organization.privacyUrl)
  },
  {
    key: "contact.email",
    group: "contacts",
    kind: "email",
    localized: false,
    labelKey: "admin.settings.fields.email",
    defaultValue: scalar(organization.contact.email)
  },
  {
    key: "contact.phone",
    group: "contacts",
    kind: "plain",
    localized: false,
    labelKey: "admin.settings.fields.phone",
    defaultValue: scalar(organization.contact.phone)
  },
  {
    key: "contact.address",
    group: "contacts",
    kind: "plain",
    localized: true,
    labelKey: "admin.settings.fields.address",
    defaultValue: localized(organization.contact.address)
  },
  {
    key: "contact.office_hours",
    group: "contacts",
    kind: "plain",
    localized: true,
    labelKey: "admin.settings.fields.officeHours",
    defaultValue: localized(organization.contact.officeHours)
  },
  {
    key: "contact.paper_mail_address",
    group: "contacts",
    kind: "plain",
    localized: true,
    labelKey: "admin.settings.fields.paperMailAddress",
    defaultValue: localized("")
  },
  ...SOCIAL_PLATFORMS.map((platform): SettingDefinition => ({
    key: `social.${platform}`,
    group: "contacts",
    kind: "url",
    localized: false,
    labelKey: `admin.settings.fields.social.${platform}`,
    defaultValue: scalar(socialDefault(platform)),
    socialPlatform: platform
  }))
];

/** O(1) lookup used by validation and the settings form. */
export const SETTING_DEFINITION_BY_KEY: ReadonlyMap<string, SettingDefinition> =
  new Map(SETTING_DEFINITIONS.map(definition => [definition.key, definition]));

/** Definitions that belong to one settings tab. */
export function settingDefinitionsFor(
  group: SettingGroup
): readonly SettingDefinition[] {
  return SETTING_DEFINITIONS.filter(definition => definition.group === group);
}

/** Every known key, in canonical order (used by the audit/UI merge). */
export const SETTING_KEYS: readonly string[] = SETTING_DEFINITIONS.map(
  definition => definition.key
);

/**
 * Non-editable provisioning marker.
 *
 * The public projection returns only visible rows, so an empty result is
 * ambiguous between "this deployment never provisioned settings" (static
 * parity) and "every fact is hidden". This row is written by the seed and by
 * every `save_settings_v1` call and is never rendered or offered in the form;
 * its presence tells the resolver that the table is authoritative. It carries
 * no organization fact and therefore no privacy cost.
 */
export const SETTINGS_SENTINEL_KEY = "org.settings_initialized" as const;
