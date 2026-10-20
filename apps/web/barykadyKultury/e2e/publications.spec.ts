import { expect, type Page } from "@playwright/test";

import { checkA11y } from "./support/a11y";
import {
  mockSupabaseRest,
  mockSupabaseStorage,
  PDF_FIXTURE_BODY
} from "./support/mocks";
import { test } from "./support/network-guard";

/**
 * T-020 — Publications: listing, detail, files.
 *
 * The mocked REST payload deliberately contains a draft row (worst-case
 * leak): the app layer must never list or resolve it, complementing the RLS
 * SQL proof. Storage reads are intercepted so the anonymous PDF download is
 * deterministic and offline (docs/TESTING.md §2); the canonical fixture copy
 * lives in `supabase/seed.sql`.
 */

const FILE_TITLE = "Sample Publication (Fictional)";
const EXTERNAL_TITLE = "Sample External Publication (Fictional)";
const DRAFT_TITLE = "Draft Publication Must Not Leak";

const PUBLICATIONS_FIXTURE = [
  {
    id: "00000000-0000-4000-8000-000000000401",
    slug: "sample-publication",
    status: "published",
    language: "en",
    publication_date: "2026-02-01",
    external_url: null,
    sort_order: 1,
    updated_at: "2026-02-01T09:00:00Z",
    publication_translations: [
      {
        locale: "en",
        title: FILE_TITLE,
        abstract: "A fictional abstract for local fixtures (EN).",
        authors: "Sample Author (Fictional)"
      },
      {
        locale: "pl",
        title: "Przykladowa publikacja (fikcyjna)",
        abstract: "Fikcyjne streszczenie (PL).",
        authors: "Przykladowy autor (fikcyjny)"
      },
      {
        locale: "uk",
        title: "Zrazkova publikatsiia (fiktyvna)",
        abstract: "Fiktyvne reziume (UK).",
        authors: "Zrazkovyi avtor (fiktyvnyi)"
      }
    ],
    publication_files: [
      {
        locale: "en",
        label: "Sample PDF (English, fictional)",
        storage_path: "fixtures/publications/sample-publication-en.pdf",
        mime_type: "application/pdf",
        file_size_bytes: 12345
      },
      {
        locale: "pl",
        label: "Sample PDF (Polish, fictional)",
        storage_path: "fixtures/publications/sample-publication-pl.pdf",
        mime_type: "application/pdf",
        file_size_bytes: 23456
      }
    ]
  },
  {
    // Published with only an English translation: the canonical slug resolves
    // the row, then the strict locale rule renders the 404 (T-038).
    id: "00000000-0000-4000-8000-000000000402",
    slug: "sample-external-publication",
    status: "published",
    language: "en",
    publication_date: null,
    external_url: "https://example.org/fictional-sample-publication",
    sort_order: 2,
    updated_at: "2026-02-02T09:00:00Z",
    publication_translations: [
      {
        locale: "en",
        title: EXTERNAL_TITLE,
        abstract: null,
        authors: null
      }
    ],
    publication_files: []
  },
  {
    id: "00000000-0000-4000-8000-000000000499",
    slug: "draft-publication-leak",
    status: "draft",
    language: "en",
    publication_date: null,
    external_url: null,
    sort_order: 3,
    updated_at: "2026-02-03T09:00:00Z",
    publication_translations: [
      {
        locale: "en",
        title: DRAFT_TITLE,
        abstract: "DRAFT ABSTRACT",
        authors: null
      }
    ],
    publication_files: []
  }
];

async function gotoWithPublications(page: Page): Promise<void> {
  await mockSupabaseRest(page, {
    responses: { publications: PUBLICATIONS_FIXTURE }
  });
  await mockSupabaseStorage(page);
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

/** Fetches a file URL from inside the page (same-origin, mocked) and
 *  reports the anonymous download outcome — the offline stand-in for the
 *  browser actually saving the PDF. */
async function downloadOutcome(page: Page, href: string) {
  return page.evaluate(async url => {
    const response = await fetch(url);
    return {
      status: response.status,
      contentType: response.headers.get("content-type"),
      body: await response.text()
    };
  }, href);
}

test.describe("publications", () => {
  test("lists published publications only and opens the file detail", async ({
    page
  }) => {
    await gotoWithPublications(page);
    await page.goto("/en/publications");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Publications"
    );
    await expect(page.locator(".publication-card")).toHaveCount(2);
    await expect(page.locator("body")).not.toContainText(DRAFT_TITLE);

    await expectNoSeriousViolations(page);

    await page.getByRole("link", { name: FILE_TITLE }).click();

    await expect(page).toHaveURL(/\/en\/publications\/sample-publication$/);
    await expect(
      page.getByRole("heading", { level: 2, name: "Available files" })
    ).toBeVisible();

    const links = page.locator(".publication-files__link");
    await expect(links).toHaveCount(2);
    await expect(links.nth(0)).toContainText("English");
    await expect(links.nth(1)).toContainText("Polski");
    await expect(page.locator("body")).toContainText("12.1 KB");
    await expect(page.locator("body")).toContainText("22.9 KB");

    await expectNoSeriousViolations(page);
  });

  test("links an English-only fallback card under /en from the Polish listing", async ({
    page
  }) => {
    // C1 regression: the fixture has an English-only publication, so a Polish
    // listing card renders English text. Strict resolution 404s a Polish URL
    // for it, so the card must link under the owning locale (/en).
    await gotoWithPublications(page);
    await page.goto("/pl/publications");

    const fallbackCard = page.locator(".publication-card", {
      hasText: EXTERNAL_TITLE
    });
    await expect(fallbackCard).toBeVisible();
    await expect(
      fallbackCard.locator(".publication-card__fallback")
    ).toBeVisible();

    await page.getByRole("link", { name: EXTERNAL_TITLE }).click();

    await expect(page).toHaveURL(
      /\/en\/publications\/sample-external-publication$/
    );
    await expect(
      page.getByRole("heading", { level: 1, name: EXTERNAL_TITLE })
    ).toBeVisible();
    await expect(
      page.locator(".publication-files__external-link")
    ).toHaveAttribute(
      "href",
      "https://example.org/fictional-sample-publication"
    );
  });

  test("language switch keeps the canonical slug and renders the target-locale title", async ({
    page
  }) => {
    // D-24: the same slug serves every locale; only the prefix changes.
    await gotoWithPublications(page);
    await page.goto("/en/publications/sample-publication");

    await expect(
      page.getByRole("heading", { level: 1, name: FILE_TITLE })
    ).toBeVisible();

    await page.getByRole("button", { name: "Language English EN" }).click();
    await page.getByRole("button", { name: "Polski PL" }).click();

    await expect(page).toHaveURL(/\/pl\/publications\/sample-publication$/);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Przykladowa publikacja (fikcyjna)"
      })
    ).toBeVisible();
    await expect(page.getByText("Fikcyjne streszczenie (PL).")).toBeVisible();
    await expect(page.locator(".publication-files__link")).toHaveCount(2);

    await expectNoSeriousViolations(page);
  });

  test("an anonymous file download responds 200 with application/pdf", async ({
    page
  }) => {
    await gotoWithPublications(page);
    await page.goto("/en/publications/sample-publication");

    const href = await page
      .locator(".publication-files__link")
      .first()
      .getAttribute("href");
    expect(href).toContain("/storage/v1/object/public/public-documents/");
    expect(href).toContain("?download=sample-publication-en.pdf");

    const outcome = await downloadOutcome(page, href!);
    expect(outcome.status).toBe(200);
    expect(outcome.contentType).toBe("application/pdf");
    expect(outcome.body).toBe(PDF_FIXTURE_BODY);
  });

  test("downloads work on a mobile viewport without horizontal overflow", async ({
    page
  }) => {
    await gotoWithPublications(page);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/pl/publications/sample-publication");

    const links = page.locator(".publication-files__link");
    await expect(links).toHaveCount(2);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(overflow).toBe(false);

    const href = await links.nth(1).getAttribute("href");
    const outcome = await downloadOutcome(page, href!);
    expect(outcome.status).toBe(200);
    expect(outcome.contentType).toBe("application/pdf");
  });

  test("the external variant opens safely in a new tab", async ({ page }) => {
    await gotoWithPublications(page);
    await page.goto("/en/publications/sample-external-publication");

    const link = page.locator(".publication-files__external-link");
    await expect(link).toHaveAttribute(
      "href",
      "https://example.org/fictional-sample-publication"
    );
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");

    // Missing optional metadata renders nothing.
    await expect(page.locator(".publication-detail__abstract")).toHaveCount(0);
    await expect(page.locator(".publication-detail__authors")).toHaveCount(0);

    await expectNoSeriousViolations(page);
  });

  test("renders the translated 404 for a draft slug, with no draft data on the page", async ({
    page
  }) => {
    await gotoWithPublications(page);
    await page.goto("/pl/publications/draft-publication-leak");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Nie znaleziono strony"
    );
    await expect(page.locator("body")).not.toContainText(DRAFT_TITLE);
    await expect(page.locator("body")).not.toContainText("DRAFT ABSTRACT");

    await expectNoSeriousViolations(page);
  });

  test("renders the translated 404 when the requested locale has no translation", async ({
    page
  }) => {
    // The canonical slug resolves the English-only publication, then strict
    // resolution renders the 404 instead of substituting English (T-038).
    await gotoWithPublications(page);
    await page.goto("/pl/publications/sample-external-publication");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Nie znaleziono strony"
    );
    await expect(page.locator("body")).not.toContainText(EXTERNAL_TITLE);
  });

  test("renders the translated 404 for an unknown slug", async ({ page }) => {
    await gotoWithPublications(page);
    await page.goto("/pl/publications/unknown-publication");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Nie znaleziono strony"
    );
    await expect(page.locator("body")).not.toContainText(FILE_TITLE);
  });

  test("the download list is keyboard operable", async ({ page }) => {
    await gotoWithPublications(page);
    await page.goto("/en/publications/sample-publication");

    await page.locator(".publication-files__link").first().focus();
    const [response] = await Promise.all([
      page.waitForResponse(res =>
        res.url().includes("/storage/v1/object/public/public-documents/")
      ),
      page.keyboard.press("Enter")
    ]);

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/pdf");
  });

  // T-039 (D-25): year sections behind the TOC; `#undated` for dateless rows.
  test("groups publications by year with a working TOC", async ({ page }) => {
    await gotoWithPublications(page);
    await page.goto("/en/publications");

    await expect(
      page.getByRole("heading", { level: 2, name: "2026" })
    ).toBeVisible();
    const toc = page.getByRole("navigation", { name: "On this page" });
    await expect(toc.getByRole("link", { name: "2026" })).toHaveAttribute(
      "href",
      "#2026"
    );

    await expectNoSeriousViolations(page);
  });
});
