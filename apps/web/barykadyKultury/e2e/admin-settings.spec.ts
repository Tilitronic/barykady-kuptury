import { expect, type Page, type Route } from "@playwright/test";

import {
  ADMIN_AUTH_USER,
  mockSupabaseAuth,
  mockSupabaseRest,
  PROJECT_EDITOR_AUTH_USER
} from "./support/mocks";
import { test } from "./support/network-guard";

/**
 * T-048 — organization settings, visibility and tabbed administration.
 *
 * Determinism (docs/TESTING.md §2): Auth, PostgREST and the settings RPC are
 * fully mocked. The settings fixture is mutable so a save flips the public
 * rendering in the same browser session; the RPC route applies the same
 * change set the admin form sends.
 *
 * The database half (RLS visible-only reads + denied writes) is proven by
 * supabase/tests/organization_settings_test.sql. This spec proves the browser
 * half: the explicit visible filter on anonymous reads, the toggle round trip,
 * scoped tab hiding and direct-URL denial.
 */

const EMAIL = "kontakt@example.test";
const PHONE = "+48 000 000 000";

interface SettingsFixtureRow {
  key: string;
  value: Record<string, string>;
  visible: boolean;
  updated_by: string | null;
  updated_by_email: string | null;
  updated_at: string | null;
}

function rowsFixture(): SettingsFixtureRow[] {
  const scalar = (key: string, value: string): SettingsFixtureRow => ({
    key,
    value: { en: value },
    visible: true,
    updated_by: null,
    updated_by_email: null,
    updated_at: null
  });

  return [
    scalar("org.name", "Barykady Kultury"),
    scalar("org.seat", "Poznań"),
    scalar("org.nip", "7831961912"),
    scalar("org.regon", "545503070"),
    scalar("org.privacy_url", ""),
    scalar("contact.email", EMAIL),
    scalar("contact.phone", PHONE),
    scalar("contact.address", "ul. Testowa 1, 00-000 Poznań"),
    scalar("contact.office_hours", "Mon 10:00–14:00 (fixture)"),
    scalar("contact.paper_mail_address", "PO Box 1, 00-000 Poznań (fixture)"),
    scalar("social.facebook", "https://www.facebook.com/BARYKADYKULTURY/"),
    scalar("social.instagram", "https://www.instagram.com/barykadykultury/"),
    scalar("social.telegram", "https://t.me/barykadykultury"),
    scalar("social.youtube", ""),
    scalar("social.twitter", ""),
    scalar("social.linkedin", "")
  ];
}

interface SettingsMock {
  readonly rows: SettingsFixtureRow[];
  readonly publicRequests: string[];
  readonly savedPayloads: unknown[];
}

/**
 * Serves the settings table and the save RPC from one mutable fixture.
 * Public reads (`visible=eq.true`) get the filtered projection — exactly what
 * RLS allows anonymous callers to see.
 */
async function mockSettings(
  page: Page,
  rows: SettingsFixtureRow[]
): Promise<SettingsMock> {
  const publicRequests: string[] = [];
  const savedPayloads: unknown[] = [];

  await page.route(
    "**/rest/v1/organization_settings*",
    async (route: Route) => {
      const url = new URL(route.request().url());
      const visibleOnly = url.searchParams.get("visible") === "eq.true";
      if (visibleOnly) publicRequests.push(url.toString());

      const payload = visibleOnly ? rows.filter(row => row.visible) : rows;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(payload)
      });
    }
  );

  await page.route("**/rest/v1/rpc/save_settings_v1", async (route: Route) => {
    const body = route.request().postDataJSON() as {
      p_changes: {
        key: string;
        value: Record<string, string>;
        visible: boolean;
      }[];
    };
    savedPayloads.push(body);

    for (const change of body.p_changes) {
      const row = rows.find(candidate => candidate.key === change.key);
      if (row === undefined) continue;
      row.value = change.value;
      row.visible = change.visible;
      row.updated_by = ADMIN_AUTH_USER.id;
      row.updated_by_email = ADMIN_AUTH_USER.email;
      row.updated_at = "2026-10-26T12:00:00.000Z";
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "null"
    });
  });

  return { rows, publicRequests, savedPayloads };
}

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/en/admin/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("e2e-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/en\/admin$/);
}

/**
 * Quasar may forward `data-testid` either to the field root or to the native
 * control depending on the wrapper. Match both shapes so the selector does not
 * encode an implementation detail of the UI seam.
 */
function settingControl(page: Page, testId: string, control: string) {
  return page.locator(
    `[data-testid="${testId}"] ${control}, ${control}[data-testid="${testId}"]`
  );
}

async function toggleVisible(page: Page, key: string): Promise<void> {
  // The wrapper carries the test id; Quasar's native input is visually hidden
  // (the clickable surface is the checkbox chrome inside the wrapper).
  await page.getByTestId(`setting-visible-${key}`).click();
}

test.describe("organization settings visibility", () => {
  test("unchecking a fact hides it publicly and rechecking restores it", async ({
    page
  }) => {
    // Register the broad REST fake first: Playwright resolves the most
    // recently registered matching route, and the settings mock must win.
    await mockSupabaseRest(page, { responses: {} });
    await mockSupabaseAuth(page, { user: ADMIN_AUTH_USER });
    const settings = await mockSettings(page, rowsFixture());

    // Baseline: the visible fact renders publicly.
    await page.goto("/en/contact");
    await expect(page.locator("#main").getByText(EMAIL)).toBeVisible();

    // Anonymous reads must carry the explicit visibility filter.
    expect(settings.publicRequests.length).toBeGreaterThan(0);
    for (const request of settings.publicRequests) {
      expect(request).toContain("visible=eq.true");
    }

    await signIn(page, "admin@demo.local");
    await page.goto("/en/admin/settings?tab=contacts");
    await expect(page.getByTestId("settings-form-contacts")).toBeVisible();

    await toggleVisible(page, "contact.email");
    await page.getByTestId("settings-save").click();
    await expect(page.getByTestId("settings-status")).toHaveText(
      "Settings saved."
    );

    // The RPC received the complete definition set, not just the toggled row.
    expect(settings.savedPayloads).toHaveLength(1);
    const payload = settings.savedPayloads[0] as {
      p_changes: { key: string }[];
    };
    // Complete vocabulary (16 editable facts), not just the Contacts tab.
    expect(payload.p_changes).toHaveLength(16);
    expect(payload.p_changes.map(change => change.key)).toContain(
      "contact.email"
    );

    // Hidden: absent from markup and absent from the anonymous payload.
    await page.goto("/en/contact");
    await expect(page.getByText(EMAIL)).toHaveCount(0);
    await expect(page.locator("#main").getByText(PHONE)).toBeVisible();

    // Same-session recheck restores it.
    await page.goto("/en/admin/settings?tab=contacts");
    await toggleVisible(page, "contact.email");
    await page.getByTestId("settings-save").click();
    await expect(page.getByTestId("settings-status")).toHaveText(
      "Settings saved."
    );

    await page.goto("/en/contact");
    await expect(page.locator("#main").getByText(EMAIL)).toBeVisible();
  });

  test("rejects a malformed email with a localized field error", async ({
    page
  }) => {
    await mockSupabaseRest(page, { responses: {} });
    await mockSupabaseAuth(page, { user: ADMIN_AUTH_USER });
    await mockSettings(page, rowsFixture());

    await signIn(page, "admin@demo.local");
    await page.goto("/en/admin/settings?tab=contacts");

    await settingControl(page, "setting-input-contact.email", "input").fill(
      "not-an-email"
    );
    await page.getByTestId("settings-save").click();

    await expect(page.getByTestId("settings-save-error")).toContainText(
      "Fix the highlighted fields before saving."
    );
    await expect(page.getByText("Enter a valid email address.")).toBeVisible();
  });
});

test.describe("tabbed admin rights", () => {
  test("a scoped editor sees only their tab and a direct denied URL is explained", async ({
    page
  }) => {
    await mockSupabaseRest(page, {
      responses: {
        projects: [],
        project_translations: []
      }
    });
    await mockSupabaseAuth(page, { user: PROJECT_EDITOR_AUTH_USER });
    await mockSettings(page, rowsFixture());

    await signIn(page, "projects@demo.local");

    await expect(page.getByTestId("admin-nav-settings")).toBeVisible();
    await page.getByTestId("admin-nav-settings").click();

    await expect(page.getByTestId("settings-tab-projects")).toBeVisible();
    for (const denied of [
      "general",
      "contacts",
      "team",
      "documents",
      "events",
      "publications"
    ]) {
      await expect(page.getByTestId(`settings-tab-${denied}`)).toHaveCount(0);
    }

    // Direct URL to a denied tab: explicit denial, no editor mounted.
    await page.goto("/en/admin/settings?tab=documents");
    await expect(page.getByTestId("settings-tab-denied")).toBeVisible();
    await expect(page.getByTestId("settings-tab-denied")).toContainText(
      "Documents"
    );
    await expect(page.getByTestId("settings-host-documents")).toHaveCount(0);
  });

  test("hosted entity editors render identically inside their tab", async ({
    page
  }) => {
    await mockSupabaseRest(page, {
      responses: {
        projects: [],
        project_translations: [],
        publications: [],
        publication_translations: [],
        publication_files: [],
        team_members: [],
        team_member_translations: [],
        organization_documents: [],
        organization_document_translations: [],
        calendar_event_links: []
      }
    });
    await mockSupabaseAuth(page, { user: ADMIN_AUTH_USER });
    await mockSettings(page, rowsFixture());

    await signIn(page, "admin@demo.local");

    // Projects: the tab hosts the shipped list page.
    await page.goto("/en/admin/projects");
    const standaloneProjects = await page.locator("h1").first().textContent();
    await page.goto("/en/admin/settings?tab=projects");
    await expect(page.getByTestId("settings-host-projects")).toBeVisible();
    await expect(page.locator("h1").first()).toHaveText(
      standaloneProjects ?? ""
    );

    // Publications likewise.
    await page.goto("/en/admin/publications");
    const standalonePublications = await page
      .locator("h1")
      .first()
      .textContent();
    await page.goto("/en/admin/settings?tab=publications");
    await expect(page.getByTestId("settings-host-publications")).toBeVisible();
    await expect(page.locator("h1").first()).toHaveText(
      standalonePublications ?? ""
    );

    // The shared submit shell declares each mode on the editor surfaces.
    await page.goto("/en/admin/projects/new");
    await expect(
      page.locator('[data-testid="admin-submit-shell"][data-mode="project"]')
    ).toBeVisible();

    await page.goto("/en/admin/publications/new");
    await expect(
      page.locator(
        '[data-testid="admin-submit-shell"][data-mode="publication"]'
      )
    ).toBeVisible();

    await page.goto("/en/admin/settings?tab=events");
    await expect(
      page.locator('[data-testid="admin-submit-shell"][data-mode="event"]')
    ).toBeVisible();
  });
});
