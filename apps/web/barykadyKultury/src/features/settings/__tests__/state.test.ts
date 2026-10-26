import { afterEach, describe, expect, it } from "vitest";

import { computed } from "vue";

import { SETTINGS_SENTINEL_KEY } from "../definition";

import {
  applyOrganizationSettings,
  organizationSettingsRows,
  resetOrganizationSettings,
  useOrganizationConfig
} from "../state";

/**
 * T-048 — the public settings state machine.
 *
 * Three modes matter at the public boundary:
 *   1. never provisioned (empty read) → static parity;
 *   2. provisioned but every fact hidden → nothing rendered (no resurrection);
 *   3. provisioned with visible rows → settings-driven rendering.
 */

afterEach(() => {
  resetOrganizationSettings();
});

function config(locale: "en" | "pl" | "uk" = "en") {
  return useOrganizationConfig(computed(() => locale));
}

describe("public organization settings state", () => {
  it("starts in static parity mode", () => {
    expect(organizationSettingsRows()).toEqual([]);
    expect(config().value.nip).toBe("7831961912");
    expect(config().value.socialLinks).toHaveLength(3);
  });

  it("accepts a successful empty read as 'not provisioned' (static parity)", () => {
    applyOrganizationSettings([]);

    expect(config().value.nip).toBe("7831961912");
    expect(config().value.socialLinks).toHaveLength(3);
  });

  it("treats the provisioning sentinel as authority even when facts are absent", () => {
    // Only the marker is visible: every editable fact is hidden.
    applyOrganizationSettings([
      {
        key: SETTINGS_SENTINEL_KEY,
        value: { en: "1" },
        visible: true,
        updated_by: null,
        updated_by_email: null,
        updated_at: null
      }
    ]);

    expect(config().value.name).toBe("");
    expect(config().value.nip).toBeNull();
    expect(config().value.socialLinks).toEqual([]);
  });

  it("can be forced authoritative for an empty set (defensive API)", () => {
    applyOrganizationSettings([], { authoritative: true });

    expect(config().value.nip).toBeNull();
  });

  it("reset returns to static parity", () => {
    applyOrganizationSettings([], { authoritative: true });
    resetOrganizationSettings();

    expect(config().value.name).toBe("Barykady Kultury");
  });
});
