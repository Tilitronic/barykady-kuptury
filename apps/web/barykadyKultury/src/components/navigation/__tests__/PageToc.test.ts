import { describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";

import { createTestI18n } from "@/test-utils/mount";

import PageToc from "../PageToc.vue";

/**
 * Structural twin of the component's `TocItem` (the test tsconfig resolves
 * `*.vue` through the env shim, which has no named exports — vue-tsc sees
 * the real component).
 */
type TocItem = { id: string; label: string; level?: number };

/**
 * T-039 — the reusable TOC contract.
 *
 * happy-dom has no IntersectionObserver, so the tests install a controllable
 * fake: the component must observe every section by id, mark the active link
 * with `aria-current="location"`, and never crash when the browser lacks the
 * API (graceful degradation = no scroll spy, links still work).
 */

interface FakeIntersectionObserver {
  observe: (el: Element) => void;
  unobserve: (el: Element) => void;
  disconnect: () => void;
  takeRecords: () => IntersectionObserverEntry[];
}

const observed = new Set<Element>();
const callbacks: IntersectionObserverCallback[] = [];

class FakeIO implements FakeIntersectionObserver {
  constructor(cb: IntersectionObserverCallback) {
    callbacks.push(cb);
  }
  observe(el: Element) {
    observed.add(el);
  }
  unobserve(el: Element) {
    observed.delete(el);
  }
  disconnect() {
    observed.clear();
  }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

function emitVisible(ids: string[]) {
  const entries = [...observed].map(el => ({
    isIntersecting: ids.includes(el.id),
    target: el,
    boundingClientRect: el.getBoundingClientRect(),
    intersectionRatio: ids.includes(el.id) ? 1 : 0,
    intersectionRect: el.getBoundingClientRect(),
    rootBounds: null,
    time: 0
  })) as IntersectionObserverEntry[];
  for (const cb of callbacks) cb(entries, {} as IntersectionObserver);
}

const ITEMS = [
  { id: "mission", label: "Mission" },
  { id: "history", label: "History" }
];

function mountToc(items: readonly TocItem[] = ITEMS) {
  return mount(PageToc, {
    props: { items, ariaLabel: "On this page" },
    global: { plugins: [createTestI18n("en")] }
  });
}

describe("PageToc", () => {
  it("renders a labelled navigation with anchor links for every item", () => {
    const wrapper = mountToc();

    const nav = wrapper.get("nav");
    expect(nav.attributes("aria-label")).toBe("On this page");

    const links = wrapper.findAll(`.page-toc__desktop a`);
    expect(links).toHaveLength(2);
    expect(links[0]!.attributes("href")).toBe("#mission");
    expect(links[0]!.text()).toBe("Mission");
    expect(links[1]!.attributes("href")).toBe("#history");
  });

  it("marks the scroll-spy active section with aria-current='location'", async () => {
    vi.stubGlobal("IntersectionObserver", FakeIO);
    observed.clear();
    callbacks.length = 0;

    document.body.innerHTML =
      '<section id="mission"></section><section id="history"></section>';

    const wrapper = mountToc();
    await flushPromises();

    // Both sections observed; history becomes the visible one.
    expect(observed.size).toBe(2);
    emitVisible(["history"]);

    await wrapper.vm.$nextTick();
    const links = wrapper.findAll(".page-toc__desktop a");
    expect(links[1]!.attributes("aria-current")).toBe("location");
    expect(links[0]!.attributes("aria-current")).toBeUndefined();

    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("degrades silently without IntersectionObserver (links still render)", () => {
    vi.stubGlobal("IntersectionObserver", undefined);

    const wrapper = mountToc();

    expect(wrapper.findAll(".page-toc__desktop a")).toHaveLength(2);

    vi.unstubAllGlobals();
  });

  it("provides a mobile details disclosure with the same links", () => {
    const wrapper = mountToc();

    const details = wrapper.get("details");
    const summary = details.get("summary");
    expect(summary.text()).toBe("On this page");
    expect(details.findAll("a")).toHaveLength(2);
  });

  it("updates the observed set when items change", async () => {
    vi.stubGlobal("IntersectionObserver", FakeIO);
    observed.clear();
    callbacks.length = 0;

    document.body.innerHTML =
      '<section id="mission"></section><section id="extra"></section>';

    const wrapper = mountToc([{ id: "mission", label: "Mission" }]);
    await flushPromises();
    expect(observed.size).toBe(1);

    // VTU's setProps type omits declared props for type-only defineProps
    // with readonly arrays; the runtime contract is what is under test.
    await wrapper.setProps({
      items: [
        { id: "mission", label: "Mission" },
        { id: "extra", label: "Extra" }
      ]
    } as never);
    await flushPromises();

    expect(observed.size).toBe(2);

    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("activates a link on click and does not let the browser jump natively", async () => {
    document.body.innerHTML =
      '<section id="mission"><h2 tabindex="-1">Mission</h2></section>';

    const wrapper = mountToc();
    const link = wrapper.get(".page-toc__desktop a");

    const event = new Event("click", { bubbles: true, cancelable: true });
    link.element.dispatchEvent(event);
    await flushPromises();

    // preventDefault → the router/browser must not handle the raw hash jump;
    // the component owns scroll + focus instead.
    expect(event.defaultPrevented).toBe(true);

    document.body.innerHTML = "";
  });

  it("reserves the column with skeleton rows while items are empty", () => {
    // Loading/empty pages render the TOC with no items yet; the aside keeps
    // its shape so the content column never jumps (review m6/TOC reserve).
    const wrapper = mountToc([]);

    const skeleton = wrapper.get("[data-testid='page-toc-skeleton']");
    expect(skeleton.attributes("aria-hidden")).toBe("true");
    expect(skeleton.findAll(".page-toc__skeleton-row")).toHaveLength(3);
    expect(wrapper.findAll(".page-toc__desktop a")).toHaveLength(0);
  });

  it("closes the mobile details disclosure after activating a link", async () => {
    const wrapper = mountToc();
    const details = wrapper.get("details");
    (details.element as HTMLDetailsElement).open = true;

    const mobileLink = details.findAll("a")[0]!;
    mobileLink.element.dispatchEvent(
      new Event("click", { bubbles: true, cancelable: true })
    );
    await flushPromises();

    expect((details.element as HTMLDetailsElement).open).toBe(false);
  });

  describe("hierarchy + content language (T-040 rev-1)", () => {
    it("nests deeper levels into child lists, keeps flat items flat", () => {
      const wrapper = mountToc([
        { id: "a", label: "A", level: 2 },
        { id: "a1", label: "A one", level: 3 },
        { id: "a11", label: "A one one", level: 4 },
        { id: "b", label: "B", level: 2 }
      ]);

      const desktop = wrapper.element.querySelector(
        ".page-toc__desktop"
      ) as HTMLElement;

      // Two top-level entries: A (with nested descendants) and B.
      const topLinks = [
        ...desktop.querySelectorAll(":scope > ul > li > a")
      ].map(a => a.textContent);
      expect(topLinks).toEqual(["A", "B"]);

      // "A one" nests under A's <li>; "A one one" nests one deeper.
      const nested = [...desktop.querySelectorAll("li > ul > li > a")].map(
        a => a.textContent
      );
      expect(nested).toEqual(["A one", "A one one"]);
    });

    it("T-039 flat items render exactly one list level (no regression)", () => {
      const wrapper = mountToc();

      const desktop = wrapper.get(".page-toc__desktop");
      expect(desktop.findAll("ul")).toHaveLength(1);
      expect(desktop.findAll("a")).toHaveLength(2);
    });

    it("linkLang puts lang on every anchor for reader content language", () => {
      const wrapper = mount(PageToc, {
        props: {
          items: ITEMS,
          ariaLabel: "On this page",
          linkLang: "pl"
        },
        global: { plugins: [createTestI18n("en")] }
      });

      for (const link of wrapper.findAll(".page-toc__desktop a")) {
        expect(link.attributes("lang")).toBe("pl");
      }
    });
  });
});
