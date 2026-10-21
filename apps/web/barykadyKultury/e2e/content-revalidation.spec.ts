import { expect } from "@playwright/test";

import { test } from "./support/network-guard";
import { mockSupabaseRest } from "./support/mocks";

/**
 * T-042 S9 — stale-while-revalidate UX over mocks only.
 *
 * The reader must render the stored copy immediately, show only a non-blocking
 * banner when `/api/content-check` reports a newer Drive revision, and replace
 * the text only after the user activates "Show update". A second visit whose
 * check is throttled shows no banner. No real Supabase/Drive is contacted.
 */
const DOC_ID = "00000000-0000-4000-8000-0000000009a1";

function documentRows(text: string) {
  return [
    {
      id: DOC_ID,
      slug: "e2e-revalidate",
      status: "published",
      document_type: "regulations",
      language: null,
      publication_date: null,
      updated_at: "2030-05-01T00:00:00Z",
      organization_document_translations: [
        {
          locale: "en",
          title: "Revalidation fixture",
          description: null,
          body: null,
          body_ast: {
            kind: "document",
            blocks: [
              {
                kind: "paragraph",
                children: [{ kind: "text", value: text }]
              }
            ]
          },
          body_ast_version: 1
        }
      ]
    }
  ];
}

test.describe("content revalidation", () => {
  test("stale copy → banner → show update → new text", async ({ page }) => {
    const responses: Record<string, unknown> = {
      organization_documents: documentRows("Stored copy text"),
      content_assets: []
    };
    await mockSupabaseRest(page, { responses });
    await page.route("**/api/content-check*", async route => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ updateAvailable: true, jobId: "job-1" })
      });
    });

    await page.goto("/en/about/documents/e2e-revalidate");
    await expect(page.getByText("Stored copy text")).toBeVisible();
    await expect(page.getByText("An update is available.")).toBeVisible();

    // The background pipeline has written a newer stored copy by the time the
    // admin/user chooses to reveal it.
    responses.organization_documents = documentRows("Updated copy text");
    await page.getByRole("button", { name: "Show update" }).click();

    await expect(page.getByText("Updated copy text")).toBeVisible();
    await expect(page.getByText("Stored copy text")).toHaveCount(0);
  });

  test("a throttled second visit shows no update banner", async ({ page }) => {
    let checks = 0;
    await mockSupabaseRest(page, {
      responses: {
        organization_documents: documentRows("Stored copy text"),
        content_assets: []
      }
    });
    await page.route("**/api/content-check*", async route => {
      checks += 1;
      // The server throttle/backoff returns no update on the second call.
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ updateAvailable: false })
      });
    });

    await page.goto("/en/about/documents/e2e-revalidate");
    await expect(page.getByText("Stored copy text")).toBeVisible();
    await page.reload();
    await expect(page.getByText("Stored copy text")).toBeVisible();
    await expect(page.getByText("An update is available.")).toHaveCount(0);
    expect(checks).toBeGreaterThanOrEqual(2);
  });
});
