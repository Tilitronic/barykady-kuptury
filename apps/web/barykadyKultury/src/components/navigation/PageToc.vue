<template>
  <!--
    PageToc — reusable section table of contents (T-039, D-25).

    One <nav> landmark (labelled via `ariaLabel`) with two renderings of the
    SAME link list, swapped by CSS only:
      - desktop: a sticky left-hand list (`position: sticky` under the
        sticky site header);
      - mobile (< 1024 px): a native <details> disclosure — keyboard and
        screen-reader operable with zero custom JS, obvious open/close state,
        320 px safe.
    `display: none` removes the hidden copy from the accessibility tree, so
    assistive tech always sees exactly one list.

    Scroll spy: IntersectionObserver marks the active section's link with
    `aria-current="location"` (the ARIA pattern for in-page location).
    Without IntersectionObserver the component degrades to plain anchor
    links — never a crash.

    Link activation is JS-owned (applyDeepLink): scroll + heading focus,
    honoring prefers-reduced-motion. preventDefault keeps vue-router's
    scrollBehavior (top:0) from fighting the jump; the URL hash is updated
    with replaceState so the position stays shareable.
  -->
  <nav class="page-toc" :aria-label="ariaLabel">
    <div class="page-toc__desktop">
      <p class="page-toc__heading">{{ t("toc.onThisPage") }}</p>

      <!--
        Reserve (review m6): pages render the TOC before their section data
        exists; three inert placeholder bars hold the column height so the
        content column never jumps when real items arrive.
      -->
      <div
        v-if="items.length === 0"
        class="page-toc__skeleton"
        aria-hidden="true"
        data-testid="page-toc-skeleton"
      >
        <span class="page-toc__skeleton-row" />
        <span class="page-toc__skeleton-row page-toc__skeleton-row--short" />
        <span class="page-toc__skeleton-row" />
      </div>
      <TocTree v-else :nodes="tocTree" />
    </div>

    <details ref="detailsRef" class="page-toc__mobile">
      <summary class="page-toc__summary focus-ring">{{
        t("toc.onThisPage")
      }}</summary>
      <TocTree :nodes="tocTree" />
    </details>
  </nav>
</template>

<script setup lang="ts">
import {
  computed,
  defineComponent,
  h,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  type PropType,
  watch
} from "vue";
import { UiItem, UiList } from "@/components/ui";
import { useI18n } from "vue-i18n";

import { applyDeepLink } from "@/shared/content/deepLink";

/** One TOC entry: a section's DOM id and its localized label. */
export interface TocItem {
  readonly id: string;
  readonly label: string;
  /**
   * Optional outline level (T-040 reader TOC: h2/h3/h4). Rendered as an
   * indent step; absent keeps the flat area-page look.
   */
  readonly level?: number;
}

/**
 * Sticky header height (3.75rem) plus breathing room — the same offset the
 * pages' `scroll-margin-top` uses, so the spy's "active band" starts where
 * a landed section's heading starts.
 */
// IntersectionObserver rootMargin accepts only px or %, never rem.
// 88px matches the 5.5rem header/sticky offset at the 16px root font size;
// the CSS `scroll-margin-top` remains the authoritative layout offset.
const HEADER_OFFSET_MARGIN = "-88px 0px -60% 0px";

const props = defineProps<{
  items: readonly TocItem[];
  /** Accessible name of the navigation landmark (localized by the page). */
  ariaLabel: string;
  /**
   * T-040 rev-1 F: the reader passes its CONTENT locale so every TOC link
   * carries `lang` matching the text it points into. Area pages omit it —
   * their chrome language is the content language.
   */
  linkLang?: string | undefined;
}>();

const { t } = useI18n();

const activeId = ref("");
/**
 * Classic setup-ref binding (`ref="detailsRef"` in the template): the
 * details element must be closable after link activation (m7).
 */
const detailsRef = ref<HTMLElement | null>(null);

let observer: IntersectionObserver | null = null;
const visible = new Set<string>();

/**
 * The bottom-of-page activation tolerance (px). A short final section never
 * enters the observer band at the end of the document — when the viewport
 * physically cannot scroll further, the LAST TOC item is the honest answer
 * to "where am I on this page".
 */
const BOTTOM_TOLERANCE = 2;

function isAtDocumentBottom(): boolean {
  // clientHeight excludes scrollbars — when a host reports it (0 means
  // "not measured", e.g. detached documents/tests), trust it over innerHeight.
  const client = document.documentElement.clientHeight;
  const viewport =
    client > 0 ? Math.min(window.innerHeight, client) : window.innerHeight;
  return (
    window.scrollY + viewport >=
    document.documentElement.scrollHeight - BOTTOM_TOLERANCE
  );
}

/**
 * Sync activation state on scroll, not only on intersection flips: the
 * bottom shortcut applies here, and leaving the bottom must not strand the
 * last item's accent when its section is back out of the band (IO batching
 * alone was unreliable for instant jumps).
 */
function onScrollSync(): void {
  if (props.items.length === 0) return;
  const last = props.items[props.items.length - 1]!;

  if (isAtDocumentBottom()) {
    activeId.value = last.id;
    visible.clear();
    visible.add(last.id);
    return;
  }

  if (activeId.value && !visible.has(activeId.value)) {
    const first = props.items.find(item => visible.has(item.id));
    activeId.value = first ? first.id : "";
  }
}

function onIntersect(entries: readonly IntersectionObserverEntry[]): void {
  for (const entry of entries) {
    const id = (entry.target as HTMLElement).id;
    if (entry.isIntersecting) {
      visible.add(id);
    } else {
      visible.delete(id);
    }
  }

  if (isAtDocumentBottom()) {
    const last = props.items[props.items.length - 1];
    if (last) {
      activeId.value = last.id;
      visible.clear();
      visible.add(last.id);
      return;
    }
  }

  // Document order wins over intersection order: the first visible section
  // is what "where am I on this page" means for a top-down read.
  const first = props.items.find(item => visible.has(item.id));
  if (first) {
    activeId.value = first.id;
    return;
  }

  // Nothing in the band: gaps between sections keep the last honest answer —
  // EXCEPT the bottom shortcut, which is only true at the bottom. Leaving
  // the last section upward must not strand its accent on the rail.
  const last = props.items[props.items.length - 1];
  if (last && activeId.value === last.id && !visible.has(last.id)) {
    activeId.value = "";
  }
}

function reobserve(): void {
  observer?.disconnect();
  observer = null;
  visible.clear();
  // Keep an optimistic (clicked) active id while its section is still on the
  // page — clearing here unconditionally raced with click activation on the
  // first mount and swallowed the immediate accent.
  if (!props.items.some(item => item.id === activeId.value)) {
    activeId.value = "";
  }

  if (typeof IntersectionObserver === "undefined") return;

  observer = new IntersectionObserver(onIntersect, {
    rootMargin: HEADER_OFFSET_MARGIN,
    threshold: 0
  });

  for (const item of props.items) {
    const el = document.getElementById(item.id);
    if (el) observer.observe(el);
  }
}

// Sections render with the page data; observe after every items/flush cycle.
watch(
  () => props.items,
  () => void nextTick(reobserve),
  { immediate: true, deep: false }
);

onMounted(() => {
  window.addEventListener("scroll", onScrollSync, { passive: true });
});

onBeforeUnmount(() => {
  window.removeEventListener("scroll", onScrollSync);
  observer?.disconnect();
  observer = null;
});

/*
 * Hierarchy (rev-1 B1): items carrying `level` render as a REAL nested list
 * (a `<ul>` inside its parent `<li>`) — the accessible outline structure —
 * instead of a flat list with padding classes. Items without `level` (all
 * T-039 pages) keep the flat single-level list byte-for-byte.
 */
interface TocNode {
  readonly item: TocItem;
  readonly children: TocNode[];
}

function buildTocTree(items: readonly TocItem[]): TocNode[] {
  const roots: TocNode[] = [];
  const stack: { node: TocNode; level: number }[] = [];

  for (const item of items) {
    const level = item.level ?? 2;
    const node: TocNode = { item, children: [] };

    while (stack.length > 0 && stack[stack.length - 1]!.level >= level) {
      stack.pop();
    }

    if (stack.length === 0) {
      roots.push(node);
    } else {
      stack[stack.length - 1]!.node.children.push(node);
    }
    stack.push({ node, level });
  }

  return roots;
}

const tocTree = computed(() => buildTocTree(props.items));

const TocTree = defineComponent({
  name: "TocTree",
  props: {
    nodes: {
      type: Array as PropType<readonly TocNode[]>,
      required: true
    }
  },
  setup(nodeProps) {
    /**
     * Rows are Quasar QItem anchors inside a QList: the WHOLE row is the
     * hit target — hover and clicks register in the space beside the text,
     * not only on the words (the owner's Vue-docs ask). The anchor itself
     * keeps our href, aria-current and JS activation. Nested outline levels
     * stay real `<ul>`/`<li>` inside the row's list item — a genuine,
     * navigable outline for assistive tech (rev-1 B1 preserved).
     */
    const renderItems = (
      nodes: readonly TocNode[],
      depth: number
    ): ReturnType<typeof h>[] =>
      nodes.map(node =>
        h("li", { key: `${depth}-${node.item.id}` }, [
          h(
            UiItem,
            {
              tag: "a",
              href: `#${node.item.id}`,
              class: "page-toc__link focus-ring",
              lang: props.linkLang,
              "aria-current":
                activeId.value === node.item.id ? "location" : undefined,
              onClick: (event: MouseEvent) => {
                event.preventDefault();
                goTo(node.item.id);
              }
            },
            () => node.item.label
          ),
          node.children.length > 0
            ? h(
                "ul",
                { class: "page-toc__list" },
                renderItems(node.children, depth + 1)
              )
            : null
        ])
      );

    // tag="ul" keeps the REAL list semantics (Quasar's default div+role
    // would break the nested-outline contract the reader TOC relies on).
    return () =>
      h(UiList, { tag: "ul", class: "page-toc__list", dense: true }, () =>
        renderItems(nodeProps.nodes, 0)
      );
  }
});

function goTo(id: string): void {
  // Optimistic activation: the reader just told us where they want to be —
  // the accent moves NOW, and the observer (or the bottom rule) confirms as
  // the scroll settles instead of lagging a deliberate choice.
  activeId.value = id;
  applyDeepLink(`#${id}`);
  // Shareable position without a router navigation (whose scrollBehavior
  // would reset the page to top).
  window.history.replaceState(null, "", `#${id}`);
  // m7: on mobile the link lives inside an open <details> — leaving it open
  // covers the section the user just jumped to.
  if (detailsRef.value) detailsRef.value.removeAttribute("open");
}
</script>

<style scoped>
.page-toc {
  min-width: 0;
}

/* ── Desktop list ─────────────────────────────────────────────────────────── */

.page-toc__heading {
  margin: 0 0 0.75rem;
  color: var(--color-text-muted);
  font-size: var(--font-size-small);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.page-toc :deep(.page-toc__list) {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* Nested outline levels indent via the child list (rev-1 B1). */
.page-toc :deep(.page-toc__list .page-toc__list) {
  padding-inline-start: 0.875rem;
  margin-block-start: 0.125rem;
}

/*
 * Row semantics (owner Vue-docs pass): the QItem anchor spans the full
 * panel width, so hover/activation work in the empty space beside a short
 * label too. States are token-driven and theme-adaptive — light surface +
 * dark text in light mode, dark surface + light text in dark; scarlet only
 * as text/tint, never a hardcoded color, never the bare underline/link
 * blue. Active = red text + subtle tint + aria-current (never a side bar,
 * never an underline). Weight is CONSTANT across states: switching states
 * repaints only (zero layout shift).
 */
.page-toc :deep(.page-toc__link) {
  /* QItem paints its own label color; the token state below must win —
     the selector stacks the class for specificity (real ul/role=list). */
  color: var(--color-text-muted);
  text-decoration: none;
  font-weight: 500;
  border-radius: 0.375rem;
  transition:
    background-color var(--motion-duration),
    color var(--motion-duration);
}

.page-toc :deep(.page-toc__link:hover),
.page-toc :deep(.page-toc__link:focus-visible) {
  color: var(--color-link);
  /* Light scarlet wash — token-derived; older engines keep no tint. */
  background-color: color-mix(in srgb, var(--color-accent) 10%, transparent);
  text-decoration: none;
}

/* Active section: RED TEXT ONLY — the rail contract is one state signal per
   moment: hover carries the light tint, the current location carries the
   color. No side bar, no underline, no fill (the owner's Vue-docs pass,
   confirmed against the rail spec). The state also lives in the DOM via
   aria-current="location" (§6: not color alone for AT). */
.page-toc :deep(.page-toc__link[aria-current="location"]) {
  color: var(--color-link);
}

.page-toc__skeleton {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.page-toc__skeleton-row {
  display: block;
  height: 0.875rem;
  width: 100%;
  border-radius: 0.25rem;
  background: var(--color-skeleton);
}

.page-toc__skeleton-row--short {
  width: 70%;
}

/* ── Mobile disclosure ────────────────────────────────────────────────────── */

.page-toc__mobile {
  border: 1px solid var(--color-border);
  border-radius: 0.375rem;
  background: var(--color-surface);
}

.page-toc__summary {
  padding: 0.625rem 0.875rem;
  font-weight: 600;
  cursor: pointer;
  border-radius: 0.375rem;
}

.page-toc__mobile[open] :deep(.page-toc__list) {
  padding: 0 0.5rem 0.5rem;
}

/* ── Responsive swap ──────────────────────────────────────────────────────── */

.page-toc__desktop {
  display: none;
}

@media (min-width: 1024px) {
  .page-toc {
    position: sticky;
    top: 5rem;
    max-height: calc(100dvh - 6rem);
    overflow-y: auto;
  }

  .page-toc__desktop {
    display: block;
  }

  .page-toc__mobile {
    display: none;
  }
}
</style>
