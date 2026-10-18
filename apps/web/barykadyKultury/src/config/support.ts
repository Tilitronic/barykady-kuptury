/**
 * Support configuration — approved ways to support the organization.
 *
 * Design constraint: D-06 (support/donation destinations — OPEN). Until the
 * project owner supplies verified destinations, every field is empty and the
 * Support page shows its translated empty state — no invented account
 * numbers, URLs or contact addresses (docs/PRODUCT_REQUIREMENTS.md §4, §7;
 * docs/architecture.md §7: link to verified destinations only).
 *
 * This page never collects payment data: there is no form, no iframe and no
 * payment SDK anywhere in the Support route; donations happen on the
 * destination's own page or via a bank transfer.
 */

/**
 * Bank-transfer details, rendered as selectable labelled text.
 * The account number anchors the block: without it the block is not
 * configured, even if recipient/title were filled in.
 */
export interface BankTransferDetails {
  accountNumber: string;
  recipient: string;
  paymentTitle: string;
}

/** Complete support-options shape — every field optional by convention. */
export interface SupportOptions {
  /** Verified external donation destination (empty = not configured). */
  donationUrl: string;
  /**
   * Optional destination name for the link text. Empty falls back to the
   * generic localized label — the UI never invents a destination name.
   */
  donationLabel: string;
  /** Bank-transfer details (see {@link BankTransferDetails}). */
  bankTransfer: BankTransferDetails;
  /** Volunteering contact email; rendered as a `mailto:` action. */
  volunteeringEmail: string;
}

/**
 * The live support configuration.
 *
 * D-06 OPEN: intentionally empty — the Support page renders its translated
 * empty state until the project owner supplies verified values here.
 */
export const supportOptions: SupportOptions = {
  donationUrl: "",
  donationLabel: "",
  bankTransfer: {
    accountNumber: "",
    recipient: "",
    paymentTitle: ""
  },
  volunteeringEmail: ""
};
