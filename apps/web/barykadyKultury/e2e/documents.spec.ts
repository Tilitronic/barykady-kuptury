import { expect, type Page } from "@playwright/test";

import { checkA11y } from "./support/a11y";
import { mockSupabaseRest } from "./support/mocks";
import { test } from "./support/network-guard";

/**
 * T-017 — Documents listing and in-app regulation reader (D-12).
 *
 * The listing links a text document to the reader; the reader defaults to the
 * active UI locale, names the source language when English stands in, and its
 * in-view switcher changes the text in place (URL slug stable) while disabling
 * locales without text.
 *
 * Bodies are short deterministic markers rather than the full regulation text
 * (the canonical, verbatim copy lives in `supabase/seed.sql`); Supabase REST is
 * intercepted so no journey touches real data (docs/TESTING.md §2).
 */

const REGULATIONS_TITLE = "Regulations of the Ordinary Association";
const REPORT_TITLE = "Annual Report";

const ORGANIZATION_DOCUMENTS_FIXTURE = [
  {
    id: "00000000-0000-4000-8000-000000000601",
    status: "published",
    document_type: "regulations",
    language: null,
    storage_path: null,
    mime_type: null,
    file_size_bytes: null,
    publication_date: null,
    sort_order: 1,
    published_at: "2026-01-05T12:00:00Z",
    updated_at: "2026-01-05T12:00:00Z",
    organization_document_translations: [
      {
        locale: "en",
        slug: "regulations",
        title: REGULATIONS_TITLE,
        description: null,
        body: "## § 1\n\nEN-REGULATION body."
      },
      {
        locale: "pl",
        slug: "regulamin",
        title: "Regulamin działalności stowarzyszenia zwykłego",
        description: null,
        body: "## § 1\n\nPL-REGULATION body."
      },
      {
        locale: "uk",
        slug: "rehlament",
        title: "Регламент діяльності звичайного товариства",
        description: null,
        body: "## § 1\n\nUK-REGULATION body."
      }
    ]
  },
  {
    id: "00000000-0000-4000-8000-000000000701",
    status: "published",
    document_type: "report",
    language: null,
    storage_path: null,
    mime_type: null,
    file_size_bytes: null,
    publication_date: "2026-02-01",
    sort_order: 2,
    published_at: "2026-02-01T12:00:00Z",
    updated_at: "2026-02-01T12:00:00Z",
    organization_document_translations: [
      {
        locale: "en",
        slug: "annual-report",
        title: REPORT_TITLE,
        description: null,
        body: "## Summary\n\nEN-REPORT body."
      },
      {
        locale: "pl",
        slug: "raport-roczny",
        title: "Raport roczny",
        description: null,
        body: null
      }
    ]
  }
];

async function gotoWithDocuments(page: Page): Promise<void> {
  await mockSupabaseRest(page, {
    responses: { organization_documents: ORGANIZATION_DOCUMENTS_FIXTURE }
  });
}

/** Fails on serious findings too, beyond the helper's critical-only default. */
async function expectNoSeriousViolations(page: Page): Promise<void> {
  const results = await checkA11y(page);
  const serious = results.violations.filter(
    violation => violation.impact === "serious"
  );

  expect(
    serious,
    `axe found ${serious.length} serious violation(s): ${serious
      .map(violation => violation.id)
      .join(", ")}`
  ).toHaveLength(0);
}

test.describe("documents reader", () => {
  test("lists documents and opens the reader from the listing", async ({
    page
  }) => {
    await gotoWithDocuments(page);
    await page.goto("/en/about/documents");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Documents"
    );
    await expect(page.getByText("Regulations", { exact: true })).toBeVisible();

    await page.getByRole("link", { name: REGULATIONS_TITLE }).click();

    await expect(page).toHaveURL(/\/en\/about\/documents\/regulations$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      REGULATIONS_TITLE
    );
    await expect(page.getByText("EN-REGULATION body.")).toBeVisible();

    await expectNoSeriousViolations(page);
  });

  test("defaults to the active UI locale and marks the content language", async ({
    page
  }) => {
    await gotoWithDocuments(page);
    await page.goto("/pl/about/documents/regulamin");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Regulamin działalności stowarzyszenia zwykłego"
    );
    await expect(page.getByText("PL-REGULATION body.")).toBeVisible();

    const content = page.locator(".localized-rich-text");
    await expect(content).toHaveAttribute("lang", "pl");

    await expectNoSeriousViolations(page);
  });

  test("switches language in place while the URL slug stays stable", async ({
    page
  }) => {
    await gotoWithDocuments(page);
    await page.goto("/pl/about/documents/regulamin");

    await page.getByRole("button", { name: "English", exact: true }).click();

    await expect(page.getByText("EN-REGULATION body.")).toBeVisible();
    await expect(page.getByText("PL-REGULATION body.")).toHaveCount(0);
    await expect(page.locator(".localized-rich-text")).toHaveAttribute(
      "lang",
      "en"
    );
    await expect(page).toHaveURL(/\/pl\/about\/documents\/regulamin$/);
  });

  test("is keyboard operable", async ({ page }) => {
    await gotoWithDocuments(page);
    await page.goto("/pl/about/documents/regulamin");

    await page.getByRole("button", { name: "English", exact: true }).focus();
    await page.keyboard.press("Enter");

    await expect(page.getByText("EN-REGULATION body.")).toBeVisible();
  });

  test("falls back to English with a note and disables unavailable locales", async ({
    page
  }) => {
    await gotoWithDocuments(page);
    await page.goto("/pl/about/documents/raport-roczny");

    await expect(page.getByText("EN-REPORT body.")).toBeVisible();
    await expect(page.getByText("po angielsku")).toBeVisible();
    await expect(page.locator(".localized-rich-text")).toHaveAttribute(
      "lang",
      "en"
    );

    // UK has no translation at all; PL has no body — both are non-selectable.
    await expect(
      page.getByRole("button", { name: "Українська", exact: true })
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Polski", exact: true })
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "English", exact: true })
    ).toBeEnabled();

    await expectNoSeriousViolations(page);
  });
});
