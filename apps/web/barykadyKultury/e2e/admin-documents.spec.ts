import { expect, type Page } from "@playwright/test";

import {
  PDF_FIXTURE_BODY,
  mockSupabaseAuth,
  mockSupabaseRest
} from "./support/mocks";
import { test } from "./support/network-guard";
import {
  createAdminContentStore,
  mockAdminContentApi,
  type AdminContentStore
} from "./support/publication-admin-store";

/**
 * T-029 — admin documents E2E.
 *
 * Proves create → upload → publish → anonymous download from the About page,
 * then unpublish hides it. The same in-memory store is installed in an
 * anonymous context, so the assertion is a real read, not optimistic UI.
 */

async function signInAsAdmin(page: Page): Promise<void> {
  await page.goto("/en/admin/sign-in");
  await page.getByLabel("Email").fill("admin@demo.local");
  await page.getByLabel("Password").fill("e2e-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Dashboard" })
  ).toBeVisible();
}

async function install(page: Page, store: AdminContentStore): Promise<void> {
  await mockSupabaseRest(page);
  await mockAdminContentApi(page, store);
}

test.describe("admin documents", () => {
  test("upload a PDF → publish → anonymous download; unpublish hides it", async ({
    page,
    browser
  }) => {
    await mockSupabaseAuth(page);
    const store = createAdminContentStore();
    await install(page, store);
    await signInAsAdmin(page);

    await page.goto("/en/admin/documents");
    await expect(
      page.getByRole("heading", { level: 1, name: "Documents" })
    ).toBeVisible();

    await page.getByTestId("documents-new").click();
    await page.getByTestId("document-slug").fill("e2e-annual-report-file");
    await page.getByTestId("document-type").click();
    await page.getByRole("option", { name: "Report" }).click();
    await page.getByTestId("document-title").fill("E2E Annual Report File");
    await page
      .getByTestId("document-description")
      .fill("Deterministic document description.");
    await page.getByTestId("document-file").setInputFiles({
      name: "annual-report-file.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(PDF_FIXTURE_BODY)
    });

    await page.getByTestId("document-save").click();
    await expect(page.getByTestId("document-status-message")).toHaveText(
      "Document saved."
    );

    expect(store.uploads).toHaveLength(1);
    expect(store.uploads[0]?.bucket).toBe("public-documents");
    expect(store.uploads[0]?.path).toMatch(/^documents\/.+\.pdf$/);
    expect(store.documents[0]?.storage_path).toMatch(/^documents\//);

    await page.getByTestId("documents-toggle-e2e-annual-report-file").click();
    await expect(page.getByTestId("document-status-message")).toHaveText(
      "Published. The document is now public."
    );

    const anonContext = await browser.newContext();
    const anonPage = await anonContext.newPage();
    await install(anonPage, store);

    await anonPage.goto("/en/about");
    const link = anonPage.getByTestId("document-download").filter({
      hasText: "E2E Annual Report File"
    });
    await expect(link).toBeVisible();

    const href = await link.getAttribute("href");
    expect(href).toContain("/storage/v1/object/public/public-documents/");
    expect(href).toContain("?download=annual-report-file.pdf");

    const response = await anonPage.evaluate(async url => {
      const result = await fetch(url!);
      return {
        status: result.status,
        contentType: result.headers.get("content-type"),
        body: await result.text()
      };
    }, href);
    expect(response.status).toBe(200);
    expect(response.contentType).toContain("application/pdf");
    expect(response.body).toContain("%PDF");

    await page.getByTestId("documents-toggle-e2e-annual-report-file").click();
    await expect(page.getByTestId("document-status-message")).toHaveText(
      "Unpublished. The document is no longer public."
    );

    await anonPage.reload();
    await expect(anonPage.getByText("E2E Annual Report File")).toHaveCount(0);

    await anonContext.close();
  });
});
