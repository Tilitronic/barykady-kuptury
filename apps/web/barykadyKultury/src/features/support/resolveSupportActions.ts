import type { SupportOptions } from "@/config/support";

/**
 * Support-option resolution (T-022).
 *
 * Pure, like the T-021 contact helpers: the option matrix (each single
 * option, combinations, none) is provable without mounting anything. A value
 * is "configured" only when it carries non-whitespace content; the order is
 * fixed — donation, bank transfer, volunteering — so the first (primary)
 * action is deterministic and locale-independent. Monetary support leads
 * because the PRD names it first (§4 Support); volunteering is last as the
 * slowest-commitment option.
 */

export type SupportAction =
  | { readonly kind: "donation"; readonly url: string; readonly label: string }
  | {
      readonly kind: "bank";
      readonly accountNumber: string;
      readonly recipient: string;
      readonly paymentTitle: string;
    }
  | { readonly kind: "volunteering"; readonly email: string };

function isFilled(value: string): boolean {
  return value.trim().length > 0;
}

export function resolveSupportActions(
  options: SupportOptions
): SupportAction[] {
  const actions: SupportAction[] = [];

  if (isFilled(options.donationUrl)) {
    actions.push({
      kind: "donation",
      url: options.donationUrl.trim(),
      label: options.donationLabel.trim()
    });
  }

  // The account number anchors the bank block; recipient/title without an
  // account would be an unusable instruction, so the block stays hidden.
  if (isFilled(options.bankTransfer.accountNumber)) {
    actions.push({
      kind: "bank",
      accountNumber: options.bankTransfer.accountNumber.trim(),
      recipient: options.bankTransfer.recipient.trim(),
      paymentTitle: options.bankTransfer.paymentTitle.trim()
    });
  }

  if (isFilled(options.volunteeringEmail)) {
    actions.push({
      kind: "volunteering",
      email: options.volunteeringEmail.trim()
    });
  }

  return actions;
}

/** True when at least one support option is configured. */
export function hasSupportActions(options: SupportOptions): boolean {
  return resolveSupportActions(options).length > 0;
}
