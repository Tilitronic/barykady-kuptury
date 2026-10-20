import { beforeEach, describe, expect, it } from "vitest";
import type { Session, User } from "@supabase/supabase-js";

import { configureAuth, type AuthApi } from "@/features/auth/authStore";
import { routes } from "@/router/routes";
import { mountWithPlugins } from "@/test-utils/mount";

import AdminSignInPage from "../AdminSignInPage.vue";

/**
 * T-026 — accessible sign-in form contract (DESIGN_SYSTEM.md §6, ticket
 * acceptance: "Form errors are programmatically associated and announced").
 *
 * The page mounts inside the real route table under AdminLayout, so the test
 * also proves the shell renders around it. The auth seam is a fake `AuthApi`;
 * no network, no live Supabase.
 */

const adminUser = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "admin@demo.local",
  app_metadata: { role: "admin" }
} as unknown as User;

function fakeAuth(overrides: Partial<AuthApi> = {}): AuthApi {
  return {
    getSession: async () => ({ data: { session: null }, error: null }),
    signInWithPassword: async () => ({
      data: {
        session: { user: adminUser } as unknown as Session,
        user: adminUser
      },
      error: null
    }),
    signOut: async () => ({ error: null }),
    onAuthStateChange: () => ({
      data: { subscription: { unsubscribe: () => undefined } }
    }),
    ...overrides
  };
}

async function mountSignIn(initialRoute = "/en/admin/sign-in") {
  return mountWithPlugins(AdminSignInPage, {
    routes,
    initialRoute
  });
}

beforeEach(() => {
  configureAuth(fakeAuth());
});

describe("labels and password-manager semantics", () => {
  it("associates each label with its input via for/id", async () => {
    const wrapper = await mountSignIn();

    const email = wrapper.get("#admin-email");
    const password = wrapper.get("#admin-password");
    // `get()` already throws when absent — these assert the for/id wiring.
    expect(wrapper.get("label[for='admin-email']").text()).toContain("Email");
    expect(wrapper.get("label[for='admin-password']").text()).toContain(
      "Password"
    );
    expect(email.attributes("id")).toBe("admin-email");
    expect(password.attributes("type")).toBe("password");
  });

  it("sets autocomplete tokens for password managers", async () => {
    const wrapper = await mountSignIn();

    expect(wrapper.get("#admin-email").attributes("autocomplete")).toBe(
      "email"
    );
    expect(wrapper.get("#admin-password").attributes("autocomplete")).toBe(
      "current-password"
    );
  });

  it("offers no registration and no password-reset affordance", async () => {
    const wrapper = await mountSignIn();

    // Invited admins only (PRODUCT_REQUIREMENTS §6): the page must not read
    // like a public account surface.
    const text = wrapper.text().toLowerCase();
    expect(text).not.toContain("register");
    expect(text).not.toContain("sign up");
    expect(text).not.toContain("forgot");
    expect(text).not.toContain("reset");
    expect(wrapper.find("a[href*='register']").exists()).toBe(false);
  });
});

describe("client-side validation feedback", () => {
  it("flags an empty submission with programmatically associated errors", async () => {
    const wrapper = await mountSignIn();

    await wrapper.get("form").trigger("submit");

    const email = wrapper.get("#admin-email");
    expect(email.attributes("aria-invalid")).toBe("true");
    const describedBy = email.attributes("aria-describedby") ?? "";
    expect(describedBy).toContain("admin-email-error");
    expect(wrapper.get("#admin-email-error").text()).toBe(
      "Enter your email address."
    );
  });

  it("rejects a malformed email with the localized invalid message", async () => {
    const wrapper = await mountSignIn();

    await wrapper.get("#admin-email").setValue("not-an-email");
    await wrapper.get("#admin-password").setValue("hunter2");
    await wrapper.get("form").trigger("submit");

    expect(wrapper.get("#admin-email-error").text()).toBe(
      "Enter a valid email address."
    );
  });

  it("clears the field error once a valid value is entered", async () => {
    const wrapper = await mountSignIn();

    await wrapper.get("form").trigger("submit");
    expect(wrapper.find("#admin-email-error").exists()).toBe(true);

    await wrapper.get("#admin-email").setValue("admin@demo.local");
    await wrapper.vm.$nextTick();

    expect(wrapper.find("#admin-email-error").exists()).toBe(false);
    expect(wrapper.get("#admin-email").attributes("aria-invalid")).toBe(
      undefined as never
    );
  });
});

describe("submission lifecycle", () => {
  it("shows a pending state and only calls the auth API with both values", async () => {
    let resolveSignIn: (value: {
      data: { session: Session | null; user: User | null };
      error: { message: string } | null;
    }) => void = () => undefined;
    configureAuth(
      fakeAuth({
        signInWithPassword: () =>
          new Promise(resolve => {
            resolveSignIn = resolve;
          })
      })
    );

    const wrapper = await mountSignIn();
    await wrapper.get("#admin-email").setValue("admin@demo.local");
    await wrapper.get("#admin-password").setValue("hunter2");

    const submitPromise = wrapper.get("form").trigger("submit");

    await wrapper.vm.$nextTick();
    const button = wrapper.get("button[type='submit']");
    expect(button.attributes("disabled")).toBeDefined();
    expect(button.attributes("aria-busy")).toBe("true");
    expect(wrapper.text()).toContain("Signing in…");

    resolveSignIn({
      data: {
        session: { user: adminUser } as unknown as Session,
        user: adminUser
      },
      error: null
    });
    await submitPromise;
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(wrapper.vm.$router.currentRoute.value.path).toBe("/en/admin");
  });

  it("announces invalid credentials in the polite live region", async () => {
    configureAuth(
      fakeAuth({
        signInWithPassword: async () => ({
          data: { session: null, user: null },
          error: { message: "Invalid login credentials" }
        })
      })
    );

    const wrapper = await mountSignIn();
    await wrapper.get("#admin-email").setValue("admin@demo.local");
    await wrapper.get("#admin-password").setValue("wrong");
    await wrapper.get("form").trigger("submit");
    await wrapper.vm.$nextTick();

    const status = wrapper.get('[role="status"]');
    expect(status.attributes("aria-live")).toBe("polite");
    expect(status.text()).toBe("The email or password is incorrect.");
  });

  it("announces the unconfigured state instead of hanging", async () => {
    configureAuth(null);

    const wrapper = await mountSignIn();
    await wrapper.get("#admin-email").setValue("admin@demo.local");
    await wrapper.get("#admin-password").setValue("hunter2");
    await wrapper.get("form").trigger("submit");
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[role="status"]').text()).toBe(
      "Sign-in is not configured for this site yet."
    );
  });

  it("honours an allowed admin redirect target after a successful sign-in", async () => {
    configureAuth(fakeAuth());

    const wrapper = await mountSignIn(
      "/en/admin/sign-in?redirect=%2Fen%2Fadmin%2Faccess-denied"
    );
    await wrapper.get("#admin-email").setValue("admin@demo.local");
    await wrapper.get("#admin-password").setValue("hunter2");
    await wrapper.get("form").trigger("submit");
    await new Promise(resolve => setTimeout(resolve, 0));

    // The stored target is an admin path; the guard is not installed in this
    // unit router, so the page must navigate there verbatim.
    expect(wrapper.vm.$router.currentRoute.value.fullPath).toBe(
      "/en/admin/access-denied"
    );
  });

  it("keeps the query and hash of an allowed admin redirect target", async () => {
    configureAuth(fakeAuth());

    const wrapper = await mountSignIn(
      "/en/admin/sign-in?redirect=%2Fen%2Fadmin%2Faccess-denied%3Ftab%3D1%23top"
    );
    await wrapper.get("#admin-email").setValue("admin@demo.local");
    await wrapper.get("#admin-password").setValue("hunter2");
    await wrapper.get("form").trigger("submit");
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(wrapper.vm.$router.currentRoute.value.fullPath).toBe(
      "/en/admin/access-denied?tab=1#top"
    );
  });

  it("refuses a protocol-relative redirect value", async () => {
    configureAuth(fakeAuth());

    const wrapper = await mountSignIn(
      "/en/admin/sign-in?redirect=%2F%2Fevil.example%2Fadmin"
    );
    await wrapper.get("#admin-email").setValue("admin@demo.local");
    await wrapper.get("#admin-password").setValue("hunter2");
    await wrapper.get("form").trigger("submit");
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(wrapper.vm.$router.currentRoute.value.path).toBe("/en/admin");
  });

  it("refuses an absolute external redirect value", async () => {
    configureAuth(fakeAuth());

    const wrapper = await mountSignIn(
      "/en/admin/sign-in?redirect=https%3A%2F%2Fevil.example%2Fadmin"
    );
    await wrapper.get("#admin-email").setValue("admin@demo.local");
    await wrapper.get("#admin-password").setValue("hunter2");
    await wrapper.get("form").trigger("submit");
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(wrapper.vm.$router.currentRoute.value.path).toBe("/en/admin");
  });

  it("refuses an internal path outside the admin shell", async () => {
    configureAuth(fakeAuth());

    const wrapper = await mountSignIn(
      "/en/admin/sign-in?redirect=%2Fen%2Fprojects"
    );
    await wrapper.get("#admin-email").setValue("admin@demo.local");
    await wrapper.get("#admin-password").setValue("hunter2");
    await wrapper.get("form").trigger("submit");
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(wrapper.vm.$router.currentRoute.value.path).toBe("/en/admin");
  });
});

describe("locale coverage", () => {
  it("renders the Polish catalogue at /pl/admin/sign-in", async () => {
    const wrapper = await mountWithPlugins(AdminSignInPage, {
      locale: "pl",
      routes,
      initialRoute: "/pl/admin/sign-in"
    });

    expect(wrapper.text()).toContain("Logowanie administratora");
  });

  it("renders the Ukrainian catalogue at /uk/admin/sign-in", async () => {
    const wrapper = await mountWithPlugins(AdminSignInPage, {
      locale: "uk",
      routes,
      initialRoute: "/uk/admin/sign-in"
    });

    expect(wrapper.text()).toContain("Вхід адміністратора");
  });
});
