import { describe, expect, it } from "vitest";

import {
  hasSupportActions,
  resolveSupportActions
} from "@/features/support/resolveSupportActions";
import type { SupportOptions } from "@/config/support";

/**
 * Spec axis: docs/tickets/T-022-support-page.md — the option matrix.
 * Only configured options resolve to actions; whitespace-only values are
 * "not configured"; the order is fixed (donation, bank transfer,
 * volunteering) so the first action is deterministic across locales, and an
 * empty config resolves to nothing (the page then shows the empty state).
 */

function options(overrides: Partial<SupportOptions> = {}): SupportOptions {
  return {
    donationUrl: "",
    donationLabel: "",
    bankTransfer: { accountNumber: "", recipient: "", paymentTitle: "" },
    volunteeringEmail: "",
    ...overrides
  };
}

describe("resolveSupportActions", () => {
  it("resolves nothing for the shipped (empty) config", () => {
    expect(resolveSupportActions(options())).toEqual([]);
    expect(hasSupportActions(options())).toBe(false);
  });

  it("resolves a configured donation link alone", () => {
    const actions = resolveSupportActions(
      options({ donationUrl: "https://help.example.org/barykady" })
    );

    expect(actions).toEqual([
      {
        kind: "donation",
        url: "https://help.example.org/barykady",
        label: ""
      }
    ]);
  });

  it("carries the configured donation label when supplied", () => {
    const actions = resolveSupportActions(
      options({
        donationUrl: "https://help.example.org",
        donationLabel: "Help on the NGO portal"
      })
    );

    expect(actions[0]).toMatchObject({ label: "Help on the NGO portal" });
  });

  it("resolves the bank block only when the account number exists", () => {
    const withoutAccount = resolveSupportActions(
      options({
        bankTransfer: {
          accountNumber: "  ",
          recipient: "Barykady Kultury",
          paymentTitle: "Darowizna"
        }
      })
    );
    expect(withoutAccount).toEqual([]);

    const withAccount = resolveSupportActions(
      options({
        bankTransfer: {
          accountNumber: "12 3456 7890 1234 5678 9012",
          recipient: "Barykady Kultury",
          paymentTitle: "Darowizna na cele statutowe"
        }
      })
    );
    expect(withAccount).toEqual([
      {
        kind: "bank",
        accountNumber: "12 3456 7890 1234 5678 9012",
        recipient: "Barykady Kultury",
        paymentTitle: "Darowizna na cele statutowe"
      }
    ]);
  });

  it("resolves the volunteering contact alone", () => {
    const actions = resolveSupportActions(
      options({ volunteeringEmail: "volunteer@example.org" })
    );

    expect(actions).toEqual([
      { kind: "volunteering", email: "volunteer@example.org" }
    ]);
  });

  it("orders every configured option donation → bank → volunteering", () => {
    const actions = resolveSupportActions(
      options({
        volunteeringEmail: "volunteer@example.org",
        donationUrl: "https://help.example.org",
        bankTransfer: {
          accountNumber: "123",
          recipient: "BK",
          paymentTitle: "t"
        }
      })
    );

    expect(actions.map(action => action.kind)).toEqual([
      "donation",
      "bank",
      "volunteering"
    ]);
    expect(hasSupportActions(options({ donationUrl: "https://x.org" }))).toBe(
      true
    );
  });
});
