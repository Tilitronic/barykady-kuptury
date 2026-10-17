import { describe, expect, it } from "vitest";

import HomePage from "@/pages/index.vue";
import { mountWithPlugins } from "@/test-utils/mount";

describe("home page", () => {
  it("renders the organization name as the page heading", () => {
    const wrapper = mountWithPlugins(HomePage);

    expect(wrapper.get("h1").text()).toBe("Barykady Kultury");
  });

  it("renders the English placeholder copy by default", () => {
    const wrapper = mountWithPlugins(HomePage);

    expect(wrapper.get("p").text()).toBe("Website content is being prepared.");
  });

  it("renders the Polish placeholder copy for the pl locale", () => {
    const wrapper = mountWithPlugins(HomePage, { locale: "pl" });

    expect(wrapper.get("p").text()).toBe("Treść strony jest w przygotowaniu.");
  });

  it("renders the Ukrainian placeholder copy for the uk locale", () => {
    const wrapper = mountWithPlugins(HomePage, { locale: "uk" });

    expect(wrapper.get("p").text()).toBe("Вміст сайту готується.");
  });
});
