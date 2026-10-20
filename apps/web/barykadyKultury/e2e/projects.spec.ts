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
const EN_ONLY_TITLE = "English Only Project (Fictional)";

const PROJECTS_FIXTURE = [
  {
    id: "00000000-0000-4000-8000-000000000201",
    slug: "sample-community-workshop",
    status: "published",
    featured_rank: 1,
    cover_path: "fixtures/projects/sample-cover.webp",
    start_date: "2026-01-10",
    end_date: "2026-03-20",
    updated_at: "2026-02-01T00:00:00Z",
    project_translations: [
      {
        locale: "en",
        title: EN_TITLE,
        summary: "A fictional summary used only by local fixtures (EN).",
        body: "## About\n\nEN-PROJECT body."
      },
      {
        locale: "pl",
        title: PL_TITLE,
        summary: "Fikcyjne podsumowanie (PL).",
        body: "## O projekcie\n\nPL-PROJECT body."
      },
      {
        locale: "uk",
        title: UK_TITLE,
        summary: "Fiktyvnyi korotkyi opys (UK).",
        body: "## Pro proiekt\n\nUK-PROJECT body."
      }
    ]
  },
  {
    id: "00000000-0000-4000-8000-000000000202",
    slug: "sample-draft-project",
    status: "draft",
    featured_rank: null,
    cover_path: null,
    start_date: null,
    end_date: null,
    updated_at: "2026-02-02T00:00:00Z",
    project_translations: [
      {
        locale: "en",
        title: DRAFT_TITLE,
        summary: "Draft summary must not leak.",
        body: "DRAFT BODY"
      }
    ]
  }
];

/**
 * A published row with no Polish/Ukrainian translation. The canonical slug
 * resolves the row, but the strict locale rule must then render the translated
 * 404 rather than substitute English (T-038, T-019 line 16).
 */
const EN_ONLY_PROJECT = {
  id: "00000000-0000-4000-8000-000000000203",
  slug: "english-only-project",
  status: "published",
  featured_rank: null,
  cover_path: null,
  start_date: null,
  end_date: null,
  updated_at: "2026-02-03T00:00:00Z",
  project_translations: [
    {
      locale: "en",
      title: EN_ONLY_TITLE,
      summary: "English-only fixture.",
      body: "EN-ONLY body."
    }
  ]
};

async function gotoWithProjects(
  page: Page,
  projects: unknown[] = PROJECTS_FIXTURE
): Promise<void> {
  await mockSupabaseRest(page, { responses: { projects } });
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

  test("links an English-only fallback card under /en from the Polish listing", async ({
    page
  }) => {
    // C1 regression: the card renders English text, but strict detail
    // resolution 404s a Polish URL for this project. The listing must therefore
    // link under the owning locale (/en), never the active /pl prefix.
    await gotoWithProjects(page, [...PROJECTS_FIXTURE, EN_ONLY_PROJECT]);
    await page.goto("/pl/projects");

    const fallbackCard = page.locator(".project-card", {
      hasText: EN_ONLY_TITLE
    });
    await expect(fallbackCard).toBeVisible();
    await expect(fallbackCard.locator(".project-card__fallback")).toBeVisible();

    await page.getByRole("link", { name: EN_ONLY_TITLE }).click();

    await expect(page).toHaveURL(/\/en\/projects\/english-only-project$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      EN_ONLY_TITLE
    );
    await expect(page.getByText("EN-ONLY body.")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).not.toHaveText(
      "Nie znaleziono strony"
    );
  });

  test("opens a localized deep link directly", async ({ page }) => {
    await gotoWithProjects(page);
    await page.goto("/uk/projects/sample-community-workshop");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(UK_TITLE);
    await expect(page.getByText("UK-PROJECT body.")).toBeVisible();
    await expect(page.locator(".localized-rich-text")).toHaveAttribute(
      "lang",
      "uk"
    );

    await expectNoSeriousViolations(page);
  });

  test("language switch keeps the canonical slug and renders the target-locale title", async ({
    page
  }) => {
    // D-24: one canonical slug per entity. Switching language is a pure
    // locale-prefix swap — no localized slug, no lookup, no redirect.
    await gotoWithProjects(page);
    await page.goto("/en/projects/sample-community-workshop");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(EN_TITLE);

    await page.getByRole("button", { name: "Language English EN" }).click();
    await page.getByRole("button", { name: "Polski PL" }).click();

    await expect(page).toHaveURL(/\/pl\/projects\/sample-community-workshop$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(PL_TITLE);
    await expect(page.getByText("PL-PROJECT body.")).toBeVisible();
    await expect(page.locator(".localized-rich-text")).toHaveAttribute(
      "lang",
      "pl"
    );

    // A second switch (pl → uk) proves the slug never varies by source locale.
    await page.getByRole("button", { name: "Język Polski PL" }).click();
    await page.getByRole("button", { name: "Українська UA" }).click();

    await expect(page).toHaveURL(/\/uk\/projects\/sample-community-workshop$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(UK_TITLE);

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

  test("renders the translated 404 when the requested locale has no translation", async ({
    page
  }) => {
    // The canonical slug resolves the row, but there is no Polish translation:
    // strict resolution renders the 404 instead of falling back to English.
    await gotoWithProjects(page, [...PROJECTS_FIXTURE, EN_ONLY_PROJECT]);
    await page.goto("/pl/projects/english-only-project");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Nie znaleziono strony"
    );
    await expect(page.locator("body")).not.toContainText(EN_ONLY_TITLE);
    await expect(page.locator("body")).not.toContainText("EN-ONLY body.");
  });

  test("renders the translated 404 for an unknown slug", async ({ page }) => {
    await gotoWithProjects(page);
    await page.goto("/pl/projects/unknown-project");

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
