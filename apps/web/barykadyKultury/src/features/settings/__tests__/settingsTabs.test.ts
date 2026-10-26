import { describe, expect, it } from "vitest";

import type { AdminScope } from "@/features/auth/adminClaim";

import {
  SETTINGS_TABS,
  resolveSettingsTab,
  visibleSettingsTabs
} from "../settingsTabs";

/**
 * T-048 — per-tab rights for the tabbed admin surface.
 *
 * The tab strip hides denied tabs (hiding, not disabling — the D-42/D-21
 * pattern) and a direct `?tab=` URL for a denied tab resolves to an explicit
 * denial state. Entity tabs reuse the existing fixed scopes; General and
 * Contacts use the new `settings:write`.
 */

const ALL: readonly AdminScope[] = [
  "settings:write",
  "pages:write",
  "projects:write",
  "publications:write",
  "documents:write",
  "team:write",
  "events:write",
  "media:write",
  "importer"
];

describe("SETTINGS_TABS", () => {
  it("declares the seven ticket tabs in presentation order", () => {
    expect(SETTINGS_TABS.map(tab => tab.id)).toEqual([
      "general",
      "contacts",
      "team",
      "documents",
      "projects",
      "events",
      "publications"
    ]);
  });

  it("maps General and Contacts to settings:write and entities to their scopes", () => {
    expect(
      Object.fromEntries(SETTINGS_TABS.map(tab => [tab.id, tab.scope]))
    ).toEqual({
      general: "settings:write",
      contacts: "settings:write",
      team: "team:write",
      documents: "documents:write",
      projects: "projects:write",
      events: "events:write",
      publications: "publications:write"
    });
  });
});

describe("visibleSettingsTabs", () => {
  it("shows every tab to a root session (all capabilities)", () => {
    expect(visibleSettingsTabs(ALL)).toHaveLength(SETTINGS_TABS.length);
  });

  it("shows only granted tabs to a scoped editor", () => {
    expect(
      visibleSettingsTabs(["projects:write", "events:write"]).map(tab => tab.id)
    ).toEqual(["projects", "events"]);
  });

  it("shows no tabs to a zero-scope account", () => {
    expect(visibleSettingsTabs([])).toEqual([]);
  });
});

describe("resolveSettingsTab", () => {
  it("defaults to the first granted tab", () => {
    expect(resolveSettingsTab(undefined, ["projects:write"])).toEqual({
      kind: "default",
      tab: expect.objectContaining({ id: "projects" })
    });
    expect(resolveSettingsTab("unknown", ALL)).toEqual({
      kind: "default",
      tab: expect.objectContaining({ id: "general" })
    });
  });

  it("accepts a granted tab", () => {
    expect(resolveSettingsTab("contacts", ["settings:write"])).toEqual({
      kind: "tab",
      tab: expect.objectContaining({ id: "contacts" })
    });
  });

  it("reports an explicit denial for a known but ungranted tab", () => {
    expect(resolveSettingsTab("documents", ["projects:write"])).toEqual({
      kind: "denied",
      tab: expect.objectContaining({ id: "documents" })
    });
  });

  it("reports none when the account has no settings capabilities at all", () => {
    expect(resolveSettingsTab("general", [])).toEqual({ kind: "none" });
  });
});
