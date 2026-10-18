import { expect, type Page } from "@playwright/test";

import { checkA11y } from "./support/a11y";
import { mockSupabaseRest } from "./support/mocks";
import { test } from "./support/network-guard";

/**
 * T-018 — About: team (docs/tickets/T-018-about-team.md).
 *
 * No approved team data exists yet, so the shipped state today is the
 * translated empty state with nothing fabricated (DESIGN_SYSTEM.md §3). The
 * fixture-driven journey proves the card grid renders name/role/bio in
 * `sort_order` once members exist, using mocked Supabase REST reads only
 * (docs/TESTING.md §2).
 */

const TEAM_MEMBERS_FIXTURE = [
  {
    id: "00000000-0000-4000-8000-000000000801",
    name: "Anna Kowalska",
    status: "published",
    sort_order: 1,
    portrait_path: null,
    updated_at: "2026-01-05T12:00:00Z",
    team_member_translations: [
      {
        locale: "en",
        slug: "anna-kowalska",
        role: "Chair of the board",
        bio: "Anna co-founded the association and coordinates its board work."
      }
    ]
  },
  {
    id: "00000000-0000-4000-8000-000000000802",
    name: "Oleh Veres",
    status: "published",
    sort_order: 2,
    portrait_path: null,
    updated_at: "2026-01-05T12:00:00Z",
    team_member_translations: [
      {
        locale: "en",
        slug: "oleh-veres",
        role: "Treasurer",
        bio: "Oleh oversees budgets and reporting."
      }
    ]
  },
  {
    id: "00000000-0000-4000-8000-000000000803",
    name: "Daryna Shevchenko",
    status: "published",
    sort_order: 3,
    portrait_path: null,
    updated_at: "2026-01-05T12:00:00Z",
    team_member_translations: [
      {
        locale: "en",
        slug: "daryna-shevchenko",
        role: null,
        bio: null
      }
    ]
  }
];

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

test.describe("team page", () => {
  test("shows the translated empty state while no members are published", async ({
    page
  }) => {
    await mockSupabaseRest(page);
    await page.goto("/en/about/team");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Team");
    await expect(
      page.getByText("No team members are published yet.")
    ).toBeVisible();
    // Nothing fabricated: no cards, only the shell's own lists remain.
    await expect(page.locator(".team-card")).toHaveCount(0);

    await expectNoSeriousViolations(page);
  });

  test("renders member cards with name, role and bio in sort order", async ({
    page
  }) => {
    await mockSupabaseRest(page, {
      responses: { team_members: TEAM_MEMBERS_FIXTURE }
    });
    await page.goto("/en/about/team");

    const names = page.locator(".team-card__name");
    await expect(names).toHaveCount(3);
    await expect(names).toHaveText([
      "Anna Kowalska",
      "Oleh Veres",
      "Daryna Shevchenko"
    ]);

    await expect(
      page.getByText("Chair of the board", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText("Anna co-founded the association", { exact: false })
    ).toBeVisible();

    // Optional fields collapse: the third member has no role or bio elements.
    const thirdCard = page.locator(".team-card").nth(2);
    await expect(thirdCard.locator(".team-card__role")).toHaveCount(0);
    await expect(thirdCard.locator(".team-card__bio")).toHaveCount(0);

    await expectNoSeriousViolations(page);
  });

  test("stays scroll-free at a 320 px viewport", async ({ page }) => {
    await mockSupabaseRest(page, {
      responses: { team_members: TEAM_MEMBERS_FIXTURE }
    });
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto("/en/about/team");

    await expect(page.locator(".team-card")).toHaveCount(3);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(overflow).toBe(false);
  });
});
