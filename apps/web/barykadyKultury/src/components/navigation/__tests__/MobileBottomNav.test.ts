import { Quasar } from "quasar";
import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import {
  createMemoryHistory,
  createRouter,
  type RouteRecordRaw
} from "vue-router";

import MobileBottomNav from "../MobileBottomNav.vue";
import { mainNavItems } from "@/config/navigation";
import { createTestI18n } from "@/test-utils/mount";

/**
 * Phone-band bottom navigation: four primary sections (config order) + More.
 * The landmark is a `nav` (never a second contentinfo), the active entry is
 * marked like the header (aria-current="page", About-prefix inclusive), and
 * More only signals the drawer — the header keeps focus ownership.
 */

const routes: RouteRecordRaw[] = [
  { path: "/:locale", name: "home", component: { template: "<div />" } },
  ...mainNavItems.map(item => ({
    path: `/:locale/${item.path}`,
    name: item.routeName,
    component: { template: "<div />" }
  })),
  // About sub-route name mirrors production (`about-document`) — the
  // About-prefix active matching is the point of the test below.
  {
    path: "/:locale/about/documents/:slug",
    name: "about-document",
    component: { template: "<div />" }
  },
  {
    path: "/:locale(.*)?",
    name: "not-found",
    component: { template: "<div />" }
  }
];

async function mountNav(path = "/en/about", menuOpen = false) {
  const router = createRouter({ history: createMemoryHistory(), routes });
  await router.push(path);
  await router.isReady();
  return mount(MobileBottomNav, {
    props: { locale: "en", menuOpen },
    global: { plugins: [Quasar, createTestI18n("en"), router] }
  });
}

describe("MobileBottomNav", () => {
  it("renders the first four sections plus More as a labelled navigation", async () => {
    const wrapper = await mountNav();

    const nav = wrapper.get("nav[data-testid='bottom-nav']");
    expect(nav.attributes("aria-label")).toBe("Main navigation");

    const hrefs = wrapper
      .findAll(".mobile-bottom-nav__item")
      .map(link => link.attributes("href"));
    expect(hrefs).toEqual([
      "/en/contact",
      "/en/about",
      "/en/support",
      "/en/projects",
      undefined // More is a button, not a link
    ]);
    expect(wrapper.get("[data-testid='bottom-nav-more']").text()).toContain(
      "More"
    );
  });

  it("marks the active section with aria-current='page' (About prefix counts)", async () => {
    const about = await mountNav("/en/about");
    const active = about.get(".mobile-bottom-nav__item--active");
    expect(active.attributes("aria-current")).toBe("page");
    expect(active.attributes("href")).toBe("/en/about");

    const reader = await mountNav("/en/about/documents/regulations");
    expect(reader.get("[aria-current='page']").attributes("href")).toBe(
      "/en/about"
    );
  });

  it("More mirrors the drawer state and emits the open intent without owning focus", async () => {
    const wrapper = await mountNav();
    const more = wrapper.get("[data-testid='bottom-nav-more']");

    expect(more.attributes("aria-expanded")).toBe("false");
    expect(more.attributes("aria-controls")).toBe("app-panel");

    await more.trigger("click");
    expect(wrapper.emitted("open-menu")).toHaveLength(1);

    const open = await mountNav("/en/about", true);
    expect(
      open.get("[data-testid='bottom-nav-more']").attributes("aria-expanded")
    ).toBe("true");
  });

  it("decorates icons as aria-hidden while labels carry the names", async () => {
    const wrapper = await mountNav();
    await flushPromises();

    for (const icon of wrapper.findAll(".mobile-bottom-nav__icon")) {
      expect(icon.attributes("aria-hidden")).toBe("true");
    }
    expect(wrapper.text()).toContain("About us");
  });
});
