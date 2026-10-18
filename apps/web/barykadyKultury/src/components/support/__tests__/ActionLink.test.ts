import { describe, expect, it } from "vitest";

import ActionLink from "@/components/support/ActionLink.vue";
import { mountWithPlugins } from "@/test-utils/mount";

/**
 * Spec axis (T-022): the shared primary/secondary action link — real anchor,
 * safe external-link attributes only when it opens a new tab, and an SR-only
 * new-tab announcement. The Homepage CTA (T-025) reuses this component.
 */

function mountLink(props: Record<string, unknown>) {
  return mountWithPlugins(ActionLink, {
    props: { label: "Support us with a donation", ...props },
    initialRoute: "/en/support"
  });
}

describe("ActionLink", () => {
  it("renders a real anchor with the label", async () => {
    const wrapper = await mountLink({ href: "mailto:volunteer@example.org" });

    const link = wrapper.get("a");
    expect(link.element.tagName).toBe("A");
    expect(link.attributes("href")).toBe("mailto:volunteer@example.org");
    expect(link.text()).toContain("Support us with a donation");
  });

  it("applies the variant class (primary by default, secondary on request)", async () => {
    const primary = await mountLink({ href: "https://x.org" });
    expect(primary.get("a").classes()).toContain("action-link--primary");

    const secondary = await mountLink({
      href: "https://x.org",
      variant: "secondary"
    });
    expect(secondary.get("a").classes()).toContain("action-link--secondary");
  });

  it("opens external links safely with an SR-only new-tab hint", async () => {
    const wrapper = await mountLink({ href: "https://x.org", newTab: true });

    const link = wrapper.get("a");
    expect(link.attributes("target")).toBe("_blank");
    expect(link.attributes("rel")).toBe("noopener noreferrer");
    expect(link.text()).toContain("opens in a new tab");
  });

  it("omits target/rel when the link stays in the same context", async () => {
    const wrapper = await mountLink({
      href: "mailto:a@b.org",
      newTab: false
    });

    const link = wrapper.get("a");
    expect(link.attributes("target")).toBeUndefined();
    expect(link.attributes("rel")).toBeUndefined();
    expect(link.text()).not.toContain("opens in a new tab");
  });

  it("carries the focus-ring utility for visible keyboard focus", async () => {
    const wrapper = await mountLink({ href: "https://x.org" });

    expect(wrapper.get("a").classes()).toContain("focus-ring");
  });
});
