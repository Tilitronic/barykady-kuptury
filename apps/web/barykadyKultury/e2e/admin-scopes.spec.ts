import { expect, type Page } from "@playwright/test";

import {
  mockSupabaseAuth,
  mockSupabaseRest,
  PROJECT_EDITOR_AUTH_USER,
  PUBLICATIONS_EDITOR_AUTH_USER
} from "./support/mocks";
import { test } from "./support/network-guard";
import { createProjectStore, mockProjectApi } from "./support/project-store";
import {
  createPublicationStore,
  mockScopedContentApi,
  readSupabaseAccessToken
} from "./support/publication-store";

/**
 * T-046 — capability-scoped admin journeys (D-42).
 *
 * The browser half of the proof: a scoped editor sees only affordances for the
 * capabilities in `app_metadata.scopes`, an out-of-scope URL is routed to an
 * explicit scope-denial page, AND the scoped session can complete a real
 * mutation that becomes publicly visible while its out-of-scope mutation is
 * refused. The database half (allow-in-scope / deny-out-of-scope writes and RPC
 * re-checks) is proven by `supabase/tests/scoped_admin_matrix_test.sql`.
 *
 * Why the mutation is driven at the feature-API level: the publication admin UI
 * is owned by T-029 and does not exist yet, so there is no screen to click.
 * The journey therefore issues the exact RPC the feature API issues
 * (`persist_reader_import_v1`, see
 * `src/features/import/persistConvertedTranslation.ts`) with the scoped
 * session's bearer token, then reads the published row back through the public
 * listing (`fetchPublishedPublications`). When T-029 lands, its UI test should
 * replace this wire-level step and assert the same visibility outcome; the
 * route-hiding and denial assertions here stay valid either way.
 *
 * Determinism (docs/TESTING.md §2): Auth, PostgREST and the RPCs are mocked;
 * the import page's mount query (`content_sync_runs`) resolves to an empty
 * fixture.
 */

const PUBLICATION_SLUG = "scoped-editor-publication";
const PUBLICATION_TITLE = "Scoped editor publication (fictional)";

async function signInViaForm(
  page: Page,
  email: string,
  password = "e2e-password"
): Promise<void> {
  await page.goto("/en/admin/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/** The exact argument shape `persistConvertedTranslation` sends (rpcArgs). */
function persistPublicationArgs() {
  return {
    p_kind: "publication",
    p_entity_id: null,
    p_slug: PUBLICATION_SLUG,
    p_locale: "en",
    p_title: PUBLICATION_TITLE,
    p_description: "Created by the scoped-editor E2E.",
    p_document_type: "report",
    p_body_ast: {
      kind: "document",
      blocks: [
        {
          kind: "paragraph",
          children: [{ kind: "text", value: "Scoped editor body." }]
        }
      ]
    },
    p_assets: [],
    p_source_provider: "manual",
    p_source_path: null,
    p_source_mime: null,
    p_source_external_id: null,
    p_source_url: null,
    p_source_synced_at: null,
    p_source_modified_at: null,
    p_allow_original_download: false,
    p_status: "published"
  };
}

test.describe("capability-scoped admin (D-42)", () => {
  test("a publications editor publishes through the feature API and no project route", async ({
    page
  }) => {
    const store = createPublicationStore();
    const publicationsEditorScopes = ["publications:write", "importer"];

    await mockSupabaseAuth(page, { user: PUBLICATIONS_EDITOR_AUTH_USER });
    await mockSupabaseRest(page, {
      responses: { publications: store.publications }
    });
    await mockScopedContentApi(page, store, {
      // The fixture's token is `e2e-access-token-<email>` (mockSupabaseAuth).
      scopesForToken: token =>
        token.endsWith(PUBLICATIONS_EDITOR_AUTH_USER.email)
          ? publicationsEditorScopes
          : []
    });

    await signInViaForm(page, "editor@demo.local");
    await expect(page).toHaveURL(/\/en\/admin$/);

    // The dashboard explains exactly what this account may do.
    const access = page.getByTestId("dashboard-access");
    await expect(access).toBeVisible();
    await expect(access).toContainText("Publications");
    await expect(access).toContainText("Content import");

    // No affordance for the denied project area (nav or dashboard link).
    await expect(page.getByTestId("admin-nav-projects")).toHaveCount(0);
    await expect(page.getByTestId("dashboard-projects-link")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Projects", exact: true })
    ).toHaveCount(0);

    // Baseline: the publication is not publicly visible yet.
    await page.goto("/en/publications");
    await expect(page.getByText(PUBLICATION_TITLE)).toHaveCount(0);

    // ── Real mutation at the feature-API boundary ──────────────────────────
    await page.goto("/en/admin");
    const token = await readSupabaseAccessToken(page);
    expect(token).not.toBe("");

    const published = await page.evaluate(
      async ({ token, args }) => {
        const response = await fetch("/rest/v1/rpc/persist_reader_import_v1", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`
          },
          body: JSON.stringify(args)
        });
        return { status: response.status, body: await response.json() };
      },
      { token, args: persistPublicationArgs() }
    );

    expect(published.status).toBe(200);
    expect(typeof published.body).toBe("string");
    // The row is really persisted (the store is the mock's database).
    expect(store.publications).toHaveLength(1);

    // The same session's out-of-scope mutation is refused at the boundary.
    const denied = await page.evaluate(
      async ({ token }) => {
        const response = await fetch("/rest/v1/rpc/save_project_v1", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            p_id: null,
            p_slug: "scoped-editor-project",
            p_status: "draft",
            p_translations: []
          })
        });
        return { status: response.status, body: await response.json() };
      },
      { token }
    );

    expect(denied.status).toBeGreaterThanOrEqual(400);
    expect(denied.body.code).toBe("42501");

    // ── Published visibility through the public read path ──────────────────
    await page.goto("/en/publications");
    await expect(page.getByText(PUBLICATION_TITLE)).toBeVisible();

    // ── In-scope import surface stays reachable ────────────────────────────
    await page.goto("/en/admin/import");
    await expect(page).toHaveURL(/\/en\/admin\/import$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Import content" })
    ).toBeVisible();

    // ── Out-of-scope project route is denied, with a role-specific message ─
    await page.goto("/en/admin/projects");
    await expect(page).toHaveURL(
      /\/en\/admin\/access-denied\?missing=projects(%3A|:)write/
    );
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Not available for your role"
      })
    ).toBeVisible();
    await expect(
      page.getByText("does not include this area", { exact: false })
    ).toBeVisible();
  });

  test("a project editor sees projects but no import affordance", async ({
    page
  }) => {
    await mockSupabaseAuth(page, { user: PROJECT_EDITOR_AUTH_USER });
    await mockProjectApi(page, createProjectStore());

    await signInViaForm(page, "projects@demo.local");
    await expect(page).toHaveURL(/\/en\/admin$/);

    await expect(page.getByTestId("admin-nav-projects")).toBeVisible();
    await expect(page.getByTestId("admin-nav-import")).toHaveCount(0);
    await expect(page.getByTestId("dashboard-import-link")).toHaveCount(0);

    // In-scope project area is reachable.
    await page.getByTestId("admin-nav-projects").click();
    await expect(page).toHaveURL(/\/en\/admin\/projects$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Projects" })
    ).toBeVisible();

    // Out-of-scope import is denied.
    await page.goto("/en/admin/import");
    await expect(page).toHaveURL(
      /\/en\/admin\/access-denied\?missing=importer/
    );
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Not available for your role"
      })
    ).toBeVisible();
  });
});
