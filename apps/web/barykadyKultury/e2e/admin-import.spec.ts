import { expect, type Page } from "@playwright/test";

import { test } from "./support/network-guard";
import {
  ADMIN_AUTH_USER,
  mockImportPipeline,
  mockSupabaseAuth
} from "./support/mocks";

/**
 * T-041/T-042 review gate — Google import journeys.
 *
 * D-41 makes the only exposed provider Google Docs, authenticated per admin and
 * constrained to the shared NGO folder. The pipeline below is entirely mocked:
 * no Google token exists in the build, no Drive request leaves the browser, and
 * a failed job can never replace the published copy.
 */
const DOCUMENT_ID = "00000000-0000-4000-8000-000000000b01";

function documentRow(text: string, allowOriginalDownload = false) {
  return {
    id: DOCUMENT_ID,
    slug: "admin-import-fixture",
    status: "published",
    document_type: "regulations",
    language: null,
    publication_date: null,
    updated_at: "2030-05-01T00:00:00Z",
    allow_original_download: allowOriginalDownload,
    source_synced_at: "2030-05-01T00:00:00Z",
    organization_document_translations: [
      {
        locale: "en",
        title: "Admin import fixture",
        description: null,
        body: null,
        body_ast: {
          kind: "document",
          blocks: [
            { kind: "paragraph", children: [{ kind: "text", value: text }] }
          ]
        },
        body_ast_version: 1
      }
    ]
  };
}

async function signIn(page: Page): Promise<void> {
  await page.goto("/en/admin/sign-in");
  await page.getByLabel("Email").fill("admin@demo.local");
  await page.getByLabel("Password").fill("any-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/en\/admin$/);
}

/**
 * Deterministic Google Picker stub. The real `api.js` is never fetched; the
 * page still exercises its loader, OAuth-token handoff, folder view and
 * callback wiring. The stub picks one deterministic Doc.
 */
const PICKER_STUB = `
(function () {
  window.gapi = { load: function (_name, callback) { callback(); } };
  function DocsView() {
    return {
      setParent: function () { return this; },
      setIncludeFolders: function () { return this; },
      setSelectFolderEnabled: function () { return this; },
      setMimeTypes: function () { return this; }
    };
  }
  function PickerBuilder() {
    var callback = null;
    var builder = {
      addView: function () { return builder; },
      setOAuthToken: function () { return builder; },
      setDeveloperKey: function () { return builder; },
      setAppId: function () { return builder; },
      setCallback: function (value) { callback = value; return builder; },
      build: function () {
        return {
          setVisible: function () {
            setTimeout(function () {
              callback({
                action: "picked",
                docs: [{ id: "picked-drive-1", name: "Picked Doc" }]
              });
            }, 0);
          }
        };
      }
    };
    return builder;
  }
  window.google = {
    picker: {
      ViewId: { DOCS: "docs" },
      Action: { PICKED: "picked", CANCEL: "cancel" },
      Feature: { NAV_HIDDEN: "nav-hidden" },
      DocsView: DocsView,
      PickerBuilder: PickerBuilder
    }
  };
})();
`;

async function mockGooglePickerScript(page: Page): Promise<void> {
  await page.route("https://apis.google.com/js/api.js", async route => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: PICKER_STUB
    });
  });
}

async function fillImportForm(page: Page): Promise<void> {
  await page.locator("input[data-testid='import-title']").fill("Statute");
  await page.locator("input[data-testid='import-slug']").fill("statute");
  await page
    .locator("input[data-testid='import-google-id']")
    .fill("https://docs.google.com/document/d/drive-1/edit");
}

test.describe("Google import", () => {
  test("starts a job and shows the successful diff", async ({ page }) => {
    await mockSupabaseAuth(page, { user: ADMIN_AUTH_USER });
    await mockImportPipeline(page, {
      documents: [documentRow("Published copy text")],
      summary: {
        previousBlocks: 1,
        nextBlocks: 2,
        previousHeadings: ["Old"],
        nextHeadings: ["New"],
        addedHeadings: ["New"],
        removedHeadings: ["Old"],
        imageCount: 0,
        tableCount: 0
      },
      entityId: DOCUMENT_ID
    });

    await signIn(page);
    await page.goto("/en/admin/import");
    await expect(page.getByTestId("import-google-connection")).toContainText(
      "admin@demo.local"
    );

    await fillImportForm(page);
    await page.getByTestId("import-apply").click();

    await expect(page.getByTestId("import-status")).toHaveText(
      "Sync complete."
    );
    await expect(page.getByText("Change summary")).toBeVisible();
    await expect(page.getByText("Added: New")).toBeVisible();
    await expect(page.getByText("Sync now")).toBeVisible();
  });

  test("uses the Google Picker as the primary selection path", async ({
    page
  }) => {
    await mockSupabaseAuth(page, { user: ADMIN_AUTH_USER });
    await mockImportPipeline(page, {
      documents: [documentRow("Published copy text")],
      summary: {
        previousBlocks: 1,
        nextBlocks: 2,
        previousHeadings: ["Old"],
        nextHeadings: ["New"],
        addedHeadings: ["New"],
        removedHeadings: ["Old"],
        imageCount: 0,
        tableCount: 0
      },
      entityId: DOCUMENT_ID
    });
    await mockGooglePickerScript(page);

    await signIn(page);
    await page.goto("/en/admin/import");
    await page.getByTestId("import-picker").click();
    await expect(
      page.locator("input[data-testid='import-google-id']")
    ).toHaveValue("picked-drive-1");
    await expect(page.getByTestId("import-status")).toContainText(
      "Selected “Picked Doc”"
    );

    await page
      .locator("input[data-testid='import-title']")
      .fill("Picked Statute");
    await page
      .locator("input[data-testid='import-slug']")
      .fill("picked-statute");
    await page.getByTestId("import-apply").click();
    await expect(page.getByTestId("import-status")).toHaveText(
      "Sync complete."
    );
  });

  test("reveals the manual fallback when the Picker cannot start (no folder)", async ({
    page
  }) => {
    await mockSupabaseAuth(page, { user: ADMIN_AUTH_USER });
    await mockImportPipeline(page, {
      picker: { available: false, error: "folder-not-configured" }
    });

    await signIn(page);
    await page.goto("/en/admin/import");
    await page.getByTestId("import-picker").click();

    await expect(page.getByTestId("import-status")).toContainText(
      "Google Picker is unavailable"
    );
    await expect(
      page.locator("input[data-testid='import-google-id']")
    ).toBeVisible();
    await expect(
      page.getByText(/Fallback: Google Doc ID or URL/u)
    ).toBeVisible();
  });

  test("refuses an out-of-folder doc and leaves the published reader copy intact", async ({
    page
  }) => {
    await mockSupabaseAuth(page, { user: ADMIN_AUTH_USER });
    await mockImportPipeline(page, {
      status: "failed",
      errorCode: "out-of-folder",
      entityId: null,
      documents: [documentRow("Published copy text")]
    });

    await signIn(page);
    await page.goto("/en/admin/import");
    await fillImportForm(page);
    await page.getByTestId("import-apply").click();

    await expect(page.getByTestId("import-status")).toContainText(
      "outside the shared NGO folder"
    );

    // A failed sync never blanks or replaces the stored public copy.
    await page.goto("/en/about/documents/admin-import-fixture");
    await expect(page.getByText("Published copy text")).toBeVisible();
  });

  test("shows a distinct folder-not-configured job error", async ({ page }) => {
    await mockSupabaseAuth(page, { user: ADMIN_AUTH_USER });
    await mockImportPipeline(page, {
      status: "failed",
      errorCode: "folder-not-configured",
      entityId: null
    });

    await signIn(page);
    await page.goto("/en/admin/import");
    await fillImportForm(page);
    await page.getByTestId("import-apply").click();

    await expect(page.getByTestId("import-status")).toContainText(
      "shared Google Drive folder is not configured"
    );
  });

  test("offers the original download only when the row opts in", async ({
    page
  }) => {
    await mockSupabaseAuth(page, { user: ADMIN_AUTH_USER });
    await mockImportPipeline(page, {
      documents: [documentRow("Published copy text", true)]
    });

    await page.goto("/en/about/documents/admin-import-fixture");

    const download = page.getByTestId("download-original");
    await expect(download).toBeVisible();
    await expect(download).toHaveAttribute(
      "href",
      /\/.netlify\/functions\/content-original\?kind=document&slug=admin-import-fixture$/u
    );
  });

  test("hides the original download when the owner toggle is off", async ({
    page
  }) => {
    await mockSupabaseAuth(page, { user: ADMIN_AUTH_USER });
    await mockImportPipeline(page, {
      documents: [documentRow("Published copy text", false)]
    });

    await page.goto("/en/about/documents/admin-import-fixture");

    await expect(page.getByText("Published copy text")).toBeVisible();
    await expect(page.getByTestId("download-original")).toHaveCount(0);
  });
});
