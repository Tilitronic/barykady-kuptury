import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { flushPromises } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { Quasar } from "quasar";

import SiteSearch from "@/components/search/SiteSearch.vue";
import { SUPABASE_CLIENT_KEY } from "@/features/content/supabaseInjection";
import { resetPublicationYearsCache } from "@/features/search/api";
import { resetEventsSearchCache } from "@/features/search/eventsSearch";
import { routes } from "@/router/routes";
import { createTestI18n } from "@/test-utils/mount";
import { createFakeSupabase } from "@/test-utils/fakeSupabase";

/**
 * T-039 search-UI lane — dialog contract (ticket §"Search UI contract").
 *
 * The dialog is teleported to <body>, so assertions query the document
 * directly. The RPC/calendar seams are fakes: no network, no live Supabase
 * (docs/TESTING.md §2).
 */

/**
 * The unified fake serves both seams the dialog touches: `from` (the
 * publications-years query) and `rpc` (search_published_content).
 */
function createSearchFake(
  options: {
    rows?: unknown[];
    error?: { message: string } | null;
    years?: { publication_date: string | null }[];
  } = {}
) {
  return createFakeSupabase({
    tables: {
      publications: options.years ?? [
        { publication_date: "2026-05-01" },
        { publication_date: "2025-02-01" }
      ]
    },
    rpc: { data: options.rows ?? [], error: options.error ?? null }
  });
}

const DOC_ROW = {
  kind: "document",
  entity_id: "doc-1",
  title: "Regulations of the Ordinary Association",
  excerpt: "The regulations define membership rules.",
  slug: "regulations",
  page_key: null,
  rank: 3
};

const PROJECT_ROW = {
  kind: "project",
  entity_id: "p-1",
  title: "Sample Community Workshop",
  excerpt: "A recurring open workshop series.",
  slug: "sample-community-workshop",
  page_key: null,
  rank: 2
};

function calendarBody(events: unknown[]) {
  return JSON.stringify({
    calendarId: "fixture-calendar@example.org",
    events,
    generatedAt: "2026-01-01T00:00:00.000Z"
  });
}

const FIXTURE_EVENT = {
  id: "fixture-event-timed",
  title: "Sample timed event",
  start: "2030-05-14T16:00:00+02:00",
  end: null,
  allDay: false,
  timezone: "Europe/Warsaw",
  location: null,
  description: null,
  registrationUrl: null
};

/** Wrappers created by setup(), unmounted in afterEach to drop listeners
 * and Teleport anchors between tests. */
const liveWrappers: Array<ReturnType<typeof mount>> = [];

async function setup(
  props: {
    rpc?: {
      rows?: unknown[];
      error?: { message: string } | null;
    };
    path?: string;
    calendar?: unknown[] | "fail";
  } = {}
) {
  const rpcFake = createSearchFake(props.rpc);
  const router = createRouter({
    history: createMemoryHistory(),
    routes
  });
  await router.push(props.path ?? "/en");
  await router.isReady();

  const fetchImpl = vi.fn(async () => {
    if (props.calendar === "fail") {
      return new Response("{}", { status: 502 });
    }
    return new Response(calendarBody(props.calendar ?? []), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  });
  vi.stubGlobal("fetch", fetchImpl);

  const wrapper = mount(SiteSearch, {
    global: {
      plugins: [createTestI18n("en"), router, Quasar],
      provide: { [SUPABASE_CLIENT_KEY as unknown as symbol]: rpcFake.client }
    },
    attachTo: document.body
  });

  liveWrappers.push(wrapper);
  return { wrapper, router, rpcFake, fetchImpl };
}

/** Wait past the composable's 200 ms debounce. */
async function settled() {
  await flushPromises();
  await new Promise(resolve => setTimeout(resolve, 260));
  await flushPromises();
}

function q<T extends Element = HTMLElement>(selector: string): T | null {
  return document.body.querySelector<T>(selector);
}

function openDialog(): HTMLElement | null {
  return q('[role="dialog"]');
}

async function pressGlobal(key: string, init: Partial<KeyboardEvent> = {}) {
  document.dispatchEvent(
    new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
      ...init
    })
  );
  window.dispatchEvent(
    new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
      ...init
    })
  );
  await flushPromises();
}

async function openViaTrigger(wrapper: ReturnType<typeof mount>) {
  const trigger = wrapper.get("[data-testid='site-search-trigger']");
  await trigger.trigger("click");
  await flushPromises();
  return trigger;
}

beforeEach(() => {
  resetEventsSearchCache();
  resetPublicationYearsCache();
});

afterEach(() => {
  // Unmount FIRST: dropping the components removes their window listeners
  // and Teleport roots before the body is cleared.
  for (const wrapper of liveWrappers.splice(0)) wrapper.unmount();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
  // A test that navigated away via go() restored it already; belt-and-braces
  // reset so scroll-lock state can never leak across tests.
  document.body.style.overflow = "";
});

describe("trigger and dialog lifecycle", () => {
  it("renders a labelled trigger and no dialog until opened", async () => {
    const { wrapper } = await setup();

    const trigger = wrapper.get("[data-testid='site-search-trigger']");
    expect(trigger.attributes("aria-label")).toBe("Search the site");
    // Visible icon is decorative; the sr-only span carries the name.
    expect(trigger.find("svg").attributes("aria-hidden")).toBe("true");
    expect(openDialog()).toBeNull();
  });

  it("opens on click with a modal labelled dialog and focus in the input", async () => {
    const { wrapper } = await setup();
    await openViaTrigger(wrapper);

    const dialog = openDialog();
    expect(dialog).not.toBeNull();
    expect(dialog!.getAttribute("aria-modal")).toBe("true");
    expect(dialog!.getAttribute("aria-label")).toBe("Site search");
    expect(document.activeElement?.getAttribute("role")).toBe("combobox");
  });

  it("opens on '/' and on Ctrl/Cmd+K, but not while typing in an input", async () => {
    await setup();

    const event = new KeyboardEvent("keydown", {
      key: "/",
      bubbles: true,
      cancelable: true
    });
    document.body.dispatchEvent(event);
    await flushPromises();
    expect(openDialog()).not.toBeNull();
    expect(event.defaultPrevented).toBe(true);

    // Close, then type '/' inside an input — must NOT hijack the keystroke.
    await pressGlobal("Escape");
    expect(openDialog()).toBeNull();

    const input = document.createElement("input");
    document.body.appendChild(input);
    const typed = new KeyboardEvent("keydown", {
      key: "/",
      bubbles: true,
      cancelable: true
    });
    input.dispatchEvent(typed);
    await flushPromises();
    expect(openDialog()).toBeNull();
    expect(typed.defaultPrevented).toBe(false);
    input.remove();

    await pressGlobal("k", { ctrlKey: true });
    expect(openDialog()).not.toBeNull();
  });

  it("closes on Esc and restores focus to the trigger", async () => {
    const { wrapper } = await setup();
    const trigger = await openViaTrigger(wrapper);

    await pressGlobal("Escape");

    expect(openDialog()).toBeNull();
    expect(document.activeElement).toBe(trigger.element);
  });

  // T-044 readability: focus restore must use the component's own trigger
  // ref, not a global `document.querySelector("[data-testid=...]")` — the
  // latter grabs the FIRST match in document order, so any other element
  // carrying the same test id (decoy above) would steal the focus.
  it("restores focus to its OWN trigger, not a same-testid element elsewhere", async () => {
    const decoy = document.createElement("button");
    decoy.setAttribute("data-testid", "site-search-trigger");
    document.body.appendChild(decoy);

    try {
      const { wrapper } = await setup();
      const trigger = await openViaTrigger(wrapper);

      await pressGlobal("Escape");

      expect(document.activeElement).toBe(trigger.element);
      expect(document.activeElement).not.toBe(decoy);
    } finally {
      decoy.remove();
    }
  });

  it("closes on backdrop click", async () => {
    const { wrapper } = await setup();
    await openViaTrigger(wrapper);

    q(".site-search__backdrop")!.dispatchEvent(
      new MouseEvent("click", { bubbles: true })
    );
    await flushPromises();

    expect(openDialog()).toBeNull();
  });

  // User-reported fix: the absolutely-positioned close button overlapped the
  // input at narrow widths. The close control now sits in the normal flow
  // beside the input inside a flex field row — never above it.
  it("lays the input and close button out in a flex field row", async () => {
    const { wrapper } = await setup();
    await openViaTrigger(wrapper);

    const field = q<HTMLElement>(".site-search__field");
    const input = q<HTMLElement>('[role="combobox"]');
    const close = q<HTMLElement>(".site-search__close");

    expect(field).not.toBeNull();
    expect(input).not.toBeNull();
    expect(close).not.toBeNull();

    // Both live inside the field row, as siblings in normal flow.
    expect(input!.parentElement).toBe(field);
    expect(close!.parentElement).toBe(field);

    // DOM order is the tab order contract: input first, then close, then the
    // chips group — keyboard traversal matches the visual row.
    const dialog = openDialog()!;
    const controls = [...dialog.querySelectorAll<HTMLElement>("input, button")];
    expect(controls[0]).toBe(input);
    expect(controls[1]).toBe(close);

    // Close keeps its accessible label and its click-closes behavior.
    expect(close!.getAttribute("aria-label")).toBe("Close search");
    close!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushPromises();
    expect(openDialog()).toBeNull();
  });

  it("resets query and filter on close", async () => {
    const { wrapper, rpcFake } = await setup({
      rpc: { rows: [DOC_ROW] }
    });
    await openViaTrigger(wrapper);

    const input = q<HTMLInputElement>('[role="combobox"]')!;
    input.value = "regulations";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await settled();
    expect(rpcFake.calls.length).toBeGreaterThan(0);

    await pressGlobal("Escape");
    await openViaTrigger(wrapper);

    expect(q<HTMLInputElement>('[role="combobox"]')!.value).toBe("");
    // The retried RPC after reopen must not reuse the old query — reopening
    // shows the hint state, no pending results.
    expect(q('[data-testid="search-hint"]')).not.toBeNull();
  });
});

describe("result sections", () => {
  it("renders Navigation first with instant results, Content second", async () => {
    const { wrapper, rpcFake } = await setup({
      rpc: { rows: [DOC_ROW] }
    });
    await openViaTrigger(wrapper);

    const input = q<HTMLInputElement>('[role="combobox"]')!;
    input.value = "abo";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await flushPromises();

    // Navigation is synchronous — visible before any debounce elapses.
    const navGroup = q('[data-testid="search-section-navigation"]')!;
    expect(navGroup.textContent).toContain("About us");

    input.value = "regulations";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await settled();

    const groups = [...document.querySelectorAll("[role='group']")];
    const labels = groups.map(g => g.getAttribute("aria-label"));
    expect(labels.indexOf("Navigation")).toBeLessThan(
      labels.indexOf("Content")
    );

    const content = q('[data-testid="search-section-content"]')!;
    expect(content.textContent).toContain(
      "Regulations of the Ordinary Association"
    );
    expect(content.textContent).toContain(
      "The regulations define membership rules."
    );
    // Kind badge is text, not color alone.
    expect(
      content.querySelector("[data-testid='search-kind']")?.textContent
    ).toBe("Document");
    expect(rpcFake.rpcCalls[0]!.name).toBe("search_published_content");
  });

  it("shows the loading state before results land", async () => {
    const { wrapper } = await setup({ rpc: { rows: [DOC_ROW] } });
    await openViaTrigger(wrapper);

    const input = q<HTMLInputElement>('[role="combobox"]')!;
    input.value = "regulations";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await flushPromises();

    expect(q('[data-testid="search-section-content"]')!.textContent).toContain(
      "Searching…"
    );
  });

  it("shows the empty state when content has no rows", async () => {
    const { wrapper } = await setup({ rpc: { rows: [] } });
    await openViaTrigger(wrapper);

    const input = q<HTMLInputElement>('[role="combobox"]')!;
    input.value = "zzzz";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await settled();

    expect(q('[data-testid="search-section-content"]')!.textContent).toContain(
      "No content results."
    );
  });

  it("keeps navigation results usable when content fails, with retry", async () => {
    const { wrapper } = await setup({
      rpc: { error: { message: "rpc down" } }
    });
    await openViaTrigger(wrapper);

    const input = q<HTMLInputElement>('[role="combobox"]')!;
    input.value = "abo";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await settled();

    // Navigation section still renders…
    expect(
      q('[data-testid="search-section-navigation"]')!.textContent
    ).toContain("About us");
    // …content shows the localized error + retry control.
    const content = q('[data-testid="search-section-content"]')!;
    expect(content.textContent).toContain("Content results are unavailable.");
    expect(content.querySelector("button")?.textContent).toBe("Try again");

    expect(q('[role="status"]')!.textContent).toContain(
      "Content results are unavailable."
    );
  });

  it("announces result counts in a polite live region without moving focus", async () => {
    const { wrapper } = await setup({ rpc: { rows: [DOC_ROW, PROJECT_ROW] } });
    await openViaTrigger(wrapper);

    const input = q<HTMLInputElement>('[role="combobox"]')!;
    input.value = "re";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await settled();

    const live = q('[role="status"]')!;
    expect(live.getAttribute("aria-live")).toBe("polite");
    expect(live.textContent).toMatch(/\d+ navigation and \d+ content/);
    // Focus never moved from the input.
    expect(document.activeElement).toBe(input);
  });
});

describe("filters", () => {
  it("derives the default chip from the route", async () => {
    const { wrapper } = await setup({ path: "/en/projects" });
    await openViaTrigger(wrapper);

    const chip = q<HTMLButtonElement>("[data-testid='search-chip-projects']")!;
    expect(chip.getAttribute("aria-pressed")).toBe("true");
    expect(
      q<HTMLButtonElement>("[data-testid='search-chip-all']")!.getAttribute(
        "aria-pressed"
      )
    ).toBe("false");
  });

  it("sends the chip selection to the RPC kinds and marks aria-pressed", async () => {
    const { wrapper, rpcFake } = await setup({ rpc: { rows: [PROJECT_ROW] } });
    await openViaTrigger(wrapper);

    q<HTMLButtonElement>("[data-testid='search-chip-projects']")!.dispatchEvent(
      new MouseEvent("click", { bubbles: true })
    );
    await flushPromises();

    const input = q<HTMLInputElement>('[role="combobox"]')!;
    input.value = "workshop";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await settled();

    expect(rpcFake.rpcCalls.at(-1)!.args.result_kinds).toEqual(["project"]);
    expect(
      q<HTMLButtonElement>(
        "[data-testid='search-chip-projects']"
      )!.getAttribute("aria-pressed")
    ).toBe("true");
    // Chip activation returns focus to the input (keyboard flow continues).
    expect(document.activeElement).toBe(input);
  });

  it("the Events chip queries the calendar, not the RPC", async () => {
    const { wrapper, rpcFake, fetchImpl } = await setup({
      calendar: [FIXTURE_EVENT]
    });
    await openViaTrigger(wrapper);

    q<HTMLButtonElement>("[data-testid='search-chip-events']")!.dispatchEvent(
      new MouseEvent("click", { bubbles: true })
    );
    const input = q<HTMLInputElement>('[role="combobox"]')!;
    input.value = "timed";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await settled();

    expect(fetchImpl).toHaveBeenCalled();
    // No RPC call with kinds for the events chip ([] = none).
    expect(rpcFake.rpcCalls).toHaveLength(0);
    expect(q('[data-testid="search-section-content"]')!.textContent).toContain(
      "Sample timed event"
    );
  });
});

describe("keyboard traversal", () => {
  async function openWithResults() {
    const { wrapper, router } = await setup({ rpc: { rows: [DOC_ROW] } });
    await openViaTrigger(wrapper);
    const input = q<HTMLInputElement>('[role="combobox"]')!;
    input.value = "regulations";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await settled();
    return { wrapper, router, input };
  }

  function key(input: Element, keyName: string) {
    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: keyName,
        bubbles: true,
        cancelable: true
      })
    );
  }

  it("ArrowDown/Up move aria-activedescendant across both sections", async () => {
    const { input } = await openWithResults();

    key(input, "ArrowDown");
    await flushPromises();
    const first = input.getAttribute("aria-activedescendant");
    expect(first).toBeTruthy();
    expect(q("#" + first!)?.getAttribute("aria-selected")).toBe("true");

    key(input, "ArrowDown");
    await flushPromises();
    const second = input.getAttribute("aria-activedescendant")!;
    expect(second).not.toBe(first);

    key(input, "ArrowUp");
    await flushPromises();
    expect(input.getAttribute("aria-activedescendant")).toBe(first);

    key(input, "End");
    await flushPromises();
    const last = input.getAttribute("aria-activedescendant")!;
    key(input, "Home");
    await flushPromises();
    expect(input.getAttribute("aria-activedescendant")).toBe(first);
    void last;
  });

  it("Enter navigates to the active result and closes the dialog", async () => {
    const { router, input } = await openWithResults();

    key(input, "ArrowDown");
    await flushPromises();
    key(input, "Enter");
    await flushPromises();
    // Route components are lazy (T-044 F1); wait for the dynamic import.
    await vi.waitFor(() => {
      expect(router.currentRoute.value.path).toBe("/en/about");
    });

    expect(openDialog()).toBeNull();
    // First option for "regulations" is the nav "Documents" section entry
    // (keyword match in the frozen registry) → /en/about#documents.
    expect(router.currentRoute.value.hash).toBe("#documents");
  });

  it("Tab stays inside the dialog (focus trap)", async () => {
    const { wrapper } = await setup({ rpc: { rows: [DOC_ROW] } });
    await openViaTrigger(wrapper);

    const dialog = openDialog()!;
    const controls = [...dialog.querySelectorAll<HTMLElement>("input, button")];
    expect(controls.length).toBeGreaterThan(2);

    // Tab from the LAST control wraps to the FIRST control in the dialog.
    const last = controls.at(-1)!;
    last.focus();
    key(last, "Tab");
    await flushPromises();
    expect(document.activeElement).toBe(controls[0]);

    // Shift+Tab from the FIRST control wraps to the last.
    controls[0]!.focus();
    controls[0]!.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Tab",
        shiftKey: true,
        bubbles: true,
        cancelable: true
      })
    );
    await flushPromises();
    expect(document.activeElement).toBe(last);
    void wrapper;
  });
});

describe("route change", () => {
  it("closes and resets when the route changes", async () => {
    const { wrapper, router } = await setup();
    await openViaTrigger(wrapper);
    expect(openDialog()).not.toBeNull();

    await router.push("/en/about");
    await flushPromises();

    expect(openDialog()).toBeNull();
  });

  describe("review-fix behaviors", () => {
    it("hides the Navigation group entirely when nothing matches (M3)", async () => {
      const { wrapper } = await setup({ rpc: { rows: [DOC_ROW] } });
      await openViaTrigger(wrapper);

      const input = q<HTMLInputElement>('[role="combobox"]')!;
      input.value = "regulations";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await settled();

      // "regulations" matches the about-documents nav entry — so test the
      // truly-empty case with a nonsense token instead.
      input.value = "qqzz";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await flushPromises();

      expect(q('[data-testid="search-section-navigation"]')).toBeNull();
      // Content still renders its own state — the dialog is not an empty shell.
      expect(q('[data-testid="search-section-content"]')).not.toBeNull();
    });

    it("Enter without traversal follows the FIRST result", async () => {
      const { wrapper, router } = await setup({ rpc: { rows: [DOC_ROW] } });
      await openViaTrigger(wrapper);

      const input = q<HTMLInputElement>('[role="combobox"]')!;
      input.value = "regulations";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await settled();

      input.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          bubbles: true,
          cancelable: true
        })
      );
      await flushPromises();
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(router.currentRoute.value.path).toBe("/en/about");
      expect(router.currentRoute.value.hash).toBe("#documents");
    });

    it("locks body scroll while open and restores it on close", async () => {
      const { wrapper } = await setup();
      await openViaTrigger(wrapper);
      expect(document.body.style.overflow).toBe("hidden");

      await pressGlobal("Escape");
      expect(document.body.style.overflow).toBe("");
    });

    it("feeds real publication years into the nav section after opening", async () => {
      const { wrapper } = await setup();
      await openViaTrigger(wrapper);
      // The years query resolves on open; give it a flush.
      await new Promise(resolve => setTimeout(resolve, 0));
      await flushPromises();

      const input = q<HTMLInputElement>('[role="combobox"]')!;
      input.value = "2026";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await flushPromises();

      const nav = q('[data-testid="search-section-navigation"]')!;
      expect(nav.textContent).toContain("2026");
    });
  });
});

describe("trigger accessible naming and tooltip", () => {
  /**
   * Header lane fix: the icon trigger sat unlabeled next to the social
   * icons. The full sentence stays the accessible name (aria-label wins
   * over title), the short label drives the native title fallback and the
   * Quasar tooltip shown on hover/keyboard focus, and the trigger owns a
   * dedicated inline-end margin so it never touches SocialLinks.
   */
  it("keeps the full accessible name and adds the localized short title", async () => {
    const { wrapper } = await setup();

    const trigger = wrapper.get("[data-testid='site-search-trigger']");
    expect(trigger.attributes("aria-label")).toBe("Search the site");
    expect(trigger.attributes("title")).toBe("Search");
  });

  it("anchors a Quasar tooltip carrying the short label to the trigger", async () => {
    const { wrapper } = await setup();

    const tooltip = wrapper.findComponent({ name: "QTooltip" });
    expect(tooltip.exists()).toBe(true);

    // Arm it through the real path: Quasar anchors the tooltip on
    // `pointerenter` (100 ms cursor settle), so the label that ships is the
    // localized short name, rendered teleported like the dialog is.
    await wrapper
      .get("[data-testid='site-search-trigger']")
      .trigger("pointerenter");
    await new Promise(resolve => setTimeout(resolve, 200));
    await flushPromises();

    const tip = document.querySelector(".q-tooltip");
    expect(tip?.textContent).toBe("Search");
  });
});
