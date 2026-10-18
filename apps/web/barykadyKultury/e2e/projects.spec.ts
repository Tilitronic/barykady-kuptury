import { expect, type Page } from "@playwright/test";

import { checkA11y } from "./support/a11y";
import { mockSupabaseRest } from "./support/mocks";
import { test } from "./support/network-guard";

/**
 * T-019 — Projects listing, detail, draft protection.
 *
 * The mocked payload deliberately CONTAINS the draft row (the worst case: an
 * anon read that leaks it), so the journeys prove the app layer also refuses
 * to list or resolve drafts — complementing the RLS SQL proof in
 * `supabase/tests/rls_content_matrix_test.sql` (docs/PRODUCT_REQUIREMENTS.md §8).
 * Bodies are short deterministic markers; the canonical fixture copy lives in
 * `supabase/seed.sql` (docs/TESTING.md §2).
 */

const EN_TITLE = "Sample Community Workshop (Fictional)";
const PL_TITLE = "Przykladowy warsztat spoleczny (fikcyjny)";
const UK_TITLE = "Zrazkova hromadska maisternia (fiktyvna)";
const DRAFT_TITLE = "Draft Title Must Not Leak";

const PROJECTS_FIXTURE = [
  {
    id: "00000000-0000-4000-8000-000000000201",
    status: "published",
    featured_rank: 1,
    cover_path: "fixtures/projects/sample-cover.webp",
    start_date: "2026-01-10",
    end_date: "2026-03-20",
    updated_at: "2026-02-01T00:00:00Z",
    project_translations: [
      {
        locale: "en",
        slug: "sample-community-workshop",
        title: EN_TITLE,
        summary: "A fictional summary used only by local fixtures (EN).",
        body: "## About\n\nEN-PROJECT body."
      },
      {
        locale: "pl",
        slug: "przykladowy-warsztat-spoleczny",
        title: PL_TITLE,
        summary: "Fikcyjne podsumowanie (PL).",
        body: "## O projekcie\n\nPL-PROJECT body."
      },
      {
        locale: "uk",
        slug: "zrazkova-hromadska-maisternia",
        title: UK_TITLE,
        summary: "Fiktyvnyi korotkyi opys (UK).",
        body: "## Pro proiekt\n\nUK-PROJECT body."
      }
    ]
  },
  {
    id: "00000000-0000-4000-8000-000000000202",
    status: "draft",
    featured_rank: null,
    cover_path: null,
    start_date: null,
    end_date: null,
    updated_at: "2026-02-02T00:00:00Z",
    project_translations: [
      {
        locale: "en",
        slug: "sample-draft-project",
        title: DRAFT_TITLE,
        summary: "Draft summary must not leak.",
        body: "DRAFT BODY"
      }
    ]
  }
];

async function gotoWithProjects(page: Page): Promise<void> {
  await mockSupabaseRest(page, { responses: { projects: PROJECTS_FIXTURE } });
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

test.describe("projects", () => {
  test("lists published projects only and opens the detail from a card", async ({
    page
  }) => {
    await gotoWithProjects(page);
    await page.goto("/en/projects");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Projects"
    );

    const card = page.locator(".project-card");
    await expect(card).toHaveCount(1);
    await expect(page.locator("body")).not.toContainText(DRAFT_TITLE);

    await expectNoSeriousViolations(page);

    await page.getByRole("link", { name: EN_TITLE }).click();

    await expect(page).toHaveURL(/\/en\/projects\/sample-community-workshop$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(EN_TITLE);
    await expect(page.getByText("EN-PROJECT body.")).toBeVisible();

    const cover = page.locator(".project-detail__cover");
    await expect(cover).toHaveAttribute("alt", EN_TITLE);
    await expect(cover).toHaveAttribute("width", "1280");
    await expect(cover).toHaveAttribute("height", "720");

    // Localized lifecycle status on the detail (T-019 review, Spec finding 1).
    await expect(page.locator(".project-detail__status")).toHaveText(
      "Published"
    );

    await expectNoSeriousViolations(page);
  });

  test("opens a localized deep link directly", async ({ page }) => {
    await gotoWithProjects(page);
    await page.goto("/uk/projects/zrazkova-hromadska-maisternia");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(UK_TITLE);
    await expect(page.getByText("UK-PROJECT body.")).toBeVisible();
    await expect(page.locator(".localized-rich-text")).toHaveAttribute(
      "lang",
      "uk"
    );

    await expectNoSeriousViolations(page);
  });

  test("renders the translated 404 for a draft slug, with no draft data on the page", async ({
    page
  }) => {
    await gotoWithProjects(page);
    await page.goto("/pl/projects/sample-draft-project");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Nie znaleziono strony"
    );
    await expect(page.locator("body")).not.toContainText(DRAFT_TITLE);
    await expect(page.locator("body")).not.toContainText("DRAFT BODY");

    await expectNoSeriousViolations(page);
  });

  test("renders the 404 when an English slug is used on a Polish URL", async ({
    page
  }) => {
    // The strict (locale, slug) rule (ticket line 16): the English slug must
    // not silently resolve the Polish URL.
    await gotoWithProjects(page);
    await page.goto("/pl/projects/sample-community-workshop");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Nie znaleziono strony"
    );
    await expect(page.locator("body")).not.toContainText(EN_TITLE);
  });

  test("cards are keyboard operable", async ({ page }) => {
    await gotoWithProjects(page);
    await page.goto("/en/projects");

    await page.locator(".project-card__link").first().focus();
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/en\/projects\/sample-community-workshop$/);
    await expect(page.getByText("EN-PROJECT body.")).toBeVisible();
  });
});
