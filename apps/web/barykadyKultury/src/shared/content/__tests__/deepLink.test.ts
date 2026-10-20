import { describe, expect, it, vi } from "vitest";
import { nextTick, ref } from "vue";

import { applyDeepLink, watchDeepLink } from "../deepLink";

/**
 * T-039 — deep-link scroll + focus.
 *
 * A `/#anchor` arrival must scroll the section into view (below the sticky
 * header via its own scroll-margin) AND move focus to the section heading,
 * not just visually jump. happy-dom lacks `scrollIntoView`, so tests stub it
 * per element and assert the behavior choice.
 */

function mountSection(id: string, headingText: string) {
  const section = document.createElement("section");
  section.id = id;
  const heading = document.createElement("h2");
  heading.setAttribute("tabindex", "-1");
  heading.textContent = headingText;
  section.appendChild(heading);
  document.body.appendChild(section);
  return section;
}

function cleanup() {
  document.body.innerHTML = "";
}

describe("applyDeepLink", () => {
  it("is a no-op for an empty or unknown hash", () => {
    cleanup();
    expect(applyDeepLink("")).toBe(false);
    expect(applyDeepLink("#")).toBe(false);
    expect(applyDeepLink("#missing")).toBe(false);
  });

  it("focuses the section heading and scrolls the section into view", async () => {
    cleanup();
    const section = mountSection("mission", "Mission");
    const spy = vi.fn();
    section.scrollIntoView = spy;

    const applied = applyDeepLink("#mission");
    await nextTick();

    expect(applied).toBe(true);
    expect(document.activeElement).toBe(section.querySelector("h2"));
    expect(spy).toHaveBeenCalled();

    cleanup();
  });

  it("honors prefers-reduced-motion by choosing an instant scroll", async () => {
    cleanup();
    const original = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("reduced-motion"),
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false
    }));

    const section = mountSection("history", "History");
    const spy = vi.fn();
    section.scrollIntoView = spy;

    applyDeepLink("#history");
    await nextTick();

    expect(spy.mock.calls[0]?.[0]).toMatchObject({ behavior: "auto" });

    window.matchMedia = original;
    cleanup();
  });

  it("uses smooth scrolling when motion is allowed", async () => {
    cleanup();
    const section = mountSection("team", "Team");
    const spy = vi.fn();
    section.scrollIntoView = spy;

    applyDeepLink("#team");
    await nextTick();

    expect(spy.mock.calls[0]?.[0]).toMatchObject({ behavior: "smooth" });

    cleanup();
  });

  it("falls back to focusing the section when it has no heading", () => {
    cleanup();
    const section = document.createElement("section");
    section.id = "calendar";
    document.body.appendChild(section);
    section.scrollIntoView = vi.fn();

    applyDeepLink("#calendar");

    expect(document.activeElement).toBe(section);
    cleanup();
  });

  it("re-asserts focus when the browser's fragment handling blurs it", async () => {
    // Simulates Chromium's same-document fragment-navigation focus reset to
    // <body>, which lands AFTER page scripts run (proven in the events E2E).
    cleanup();
    const section = mountSection("values", "Values");
    section.scrollIntoView = vi.fn();

    applyDeepLink("#values");
    await nextTick();

    const heading = section.querySelector("h2");
    expect(document.activeElement).toBe(heading);

    // The browser resets focus to body after our synchronous apply.
    heading?.blur();
    expect(document.activeElement).not.toBe(heading);

    // The next animation frame re-asserts it.
    await new Promise(resolve => requestAnimationFrame(resolve));
    expect(document.activeElement).toBe(heading);

    cleanup();
  });
});

describe("watchDeepLink", () => {
  it("applies once the hash is present AND the data is ready", async () => {
    cleanup();
    const section = mountSection("aims", "Aims");
    const spy = vi.fn();
    section.scrollIntoView = spy;

    const hash = ref("");
    const ready = ref(false);
    watchDeepLink({ hash: () => hash.value, isReady: () => ready.value });

    hash.value = "#aims";
    await nextTick();
    // Not ready yet: the section markup may not even exist — no action.
    expect(spy).not.toHaveBeenCalled();

    ready.value = true;
    await nextTick();
    await nextTick();
    expect(spy).toHaveBeenCalledTimes(1);

    // A repeat of the same state does not re-scroll.
    ready.value = true;
    await nextTick();
    expect(spy).toHaveBeenCalledTimes(1);

    cleanup();
  });
});
