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
  ref,
  type PropType,
  watch
} from "vue";
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

function onIntersect(entries: readonly IntersectionObserverEntry[]): void {
  for (const entry of entries) {
    const id = (entry.target as HTMLElement).id;
    if (entry.isIntersecting) {
      visible.add(id);
    } else {
      visible.delete(id);
    }
  }

  // Document order wins over intersection order: the first visible section
  // is what "where am I on this page" means for a top-down read.
  const first = props.items.find(item => visible.has(item.id));
  if (first) {
    activeId.value = first.id;
  }
}

function reobserve(): void {
  observer?.disconnect();
  observer = null;
  visible.clear();
  activeId.value = "";

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

onBeforeUnmount(() => {
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
    const renderLevel = (
      nodes: readonly TocNode[],
      depth: number
    ): ReturnType<typeof h> =>
      h(
        "ul",
        { class: "page-toc__list" },
        nodes.map(node =>
          h("li", { key: `${depth}-${node.item.id}` }, [
            h(
              "a",
              {
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
              node.item.label
            ),
            node.children.length > 0
              ? renderLevel(node.children, depth + 1)
              : null
          ])
        )
      );

    return () => renderLevel(nodeProps.nodes, 0);
  }
});

function goTo(id: string): void {
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

.page-toc__list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.page-toc__link {
  display: block;
  padding: 0.375rem 0.625rem;
  border-inline-start: 2px solid var(--color-border);
  color: var(--color-text-muted);
  text-decoration: none;
  overflow-wrap: anywhere;
}

.page-toc__link:hover {
  color: var(--color-link);
  text-decoration: underline;
}

/*
 * Active section: border thickens + text bolds + aria-current in the DOM —
 * state is never carried by the scarlet color alone (DESIGN_SYSTEM.md §6).
 */
/* Nested outline levels indent via the child list (rev-1 B1). */
.page-toc__list .page-toc__list {
  padding-inline-start: 0.875rem;
  margin-block-start: 0.125rem;
}

.page-toc__link[aria-current="location"] {
  border-inline-start-color: var(--color-accent);
  color: var(--color-text);
  font-weight: 600;
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

.page-toc__mobile[open] .page-toc__list {
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
