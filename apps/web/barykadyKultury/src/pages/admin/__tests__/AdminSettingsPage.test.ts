import type { Session, User } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import {
  configureAuth,
  whenAuthReady,
  type AuthApi
} from "@/features/auth/authStore";
import { mountWithPlugins } from "@/test-utils/mount";

import AdminSettingsPage from "../AdminSettingsPage.vue";

/**
 * T-048 — tab visibility and direct-URL denial.
 *
 * The DB is the authorization boundary (pgTAP); this is the UX contract:
 * hiding denied tabs and explaining a denied direct URL instead of mounting
 * the editor.
 */

const ROOT = {
  id: "44444444-4444-4444-8444-444444444444",
  email: "root@demo.local",
  app_metadata: { role: "admin" }
} as unknown as User;

const PUBLICATIONS_EDITOR = {
  id: "55555555-5555-4555-8555-555555555555",
  email: "publications@demo.local",
  app_metadata: { role: "editor", scopes: ["publications:write"] }
} as unknown as User;

function fakeAuth(user: User): AuthApi {
  return {
    getSession: async () => ({
      data: { session: { user } as unknown as Session },
      error: null
    }),
    signInWithPassword: async () => ({
      data: { session: null, user: null },
      error: null
    }),
    signOut: async () => ({ error: null }),
    onAuthStateChange: () => ({
      data: { subscription: { unsubscribe: () => undefined } }
    })
  };
}

async function mountPage(user: User, query: string) {
  configureAuth(fakeAuth(user));
  await whenAuthReady();

  return mountWithPlugins(AdminSettingsPage, {
    initialRoute: `/en/admin/settings${query}`
  });
}

describe("AdminSettingsPage tab rights", () => {
  it("shows every tab to a root administrator", async () => {
    const wrapper = await mountPage(ROOT, "?tab=general");

    for (const id of [
      "general",
      "contacts",
      "team",
      "documents",
      "projects",
      "events",
      "publications"
    ]) {
      expect(
        wrapper.find(`[data-testid="settings-tab-${id}"]`).exists(),
        id
      ).toBe(true);
    }
  });

  it("shows only the granted tab to a scoped editor", async () => {
    const wrapper = await mountPage(PUBLICATIONS_EDITOR, "?tab=publications");

    expect(
      wrapper.find('[data-testid="settings-tab-publications"]').exists()
    ).toBe(true);
    for (const id of [
      "general",
      "contacts",
      "team",
      "documents",
      "projects",
      "events"
    ]) {
      expect(
        wrapper.find(`[data-testid="settings-tab-${id}"]`).exists(),
        id
      ).toBe(false);
    }
  });

  it("denies a direct URL to an ungranted tab without mounting its editor", async () => {
    const wrapper = await mountPage(PUBLICATIONS_EDITOR, "?tab=documents");

    const denied = wrapper.get('[data-testid="settings-tab-denied"]');
    expect(denied.attributes("role")).toBe("alert");
    expect(denied.text()).toContain("Documents");
    expect(
      wrapper.find('[data-testid="settings-host-documents"]').exists()
    ).toBe(false);
    expect(
      wrapper.get('[data-testid="settings-denied-suggestion"]').text()
    ).toBe("Open Publications");
  });

  it("renders the General settings form for a settings:write editor", async () => {
    const settingsEditor = {
      ...PUBLICATIONS_EDITOR,
      app_metadata: { role: "editor", scopes: ["settings:write"] }
    } as unknown as User;

    const wrapper = await mountPage(settingsEditor, "?tab=general");

    expect(wrapper.find('[data-testid="settings-host-general"]').exists()).toBe(
      true
    );
    expect(wrapper.find('[data-testid="settings-form-general"]').exists()).toBe(
      true
    );
    expect(
      wrapper.find('[data-testid="settings-tab-publications"]').exists()
    ).toBe(false);
  });
});
