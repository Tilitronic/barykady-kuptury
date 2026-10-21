<template>
  <!--
    SiteSearch — header search: trigger + modal dialog (T-039, D-26).

    Interaction model (DESIGN_SYSTEM.md §4/§6, ticket §"Search UI contract"):
      - A compact icon trigger lives in the header controls cluster, so it
        renders inline on desktop AND inside the mobile drawer (the drawer
        IS the same DOM, CSS-swapped) — one instance, two placements.
      - `/` and `Ctrl/Cmd+K` open from anywhere; the default is prevented
        ONLY for those shortcuts (typing "/" in a field is never hijacked).
      - The dialog is a combobox: focus starts in the input and stays there
        while arrows traverse the flattened option list across BOTH sections
        (aria-activedescendant — the list never steals focus). Enter follows
        the active result; Esc closes and restores focus to the trigger;
        Tab cycles the dialog's own controls (focus trap).
      - Two visible sections, Navigation first (instant, synchronous from
        the composable) and Content second (debounced Postgres + calendar).
        A content failure NEVER removes navigation results; the retry button
        re-runs the composable's error path.
      - Kind/type badges are text (never color alone); the sr-only polite
        live region announces counts/loading/error without moving focus.
      - Reduced motion: the dialog itself is static (no enter animation is
        applied); hover transitions use --motion-duration and the global
        kill switch in tokens.css neutralizes them.
      - Stale section links (m5, documented degradation): nav entries like
        `projects-featured` or the positional About anchors point at sections
        that exist only when the destination has the data. The page itself
        always resolves; a missing anchor simply lands at the page top —
        validating cross-page anchors from the header is impossible without
        loading every page.
  -->
  <button
    ref="triggerRef"
    type="button"
    class="site-search__trigger focus-ring"
    data-testid="site-search-trigger"
    :aria-label="t('search.trigger')"
    @click="open"
  >
    <svg
      class="site-search__icon"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.5" y2="16.5" />
    </svg>
  </button>

  <Teleport to="body">
    <div v-if="isOpen" class="site-search">
      <div class="site-search__backdrop" @click="close"></div>

      <div
        ref="dialogRef"
        class="site-search__dialog"
        role="dialog"
        aria-modal="true"
        :aria-label="t('search.dialogTitle')"
        @keydown="onDialogKeydown"
      >
        <!--
          Field row: input + close button as flex siblings in NORMAL FLOW.
          The close button used to be position:absolute over the input's
          reserved padding — user reports showed the glyphs overlapping at
          narrow widths. A flex row makes overlap structurally impossible:
          the input shrinks (flex: 1 1 auto; min-width: 0) and the close
          target keeps its full 2.25rem box. DOM order = tab order:
          input → close → chips (focus starts in the input on open).
        -->
        <div class="site-search__field">
          <input
            ref="inputRef"
            v-model="search.query.value"
            class="site-search__input focus-ring"
            type="search"
            role="combobox"
            autocomplete="off"
            :aria-label="t('search.inputLabel')"
            :placeholder="t('search.placeholder')"
            aria-controls="site-search-listbox"
            aria-autocomplete="list"
            :aria-expanded="options.length > 0 ? 'true' : 'false'"
            :aria-activedescendant="activeOption?.id ?? undefined"
            @keydown="onInputKeydown"
          />

          <button
            type="button"
            class="site-search__close focus-ring"
            :aria-label="t('search.close')"
            @click="close"
          >
            ✕
          </button>
        </div>

        <div
          class="site-search__chips"
          role="group"
          :aria-label="t('search.filtersLabel')"
        >
          <button
            v-for="name in FILTER_NAMES"
            :key="name"
            type="button"
            class="site-search__chip focus-ring"
            :data-testid="`search-chip-${name}`"
            :aria-pressed="search.filter.value === name"
            @click="chooseFilter(name)"
          >
            {{ t(`search.filters.${name}`) }}
          </button>
        </div>

        <p class="sr-only" role="status" aria-live="polite">
          {{ liveMessage }}
        </p>

        <div
          id="site-search-listbox"
          class="site-search__results"
          role="listbox"
          :aria-label="t('search.inputLabel')"
        >
          <p
            v-if="shortQuery"
            class="site-search__hint"
            data-testid="search-hint"
          >
            {{ t("search.hint") }}
          </p>

          <template v-else>
            <!-- M3: an empty Navigation group is not rendered — the
                 symmetric "no results" affordance belongs to Content,
                 which has network states; nav absence just means "no page
                 matches", and the live region still counts it. -->
            <div
              v-if="search.navigationResults.value.length > 0"
              class="site-search__section"
              role="group"
              :aria-label="t('search.navSection')"
              data-testid="search-section-navigation"
            >
              <!--
                Plain span, not a heading: a listbox group may own only
                options (axe aria-required-children), and the group is
                already named by its aria-label — this is the visible
                reinforcement of that name.
              -->
              <span class="site-search__section-title">
                {{ t("search.navSection") }}
              </span>
              <div
                v-for="(result, i) in search.navigationResults.value"
                :id="optionId('nav', i)"
                :key="result.id"
                class="site-search__option"
                :class="{ 'site-search__option--active': isActive('nav', i) }"
                role="option"
                :aria-selected="isActive('nav', i)"
                @click="go(result.route)"
                @mousemove="setActive('nav', i)"
              >
                <span class="site-search__kind" data-testid="search-kind">
                  {{ t(`search.navKinds.${result.kind}`) }}
                </span>
                <span class="site-search__option-text">
                  <span class="site-search__option-title">{{
                    result.title
                  }}</span>
                  <span
                    v-if="result.description"
                    class="site-search__option-desc"
                    >{{ result.description }}</span
                  >
                </span>
              </div>
            </div>

            <div
              class="site-search__section"
              role="group"
              :aria-label="t('search.contentSection')"
              data-testid="search-section-content"
            >
              <span class="site-search__section-title">
                {{ t("search.contentSection") }}
              </span>

              <p
                v-if="search.status.value === 'loading'"
                class="site-search__state"
              >
                {{ t("search.loading") }}
              </p>
              <template v-else-if="search.status.value === 'error'">
                <p class="site-search__state site-search__state--error">
                  {{
                    t(
                      search.error.value === SEARCH_EVENTS_ERROR
                        ? "search.errorEvents"
                        : "search.errorContent"
                    )
                  }}
                </p>
                <button
                  type="button"
                  class="site-search__retry focus-ring"
                  @click="search.retry()"
                >
                  {{ t("search.retry") }}
                </button>
              </template>
              <p
                v-else-if="
                  search.status.value === 'ready' &&
                  search.contentResults.value.length === 0
                "
                class="site-search__state"
              >
                {{ t("search.noContent") }}
              </p>

              <div
                v-for="(result, i) in search.contentResults.value"
                :id="optionId('content', i)"
                :key="result.id"
                class="site-search__option"
                :class="{
                  'site-search__option--active': isActive('content', i)
                }"
                role="option"
                :aria-selected="isActive('content', i)"
                @click="go(result.route)"
                @mousemove="setActive('content', i)"
              >
                <span class="site-search__kind" data-testid="search-kind">
                  {{ t(`search.contentKinds.${result.kind}`) }}
                </span>
                <span class="site-search__option-text">
                  <span class="site-search__option-title">{{
                    result.title
                  }}</span>
                  <span
                    v-if="result.excerpt"
                    class="site-search__option-desc"
                    >{{ result.excerpt }}</span
                  >
                </span>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import {
  computed,
  inject,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch
} from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";

import { SUPABASE_CLIENT_KEY } from "@/features/content/supabaseInjection";
import { fetchPublishedPublicationYears } from "@/features/search/api";
import {
  SEARCH_EVENTS_ERROR,
  useSiteSearch
} from "@/features/search/useSiteSearch";
import type { SiteSearchFilter } from "@/features/search/types";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/features/i18n/locales";

/**
 * The composable owns query debounce, filter derivation, stale-response
 * guarding and failure isolation — the dialog only renders its state and
 * routes keyboard semantics (no duplicated search logic, per the ticket).
 */
const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const supabase = inject(SUPABASE_CLIENT_KEY, null);

const currentLocale = computed<Locale>(() => {
  const { locale } = route.params as { locale?: unknown };
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
});

const routeName = computed(() =>
  route.name === undefined || route.name === null ? null : String(route.name)
);

/**
 * Real publication years (T-039 review): fetched once per page session on
 * the first dialog opening (module cache in the API layer), then fed to the
 * nav index. Failure or absence simply means no year rows — never invented.
 */
const publicationYears = ref<readonly number[]>([]);

const search = useSiteSearch({
  locale: currentLocale,
  routeName,
  supabase,
  publicationYears,
  // Navigation display text resolves through the i18n layer — the registry
  // is structural (id/kind/path/keywords) after the review fix.
  translate: (key, named) => t(key, named ?? {})
});

const FILTER_NAMES: readonly SiteSearchFilter[] = [
  "all",
  "pages",
  "projects",
  "publications",
  "documents",
  "team",
  "events"
];

const isOpen = ref(false);
/** This instance's trigger button — focus returns here on close (T-044):
 * a component-local ref, not a global testid query that could match another
 * element (or another instance) elsewhere in the document. */
const triggerRef = ref<HTMLButtonElement | null>(null);
const dialogRef = ref<HTMLElement | null>(null);
const inputRef = ref<HTMLInputElement | null>(null);

/** Flattened option list across both sections, navigation first. */
interface FlatOption {
  readonly id: string;
  readonly route: string;
}

const options = computed<readonly FlatOption[]>(() => [
  ...search.navigationResults.value.map((result, i) => ({
    id: optionId("nav", i),
    route: result.route
  })),
  ...search.contentResults.value.map((result, i) => ({
    id: optionId("content", i),
    route: result.route
  }))
]);

const activeIndex = ref(-1);
const activeOption = computed(() => options.value[activeIndex.value] ?? null);

const shortQuery = computed(() => search.query.value.trim().length < 2);

function optionId(section: "nav" | "content", index: number): string {
  return `site-search-opt-${section}-${index}`;
}

function isActive(section: "nav", index: number): boolean;
function isActive(section: "content", index: number): boolean;
function isActive(section: "nav" | "content", index: number): boolean {
  const navCount = search.navigationResults.value.length;
  const flat = section === "nav" ? index : navCount + index;
  return activeIndex.value === flat;
}

function setActive(section: "nav" | "content", index: number): void {
  const navCount = search.navigationResults.value.length;
  activeIndex.value = section === "nav" ? index : navCount + index;
}

// New keystrokes rebuild the list: selection resets to "nothing yet".
watch(options, () => {
  activeIndex.value = -1;
});

const liveMessage = computed(() => {
  if (shortQuery.value) return "";
  if (search.status.value === "loading") return t("search.loading");
  if (search.status.value === "error") {
    return t(
      search.error.value === SEARCH_EVENTS_ERROR
        ? "search.errorEvents"
        : "search.errorContent"
    );
  }
  return t("search.counts", {
    navCount: search.navigationResults.value.length,
    contentCount: search.contentResults.value.length
  });
});

function open(): void {
  if (isOpen.value) return;
  isOpen.value = true;
  activeIndex.value = -1;
  // Lock background scrolling while the modal is up (WCAG 2.4.3 focus order
  // — the page behind must not scroll-behind the dialog); the exact previous
  // value is restored on close.
  previousBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  // Years fire on first open; the API-layer cache makes repeats free.
  void fetchPublishedPublicationYears(supabase).then(years => {
    publicationYears.value = years;
  });
  void nextTick(() => inputRef.value?.focus());
}

let previousBodyOverflow = "";

function close(): void {
  if (!isOpen.value) return;
  isOpen.value = false;
  document.body.style.overflow = previousBodyOverflow;
  search.reset();
  void nextTick(() => triggerRef.value?.focus());
}

function chooseFilter(name: SiteSearchFilter): void {
  search.setFilter(name);
  // Keyboard flow continues from the input, not the chip.
  void nextTick(() => inputRef.value?.focus());
}

function go(target: string): void {
  isOpen.value = false;
  document.body.style.overflow = previousBodyOverflow;
  search.reset();
  void router.push(target);
}

/** True when the keystroke originates in an editable field. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

function onGlobalKeydown(event: KeyboardEvent): void {
  if (
    event.key === "/" &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    !isTypingTarget(event.target)
  ) {
    event.preventDefault();
    open();
    return;
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    open();
    return;
  }

  // Esc closes even when focus escaped the dialog; the dialog's own handler
  // covers the focused case first.
  if (event.key === "Escape" && isOpen.value) {
    close();
  }
}

onMounted(() => {
  window.addEventListener("keydown", onGlobalKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onGlobalKeydown);
});

function onInputKeydown(event: KeyboardEvent): void {
  const count = options.value.length;

  switch (event.key) {
    case "ArrowDown":
      event.preventDefault();
      activeIndex.value =
        count === 0 ? -1 : Math.min(activeIndex.value + 1, count - 1);
      break;
    case "ArrowUp":
      event.preventDefault();
      activeIndex.value = Math.max(activeIndex.value - 1, -1);
      break;
    case "Home":
      if (count > 0) {
        event.preventDefault();
        activeIndex.value = 0;
      }
      break;
    case "End":
      if (count > 0) {
        event.preventDefault();
        activeIndex.value = count - 1;
      }
      break;
    case "Enter": {
      // Review suggestion: with no traversed row yet, Enter follows the
      // FIRST result — the list is already ordered by relevance.
      const target = activeOption.value ?? options.value[0] ?? null;
      if (target) {
        event.preventDefault();
        go(target.route);
      }
      break;
    }
    default:
      break;
  }
}

/** Focus trap: Tab cycles the dialog's interactive controls only. */
function onDialogKeydown(event: KeyboardEvent): void {
  if (event.key !== "Tab" || !dialogRef.value) return;

  const focusables =
    dialogRef.value.querySelectorAll<HTMLElement>("input, button");
  if (focusables.length === 0) return;

  const first = focusables[0]!;
  const last = focusables[focusables.length - 1]!;
  const current = document.activeElement;

  if (event.shiftKey && current === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && current === last) {
    event.preventDefault();
    first.focus();
  }
}

// A route change closes and resets (contract: dialog is transient chrome).
watch(
  () => route.fullPath,
  () => {
    if (isOpen.value) close();
  }
);
</script>

<style scoped>
/* ── Trigger ─────────────────────────────────────────────────────────────── */

.site-search__trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  /* 2.25rem: the ≥24 px AA target (WCAG 2.5.8) inside the tight 1280 px
     header budget — see the AppHeader compression band comment. */
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: 0.375rem;
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  transition:
    border-color var(--motion-duration),
    background-color var(--motion-duration);
}

.site-search__trigger:hover {
  border-color: var(--color-link);
  background: var(--color-surface-raised);
}

/* ── Backdrop + dialog ───────────────────────────────────────────────────── */

.site-search__backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: var(--color-overlay);
}

.site-search__dialog {
  position: fixed;
  top: 10dvh;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1001;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: min(92vw, 38rem);
  max-height: 80dvh;
  padding: 1.25rem;
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  background: var(--color-dialog-bg);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

@media (max-width: 480px) {
  .site-search__dialog {
    top: 4dvh;
    width: calc(100vw - 1.5rem);
    padding: 1rem;
  }
}

/* ── Field row (input + close, normal flow) ──────────────────────────────── */

.site-search__field {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.site-search__close {
  flex: 0 0 auto;
  position: static;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: 0.375rem;
  background: transparent;
  color: var(--color-text);
  font-size: 1rem;
  cursor: pointer;
}

.site-search__close:hover {
  border-color: var(--color-link);
}

/* ── Input ───────────────────────────────────────────────────────────────── */

.site-search__input {
  /* Shrink instead of letting the glyphs run under the close button — the
     old absolute close + padding-inline-end hack overlapped at 320 px. */
  flex: 1 1 auto;
  min-width: 0;
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--color-form-border);
  border-radius: 0.375rem;
  background: var(--color-form-bg);
  color: var(--color-text);
  font: inherit;
}

/* ── Filter chips ────────────────────────────────────────────────────────── */

.site-search__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.site-search__chip {
  padding: 0.25rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: transparent;
  color: var(--color-text-muted);
  font: inherit;
  font-size: var(--font-size-small);
  font-weight: 600;
  cursor: pointer;
  transition:
    color var(--motion-duration),
    border-color var(--motion-duration);
}

.site-search__chip:hover {
  border-color: var(--color-link);
  color: var(--color-link);
}

/*
 * Pressed chip: border thickens + text darkens + aria-pressed in the DOM —
 * state never relies on the accent color alone (DESIGN_SYSTEM.md §6).
 */
.site-search__chip[aria-pressed="true"] {
  border: 2px solid var(--color-accent);
  color: var(--color-text);
}

/* ── Results ─────────────────────────────────────────────────────────────── */

.site-search__results {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.site-search__hint {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-small);
}

.site-search__section-title {
  display: block;
  margin: 0 0 0.375rem;
  color: var(--color-text-muted);
  font-size: var(--font-size-small);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.site-search__state {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-small);
}

.site-search__state--error {
  color: var(--color-danger);
  font-weight: 600;
}

.site-search__retry {
  align-self: flex-start;
  margin-top: 0.375rem;
  padding: 0.375rem 1rem;
  border: 1px solid var(--color-link);
  border-radius: 0.375rem;
  background: transparent;
  color: var(--color-link);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.site-search__retry:hover {
  background: var(--color-surface-raised);
}

.site-search__option {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  padding: 0.5rem 0.625rem;
  border-radius: 0.375rem;
  cursor: pointer;
  overflow-wrap: anywhere;
}

.site-search__option--active,
.site-search__option:hover {
  background: var(--color-surface-raised);
}

.site-search__option--active {
  outline: 2px solid var(--color-focus);
  outline-offset: -2px;
}

.site-search__kind {
  flex: 0 0 auto;
  padding: 0.125rem 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  color: var(--color-text-muted);
  font-size: var(--font-size-small);
  font-weight: 600;
  white-space: nowrap;
}

.site-search__option-text {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
}

.site-search__option-title {
  font-weight: 600;
}

.site-search__option-desc {
  color: var(--color-text-muted);
  font-size: var(--font-size-small);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
