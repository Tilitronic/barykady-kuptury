import { describe, expect, it } from "vitest";

import HomePage from "@/pages/[locale]/index.vue";
import { mountWithPlugins } from "@/test-utils/mount";

/**
 * T-009 moved the home page under the locale route segment. The intent of this
 * suite is unchanged: the page renders the organization name as its heading and
 * the locale-specific placeholder copy from the catalogues.
 */
describe("home page", () => {
  it("renders the organization name as the page heading", async () => {
    const wrapper = await mountWithPlugins(HomePage);

    expect(wrapper.get("h1").text()).toBe("Barykady Kultury");
  });

  it("renders the English placeholder copy by default", async () => {
    const wrapper = await mountWithPlugins(HomePage);

    expect(wrapper.get("p").text()).toBe("Website content is being prepared.");
  });

  it("renders the Polish placeholder copy for the pl locale", async () => {
    const wrapper = await mountWithPlugins(HomePage, { locale: "pl" });

    expect(wrapper.get("p").text()).toBe("Treść strony jest w przygotowaniu.");
  });

  it("renders the Ukrainian placeholder copy for the uk locale", async () => {
    const wrapper = await mountWithPlugins(HomePage, { locale: "uk" });

    expect(wrapper.get("p").text()).toBe("Вміст сайту готується.");
  });
});
