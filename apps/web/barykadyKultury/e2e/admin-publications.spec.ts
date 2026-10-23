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
 * T-029 — admin publications E2E (ticket TDD plan step 4).
 *
 * Proves the two required journeys against deterministic in-memory handlers:
 *   - upload a PDF → publish → anonymous download works;
 *   - an SVG is rejected visibly BEFORE any Storage request is made.
 *
 * The store is installed on both the admin page and a separate anonymous
 * context, so "publish state is reflected immediately" is a real read change,
 * not an optimistic UI assertion (docs/TESTING.md §2).
 */

const SLUG = "e2e-annual-report";
const TITLE = "E2E Annual Report (fictional)";

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

function pdfFile() {
  return {
    name: "annual-report.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(PDF_FIXTURE_BODY)
  };
}

function svgFile() {
  return {
    name: "logo.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>")
  };
}

test.describe("admin publications", () => {
  test("PDF upload → publish → anonymous download; unpublish hides it", async ({
    page,
    browser
  }) => {
    await mockSupabaseAuth(page);
    const store = createAdminContentStore();
    await install(page, store);
    await signInAsAdmin(page);

    await page.goto("/en/admin/publications/new");
    await expect(
      page.getByRole("heading", { level: 1, name: "New publication" })
    ).toBeVisible();

    await page.getByTestId("publication-slug").fill(SLUG);
    await page.getByTestId("publication-title").fill(TITLE);
    await page
      .getByTestId("publication-abstract")
      .fill("Deterministic abstract.");
    await page.getByTestId("publication-file-en").setInputFiles(pdfFile());
    await page.getByTestId("publication-file-label-en").fill("English PDF");

    await page.getByTestId("publication-save").click();
    await expect(page.getByTestId("publication-status-message")).toHaveText(
      "Draft saved."
    );
    await expect(page).toHaveURL(/\/en\/admin\/publications\/[^/]+$/);

    // The upload returned a bucket-relative path, never a public URL.
    expect(store.uploads).toHaveLength(1);
    expect(store.uploads[0]?.bucket).toBe("public-documents");
    expect(store.uploads[0]?.path).toMatch(/^publications\/.+\.pdf$/);
    expect(store.publications[0]?.publication_files[0]?.storage_path).toMatch(
      /^publications\//
    );

    await page.getByTestId("publication-publish").click();
    await expect(page.getByTestId("publication-status-message")).toHaveText(
      "Published. The publication is now public."
    );

    const anonContext = await browser.newContext();
    const anonPage = await anonContext.newPage();
    await install(anonPage, store);

    await anonPage.goto("/en/publications");
    await expect(anonPage.getByRole("link", { name: TITLE })).toBeVisible();

    await anonPage.goto(`/en/publications/${SLUG}`);
    const download = anonPage.locator(".publication-files__link").first();
    const href = await download.getAttribute("href");
    expect(href).toContain("/storage/v1/object/public/public-documents/");
    expect(href).toContain("?download=annual-report.pdf");

    // The anonymous download is a real request through the page's routes.
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

    // ── Unpublish ─────────────────────────────────────────────────────────
    await page.getByTestId("publication-unpublish").click();
    await expect(page.getByTestId("publication-status-message")).toHaveText(
      "Unpublished. The publication is no longer public."
    );

    await anonPage.goto("/en/publications");
    await expect(anonPage.getByText(TITLE)).toHaveCount(0);

    await anonContext.close();
  });

  test("mock rejects duplicate file locales with the database's 23514 and writes nothing", async ({
    page
  }) => {
    await mockSupabaseAuth(page);
    const store = createAdminContentStore();
    await install(page, store);
    await page.goto("/en/admin/sign-in");

    const response = await page.evaluate(async () => {
      const result = await fetch("/rest/v1/rpc/save_publication_v1", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          p_id: null,
          p_slug: "duplicate-locales",
          p_status: "draft",
          p_language: "en",
          p_publication_date: null,
          p_external_url: null,
          p_sort_order: null,
          p_published_at: null,
          p_translations: [
            { locale: "en", title: "Duplicate", abstract: null, authors: null }
          ],
          p_files: [
            {
              locale: "en",
              label: "One",
              storagePath: "publications/one.pdf",
              mimeType: "application/pdf",
              sizeBytes: 1
            },
            {
              locale: "en",
              label: "Two",
              storagePath: "publications/two.pdf",
              mimeType: "application/pdf",
              sizeBytes: 2
            }
          ]
        })
      });
      return { status: result.status, body: await result.json() };
    });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("23514");
    // The all-or-nothing contract: a rejected call leaves no partial row.
    expect(store.publications).toHaveLength(0);
  });

  test("rejects an SVG with a visible error before any upload", async ({
    page
  }) => {
    await mockSupabaseAuth(page);
    const store = createAdminContentStore();
    await install(page, store);
    await signInAsAdmin(page);

    await page.goto("/en/admin/publications/new");
    await page.getByTestId("publication-slug").fill("e2e-svg-rejected");
    await page.getByTestId("publication-title").fill("SVG must not upload");
    await page.getByTestId("publication-file-en").setInputFiles(svgFile());

    await page.getByTestId("publication-save").click();

    await expect(page.getByTestId("publication-status-message")).toHaveText(
      "SVG, HTML and JavaScript uploads are not permitted."
    );
    // The decisive assertion: no bytes crossed the Storage boundary.
    expect(store.uploads).toHaveLength(0);
    expect(store.publications).toHaveLength(0);
  });
});
