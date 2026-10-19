import { describe, expect, it } from "vitest";

import SectionShell from "@/components/home/SectionShell.vue";
import { mountWithPlugins } from "@/test-utils/mount";

/**
 * SectionShell (T-025 REFACTOR step): the single heading/spacing contract for
 * homepage sections — one h2 per section, an optional intro, and an optional
 * "view all" link, so the page maps states to markup only.
 */

function mountShell(
  props: Record<string, unknown>,
  slots: Record<string, string> = {}
) {
  return mountWithPlugins(SectionShell, {
    props,
    slots,
    initialRoute: "/en"
  });
}

describe("SectionShell", () => {
  it("renders a labelled section with exactly one h2", async () => {
    const wrapper = await mountShell({ title: "Upcoming events" });

    expect(wrapper.element.tagName).toBe("SECTION");
    expect(wrapper.findAll("h2")).toHaveLength(1);
    expect(wrapper.get("h2").text()).toBe("Upcoming events");
    expect(wrapper.get("section").attributes("aria-labelledby")).toBe(
      wrapper.get("h2").attributes("id")
    );
  });

  it("renders the view-all link only when a destination is given", async () => {
    const withLink = await mountShell(
      { title: "Events", viewAllTo: "/en/events", viewAllLabel: "All events" },
      { default: "<p>content</p>" }
    );
    expect(withLink.get(".section-shell__view-all").attributes("href")).toBe(
      "/en/events"
    );
    expect(withLink.get(".section-shell__view-all").text()).toBe("All events");

    const withoutLink = await mountShell({ title: "Events" });
    expect(withoutLink.find(".section-shell__view-all").exists()).toBe(false);
  });

  it("renders an optional intro paragraph and the default slot", async () => {
    const wrapper = await mountShell(
      { title: "Events", intro: "Nearest three below." },
      { default: "<ul><li>one</li></ul>" }
    );

    expect(wrapper.get(".section-shell__intro").text()).toBe(
      "Nearest three below."
    );
    expect(wrapper.get("ul li").text()).toBe("one");
  });
});
