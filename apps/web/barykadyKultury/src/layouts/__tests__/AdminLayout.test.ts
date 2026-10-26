import { mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { describe, expect, it, vi } from "vitest";
import type { Session, User } from "@supabase/supabase-js";
import { createMemoryHistory, createRouter } from "vue-router";

import {
  configureAuth,
  whenAuthReady,
  type AuthApi
} from "@/features/auth/authStore";
import { routes } from "@/router/routes";
import { createTestI18n } from "@/test-utils/mount";

import AdminLayout from "../AdminLayout.vue";

/**
 * T-026 — admin shell contract (DESIGN_SYSTEM.md §6).
 *
 * The layout is the chrome for every admin page: landmarks, a sign-out that
 * clears the session and returns to the public home, and — critically — no
 * links to admin features that do not exist yet (only the dashboard).
 *
 * Mounting the layout standalone would make its <RouterView> resolve route
 * depth 0 and re-render the layout itself, so the test stubs RouterView: the
 * child pages have their own component tests, and here only the shell is
 * under examination.
 */

const adminUser = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "admin@demo.local",
  app_metadata: { role: "admin" }
} as unknown as User;

const publicationsEditor = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "publications@demo.local",
  app_metadata: { role: "editor", scopes: ["publications:write"] }
} as unknown as User;

const importerEditor = {
  id: "33333333-3333-4333-8333-333333333333",
  email: "importer@demo.local",
  app_metadata: { role: "editor", scopes: ["importer"] }
} as unknown as User;

function fakeAuth(sessionUser: User | null): AuthApi {
  return {
    getSession: async () => ({
      data: {
        session: sessionUser
          ? ({ user: sessionUser } as unknown as Session)
          : null
      },
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

async function mountLayout(locale: "en" | "pl" | "uk" = "en") {
  const router = createRouter({
    history: createMemoryHistory(),
    routes
  });
  await router.push(`/${locale}/admin`);
  await router.isReady();

  const wrapper = mount(AdminLayout, {
    global: {
      plugins: [createPinia(), createTestI18n(locale), router],
      stubs: { RouterView: true }
    }
  });
  return Object.assign(wrapper, { router });
}

describe("landmarks and navigation", () => {
  it("renders header, navigation and a single main landmark", async () => {
    configureAuth(fakeAuth(adminUser));
    await whenAuthReady();

    const wrapper = await mountLayout();

    expect(wrapper.find("header[role='banner']").exists()).toBe(true);
    const nav = wrapper.get("nav");
    expect(nav.attributes("aria-label")).toBe("Admin navigation");
    expect(wrapper.findAll("main")).toHaveLength(1);
    expect(wrapper.get("main").attributes("id")).toBe("admin-main");
  });

  it("links every built admin feature — no nav entries for unbuilt ones", async () => {
    configureAuth(fakeAuth(adminUser));
    await whenAuthReady();

    const wrapper = await mountLayout();

    // T-026 shipped the dashboard; T-027 added project management, T-028
    // site pages + team, and T-041 the import surface. Root carries every
    // capability, so all real destinations are listed.
    const links = wrapper
      .findAll("nav a")
      .map(link => link.text())
      .filter(Boolean);
    expect(links).toEqual([
      "Dashboard",
      // T-048: the tabbed surface hosts facts + every entity editor.
      "Settings",
      "Site pages",
      "Projects",
      "Team",
      "Publications",
      "Documents",
      "Events",
      // T-031: read-only coverage has no capability gate, so it is present for
      // every admin-area session.
      "Translation coverage",
      "Import content"
    ]);
    expect(
      wrapper.get("[data-testid='admin-nav-settings']").attributes("href")
    ).toBe("/en/admin/settings");
    expect(
      wrapper.get("[data-testid='admin-nav-pages']").attributes("href")
    ).toBe("/en/admin/pages");
    expect(
      wrapper.get("[data-testid='admin-nav-projects']").attributes("href")
    ).toBe("/en/admin/projects");
    expect(
      wrapper.get("[data-testid='admin-nav-team']").attributes("href")
    ).toBe("/en/admin/team");
    expect(
      wrapper.get("[data-testid='admin-nav-publications']").attributes("href")
    ).toBe("/en/admin/publications");
    expect(
      wrapper.get("[data-testid='admin-nav-documents']").attributes("href")
    ).toBe("/en/admin/documents");
    expect(
      wrapper.get("[data-testid='admin-nav-events']").attributes("href")
    ).toBe("/en/admin/events");
    expect(
      wrapper.get("[data-testid='admin-nav-coverage']").attributes("href")
    ).toBe("/en/admin/coverage");
    expect(
      wrapper.get("[data-testid='admin-nav-import']").attributes("href")
    ).toBe("/en/admin/import");
  });

  it("hides every affordance outside a scoped editor's capabilities", async () => {
    configureAuth(fakeAuth(publicationsEditor));
    await whenAuthReady();

    const wrapper = await mountLayout();

    // Publications-only: only the dashboard + their own area (T-046 hiding
    // rule). Projects, documents and import stay hidden.
    const links = wrapper
      .findAll("nav a")
      .map(link => link.text())
      .filter(Boolean);
    expect(links).toEqual([
      "Dashboard",
      // T-048: the publications editor also has a tab in the settings surface.
      "Settings",
      "Publications",
      // T-031 read-only report: no capability required.
      "Translation coverage"
    ]);
    expect(wrapper.find("[data-testid='admin-nav-projects']").exists()).toBe(
      false
    );
    expect(wrapper.find("[data-testid='admin-nav-import']").exists()).toBe(
      false
    );
    expect(wrapper.find("[data-testid='admin-nav-documents']").exists()).toBe(
      false
    );
  });

  it("shows only the in-scope import affordance to an importer", async () => {
    configureAuth(fakeAuth(importerEditor));
    await whenAuthReady();

    const wrapper = await mountLayout();

    const links = wrapper
      .findAll("nav a")
      .map(link => link.text())
      .filter(Boolean);
    expect(links).toEqual([
      "Dashboard",
      // T-031 read-only report: no capability required.
      "Translation coverage",
      "Import content"
    ]);
    expect(wrapper.find("[data-testid='admin-nav-projects']").exists()).toBe(
      false
    );
  });

  it("hides the dashboard nav from sessions that cannot reach it", async () => {
    // Review des-2: the nav's only link is guard-protected, so rendering it
    // on the sign-in/denial pages would be a dead affordance.
    configureAuth(fakeAuth(null));
    await whenAuthReady();

    const wrapper = await mountLayout();

    expect(wrapper.find("nav").exists()).toBe(false);
  });

  it("keeps the skip link as the first focusable element", async () => {
    configureAuth(fakeAuth(adminUser));
    await whenAuthReady();

    const wrapper = await mountLayout();

    const focusables = wrapper
      .findAll("a[href], button, input, [tabindex]:not([tabindex='-1'])")
      .map(node => node.attributes("class") ?? "");
    expect(focusables[0]).toContain("skip-link");
  });

  it("names the logo link with the route out of the admin", async () => {
    configureAuth(fakeAuth(adminUser));
    await whenAuthReady();

    const wrapper = await mountLayout();

    expect(wrapper.get("a[aria-label]").attributes("aria-label")).toBe(
      "Back to public site"
    );
  });
});

describe("sign-out", () => {
  it("is offered to an authenticated admin and clears session + home nav", async () => {
    const signOutSpy = vi.fn(async () => ({ error: null }));
    configureAuth({ ...fakeAuth(adminUser), signOut: signOutSpy });
    await whenAuthReady();

    const wrapper = await mountLayout();
    const button = wrapper.get("button.admin-layout__sign-out");
    expect(button.text()).toBe("Sign out");

    await button.trigger("click");

    expect(signOutSpy).toHaveBeenCalled();
    // The handler is async: sign-out resolves, then the public home route is
    // navigated to, whose layout is a lazy import. Poll instead of a single
    // microtask so the assertion waits for the dynamic import to resolve
    // (a fixed `setTimeout(0)` raced the transform in isolation).
    await vi.waitFor(() => {
      expect(wrapper.router.currentRoute.value.path).toBe("/en");
    });
  });

  it("is hidden for anonymous visitors (the sign-in page has no session to clear)", async () => {
    configureAuth(fakeAuth(null));
    await whenAuthReady();

    const wrapper = await mountLayout();

    expect(wrapper.find("button.admin-layout__sign-out").exists()).toBe(false);
  });
});
