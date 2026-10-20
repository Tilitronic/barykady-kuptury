import { nextTick, watch, type WatchHandle } from "vue";

/**
 * T-039 — deep-link scroll + focus for section anchors.
 *
 * A `/#anchor` arrival (from a TOC click, a shared URL, or a redirect from a
 * removed list route) must do two things after the data renders: scroll the
 * section into view AND move focus to its heading. Focusing only scrolls
 * visually and leaves keyboard/screen-reader users at the document start;
 * the heading is the semantically correct target and carries `tabindex="-1"`
 * from the page markup (with a defensive set for authored content gaps).
 *
 * Sections themselves declare `scroll-margin-top` (page CSS) so the sticky
 * header never covers the landed heading.
 */

/** True when the user asked the OS to reduce motion (WCAG 2.3.3). */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Scrolls `#<hash>` into view and focuses its heading. Returns false when
 * the hash is empty or the section is not (yet) in the document — callers
 * treat "not found" as "wait for data", never as an error state.
 */
export function applyDeepLink(hash: string): boolean {
  const id = hash.replace(/^#/, "");
  if (!id) return false;

  const section = document.getElementById(id);
  if (!section) return false;

  const heading = section.querySelector<HTMLElement>("h1, h2, h3, h4");
  const target = heading ?? section;
  if (!target.hasAttribute("tabindex")) {
    target.setAttribute("tabindex", "-1");
  }

  // Focus first (preventScroll), then scroll explicitly — the order keeps
  // the browser's own scroll-on-focus from fighting the chosen behavior.
  // `?.` guards non-DOM environments (happy-dom, SSR) where the method is
  // absent; the focus move still completes, which is the a11y-critical half.
  target.focus({ preventScroll: true });
  section.scrollIntoView?.({
    behavior: prefersReducedMotion() ? "auto" : "smooth",
    block: "start"
  });

  // Chromium resets focus to <body> when a same-document fragment navigation
  // commits on a non-focusable target (the anchor `<li>` has no tabindex;
  // the browser decides this AFTER our script-side focus ran). Re-assert the
  // focus once the browser's own handling has landed — proven by the events
  // E2E: hash navigation while already on the page blurred the heading.
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => {
      if (document.activeElement !== target) {
        target.focus({ preventScroll: true });
      }
    });
  }
  return true;
}

export interface DeepLinkWatchOptions {
  /** Reactive source of the current route hash ("" when none). */
  hash: () => string;
  /** True once the page's sections are rendered (data settled). */
  isReady: () => boolean;
}

/**
 * Watches (hash, ready) and applies the deep link exactly once per
 * hash+ready combination. The double microtask (watcher flush + nextTick)
 * guarantees the section markup for the just-loaded data exists before the
 * DOM lookup.
 */
export function watchDeepLink(options: DeepLinkWatchOptions): WatchHandle {
  let appliedFor = "";

  return watch(
    [options.hash, options.isReady],
    ([hash, ready]) => {
      if (!ready || !hash || hash === appliedFor) return;
      appliedFor = hash;
      void nextTick(() => {
        // A missing section (unexpected) must not strand the user: retry
        // once after the next flush, then give up silently — the content
        // is still fully readable from the top.
        if (!applyDeepLink(hash)) void nextTick(() => applyDeepLink(hash));
      });
    },
    { immediate: true }
  );
}
