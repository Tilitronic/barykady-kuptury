import type { AdminScope } from "@/features/auth/adminClaim";

/**
 * T-048 — the tabbed admin surface policy (host, don't rewrite).
 *
 * Design authority:
 *   * docs/architecture.md §6.1 — `settings:write` is the General/Contacts
 *     scope; every entity tab reuses the existing fixed scope.
 *   * docs/tickets/T-048 — "guard hides tabs"; a direct URL to a denied tab is
 *     denied. Hiding (not disabling) is the D-42 UX pattern; the tab guard is
 *     convenience only, RLS/RPC enforce.
 *   * AdminLocaleTabs keyboard semantics are reused by the generic tab strip.
 */

export type SettingsTabId =
  | "general"
  | "contacts"
  | "team"
  | "documents"
  | "projects"
  | "events"
  | "publications";

export interface SettingsTabDefinition {
  readonly id: SettingsTabId;
  /** i18n key under `admin.settings.tabs.*`. */
  readonly labelKey: string;
  readonly scope: AdminScope;
  /** `settings` renders the org form; `entity` hosts the existing page. */
  readonly kind: "settings" | "entity";
  /** `data-testid` suffix for the tab button. */
  readonly testId: string;
}

/**
 * The seven ticket tabs in presentation order. Entity tabs host the shipped
 * page components unchanged (T-027…T-031); only the chrome is new.
 */
export const SETTINGS_TABS: readonly SettingsTabDefinition[] = [
  {
    id: "general",
    labelKey: "admin.settings.tabs.general",
    scope: "settings:write",
    kind: "settings",
    testId: "settings-tab-general"
  },
  {
    id: "contacts",
    labelKey: "admin.settings.tabs.contacts",
    scope: "settings:write",
    kind: "settings",
    testId: "settings-tab-contacts"
  },
  {
    id: "team",
    labelKey: "admin.settings.tabs.team",
    scope: "team:write",
    kind: "entity",
    testId: "settings-tab-team"
  },
  {
    id: "documents",
    labelKey: "admin.settings.tabs.documents",
    scope: "documents:write",
    kind: "entity",
    testId: "settings-tab-documents"
  },
  {
    id: "projects",
    labelKey: "admin.settings.tabs.projects",
    scope: "projects:write",
    kind: "entity",
    testId: "settings-tab-projects"
  },
  {
    id: "events",
    labelKey: "admin.settings.tabs.events",
    scope: "events:write",
    kind: "entity",
    testId: "settings-tab-events"
  },
  {
    id: "publications",
    labelKey: "admin.settings.tabs.publications",
    scope: "publications:write",
    kind: "entity",
    testId: "settings-tab-publications"
  }
];

const TAB_BY_ID: ReadonlyMap<string, SettingsTabDefinition> = new Map(
  SETTINGS_TABS.map(tab => [tab.id, tab])
);

/** Tabs the session may see, in canonical order. */
export function visibleSettingsTabs(
  capabilities: readonly AdminScope[]
): readonly SettingsTabDefinition[] {
  return SETTINGS_TABS.filter(tab => capabilities.includes(tab.scope));
}

export type SettingsTabResolution =
  | { readonly kind: "tab"; readonly tab: SettingsTabDefinition }
  | { readonly kind: "denied"; readonly tab: SettingsTabDefinition }
  | { readonly kind: "default"; readonly tab: SettingsTabDefinition }
  | { readonly kind: "none" };

/**
 * Resolves the `?tab=` parameter against the session's capabilities.
 *
 * A known but ungranted tab returns `denied` (the page renders an explicit
 * denial instead of redirecting, so the URL the editor followed is explained).
 * An unknown/absent parameter defaults to the first granted tab.
 */
export function resolveSettingsTab(
  requested: string | null | undefined,
  capabilities: readonly AdminScope[]
): SettingsTabResolution {
  const visible = visibleSettingsTabs(capabilities);
  const known = requested == null ? undefined : TAB_BY_ID.get(requested);

  if (known !== undefined) {
    if (capabilities.includes(known.scope)) {
      return { kind: "tab", tab: known };
    }
    // Only report a denial when the account may enter the surface at all;
    // a zero-scope session gets the plain "none" state.
    if (visible.length > 0) return { kind: "denied", tab: known };
    return { kind: "none" };
  }

  const first = visible[0];
  return first === undefined
    ? { kind: "none" }
    : { kind: "default", tab: first };
}
